import { WebSocket } from 'ws';
import { FastifyInstance } from 'fastify';
import { WebSocketMessageType, WebSocketMessage } from '@smr/protocol';
import { verifyJwtToken } from '../services/auth.js';
import { sessionStore } from '../services/sessionStore.js';
import { generateTurnCredentials } from '../services/turn.js';

export function setupSignalingGateway(fastify: FastifyInstance) {
  fastify.get('/ws/signaling', { websocket: true }, (connection, req) => {
    const socket: WebSocket = connection.socket;
    let clientId: string | null = null;
    let role: 'android' | 'desktop' | null = null;
    let deviceId: string | null = null;

    fastify.log.info('[Signaling] New WebSocket connection initiated');

    socket.on('message', (rawData: Buffer | string) => {
      try {
        const msg: WebSocketMessage = JSON.parse(rawData.toString());

        switch (msg.type) {
          case WebSocketMessageType.AUTH_REQUEST: {
            try {
              const decoded = verifyJwtToken(msg.token);
              clientId = `${decoded.role}_${decoded.deviceId}_${Date.now()}`;
              role = decoded.role;
              deviceId = decoded.deviceId;

              sessionStore.registerClient({
                id: clientId,
                role: decoded.role,
                deviceId: decoded.deviceId,
                ws: socket,
                authenticated: true
              });

              socket.send(JSON.stringify({
                type: WebSocketMessageType.AUTH_RESPONSE,
                success: true
              }));
              fastify.log.info(`[Signaling] Auth successful for ${role} client (${deviceId})`);
            } catch (err) {
              socket.send(JSON.stringify({
                type: WebSocketMessageType.AUTH_RESPONSE,
                success: false,
                error: 'Invalid or expired authentication token'
              }));
              socket.close(4001, 'Unauthorized');
            }
            break;
          }

          case WebSocketMessageType.PAIR_REQUEST: {
            // Forward pairing request to Android phone WebSocket if connected
            const pairingSession = sessionStore.getPairingSession(msg.pairingSessionId);
            if (!pairingSession) {
              socket.send(JSON.stringify({
                type: WebSocketMessageType.ERROR,
                code: 'PAIRING_EXPIRED',
                message: 'Pairing session invalid or expired'
              }));
              break;
            }

            pairingSession.desktopWs = socket;
            const androidClient = sessionStore.findAndroidByDeviceId(pairingSession.deviceId);
            if (androidClient && androidClient.ws.readyState === WebSocket.OPEN) {
              androidClient.ws.send(JSON.stringify({
                type: WebSocketMessageType.PAIR_REQUEST,
                pairingSessionId: msg.pairingSessionId,
                desktopName: msg.desktopName,
                desktopFingerprint: msg.desktopFingerprint
              }));
              fastify.log.info(`[Signaling] PAIR_REQUEST forwarded to Android device ${pairingSession.deviceId}`);
            } else {
              socket.send(JSON.stringify({
                type: WebSocketMessageType.ERROR,
                code: 'DEVICE_OFFLINE',
                message: 'Android phone is not connected to signaling gateway'
              }));
            }
            break;
          }

          case WebSocketMessageType.PAIR_APPROVAL: {
            // Android approved pairing! Notify Desktop client with session token & TURN credentials
            const pairingSession = sessionStore.getPairingSession(msg.pairingSessionId);
            if (pairingSession && pairingSession.desktopWs && pairingSession.desktopWs.readyState === WebSocket.OPEN) {
              const turnServers = generateTurnCredentials(pairingSession.deviceId);
              pairingSession.desktopWs.send(JSON.stringify({
                type: WebSocketMessageType.PAIR_APPROVAL,
                pairingSessionId: msg.pairingSessionId,
                approved: true,
                sessionToken: msg.sessionToken,
                turnServers
              }));
              fastify.log.info(`[Signaling] PAIR_APPROVAL delivered to Desktop for session ${msg.pairingSessionId}`);
            }
            break;
          }

          case WebSocketMessageType.PAIR_REJECTED: {
            const pairingSession = sessionStore.getPairingSession(msg.pairingSessionId);
            if (pairingSession && pairingSession.desktopWs && pairingSession.desktopWs.readyState === WebSocket.OPEN) {
              pairingSession.desktopWs.send(JSON.stringify({
                type: WebSocketMessageType.PAIR_REJECTED,
                pairingSessionId: msg.pairingSessionId,
                reason: msg.reason || 'User rejected pairing on phone'
              }));
            }
            sessionStore.removePairingSession(msg.pairingSessionId);
            break;
          }

          case WebSocketMessageType.SDP_OFFER:
          case WebSocketMessageType.SDP_ANSWER:
          case WebSocketMessageType.ICE_CANDIDATE: {
            // Relay WebRTC negotiation messages between peers for session
            const pairingSession = sessionStore.getPairingSession(msg.sessionId);
            if (pairingSession) {
              const targetWs = role === 'android' ? pairingSession.desktopWs : sessionStore.findAndroidByDeviceId(pairingSession.deviceId)?.ws;
              if (targetWs && targetWs.readyState === WebSocket.OPEN) {
                targetWs.send(JSON.stringify(msg));
              }
            }
            break;
          }

          case WebSocketMessageType.PING: {
            socket.send(JSON.stringify({
              type: WebSocketMessageType.PONG,
              timestamp: Date.now()
            }));
            break;
          }

          case WebSocketMessageType.DISCONNECT: {
            fastify.log.info(`[Signaling] Client requested disconnect: ${clientId}`);
            socket.close(1000, 'User Disconnected');
            break;
          }

          default:
            fastify.log.warn(`[Signaling] Unknown message type: ${msg}`);
            break;
        }
      } catch (err) {
        fastify.log.error(err, '[Signaling] Malformed message processing error');
      }
    });

    socket.on('close', () => {
      if (clientId) {
        sessionStore.unregisterClient(clientId);
        fastify.log.info(`[Signaling] Client connection closed: ${clientId}`);
      }
    });

    socket.on('error', (err) => {
      fastify.log.error(err, `[Signaling] Socket error for ${clientId}`);
    });
  });
}
