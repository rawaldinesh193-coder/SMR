import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import websocket from '@fastify/websocket';
import jwt from 'jsonwebtoken';
import QRCode from 'qrcode';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

// Configuration
const PORT = parseInt(process.env.PORT || '4000', 10);
const HOST = process.env.HOST || '0.0.0.0';
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_minimum_32_chars_long_production';
const TURN_SECRET = process.env.TURN_SHARED_SECRET || 'coturn_shared_secret_key_for_hmac_auth';
const STUN_URL = process.env.STUN_SERVER_URL || 'stun:stun.l.google.com:19302';
const TURN_URL = process.env.TURN_SERVER_URL || 'turn:localhost:3478';

// Zero-Database In-Memory Session Store
class InMemoryStore {
  constructor() {
    this.clients = new Map(); // clientId -> { id, role, deviceId, ws }
    this.pairingSessions = new Map(); // pairingSessionId -> sessionData
    this.connectionSessions = new Map(); // sessionId -> sessionData
  }

  registerClient(client) {
    this.clients.set(client.id, client);
  }

  unregisterClient(clientId) {
    this.clients.delete(clientId);
  }

  findAndroidByDeviceId(deviceId) {
    for (const client of this.clients.values()) {
      if (client.role === 'android' && client.deviceId === deviceId) {
        return client;
      }
    }
    return undefined;
  }

  createPairingSession(data) {
    this.pairingSessions.set(data.pairingSessionId, data);
  }

  getPairingSession(id) {
    return this.pairingSessions.get(id);
  }

  getPairingByCodeOrToken(codeOrToken) {
    for (const s of this.pairingSessions.values()) {
      if (s.pairingToken === codeOrToken || s.pairingCode === codeOrToken) {
        return s;
      }
    }
    return undefined;
  }

  removePairingSession(id) {
    this.pairingSessions.delete(id);
  }
}

const store = new InMemoryStore();

// Helper Functions
function generatePairingCode() {
  const digits = crypto.randomInt(1000, 9999);
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const char1 = chars[crypto.randomInt(0, chars.length)];
  const char2 = chars[crypto.randomInt(0, chars.length)];
  return `${char1}${char2}-${digits}`;
}

function generateTurnCredentials(usernameSuffix = 'user') {
  const timestamp = Math.floor(Date.now() / 1000) + 86400; // 24 hours
  const username = `${timestamp}:${usernameSuffix}`;
  const hmac = crypto.createHmac('sha1', TURN_SECRET);
  hmac.update(username);
  const credential = hmac.digest('base64');

  return [
    { urls: STUN_URL },
    { urls: TURN_URL, username, credential }
  ];
}

// Fastify App Setup
const fastify = Fastify({ logger: { level: 'info' } });

async function start() {
  await fastify.register(cors, { origin: true, credentials: true });
  await fastify.register(rateLimit, { max: 200, timeWindow: '1 minute' });
  await fastify.register(websocket, { options: { maxPayload: 1048576 } });

  // REST API Routes
  fastify.get('/api/v1/health', async () => ({
    status: 'ok',
    service: 'SMR Standalone WebRTC Signaling Backend',
    mode: 'zero_database_in_memory',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  }));

  fastify.get('/api/v1/ready', async () => ({
    status: 'ready',
    mode: 'zero_database_in_memory'
  }));

  fastify.post('/api/v1/pairing/create', async (req, reply) => {
    const { deviceInfo } = req.body || {};
    const dbDeviceId = deviceInfo?.deviceId || crypto.randomUUID();
    const pairingSessionId = crypto.randomUUID();
    const pairingCode = generatePairingCode();
    const pairingToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + 5 * 60 * 1000;

    store.createPairingSession({
      pairingSessionId,
      deviceId: dbDeviceId,
      pairingToken,
      pairingCode,
      expiresAt,
      status: 'PENDING',
      deviceInfo
    });

    const hostHeader = req.headers.host || 'localhost:4000';
    const protocol = req.protocol || 'http';
    const pairingUrl = `${protocol}://${hostHeader}/pair?token=${pairingToken}`;
    const qrCodeUrl = await QRCode.toDataURL(pairingUrl);

    const androidJwt = jwt.sign({
      deviceId: dbDeviceId,
      fingerprint: deviceInfo?.fingerprint || 'android_device',
      role: 'android'
    }, JWT_SECRET, { expiresIn: '24h' });

    return reply.status(201).send({
      success: true,
      data: {
        pairingSessionId,
        pairingCode,
        pairingToken,
        pairingUrl,
        qrCodeUrl,
        expiresAt: new Date(expiresAt).toISOString(),
        androidJwt,
        deviceInfo
      }
    });
  });

  fastify.post('/api/v1/pairing/claim', async (req, reply) => {
    const { pairingCode, pairingToken, desktopInfo } = req.body || {};
    const lookup = pairingToken || pairingCode;
    const session = store.getPairingByCodeOrToken(lookup);

    if (!session || Date.now() > session.expiresAt) {
      return reply.status(404).send({
        success: false,
        error: { code: 'EXPIRED', message: 'Pairing code is invalid or expired' }
      });
    }

    session.desktopInfo = desktopInfo;
    const desktopJwt = jwt.sign({
      deviceId: session.deviceId,
      role: 'desktop',
      sessionId: session.pairingSessionId
    }, JWT_SECRET, { expiresIn: '24h' });

    return reply.status(200).send({
      success: true,
      data: {
        pairingSessionId: session.pairingSessionId,
        desktopJwt,
        status: 'WAITING_FOR_APPROVAL'
      }
    });
  });

  fastify.post('/api/v1/pairing/approve', async (req, reply) => {
    const { pairingSessionId, approved } = req.body || {};
    const session = store.getPairingSession(pairingSessionId);

    if (!session) {
      return reply.status(404).send({ success: false, error: { message: 'Session not found' } });
    }

    if (!approved) {
      store.removePairingSession(pairingSessionId);
      return reply.status(200).send({ success: true, data: { status: 'REJECTED' } });
    }

    const sessionToken = jwt.sign({
      deviceId: session.deviceId,
      role: 'android',
      sessionId: pairingSessionId
    }, JWT_SECRET, { expiresIn: '7d' });

    const turnServers = generateTurnCredentials(session.deviceId);

    return reply.status(200).send({
      success: true,
      data: {
        pairingSessionId,
        sessionToken,
        turnServers,
        status: 'APPROVED'
      }
    });
  });

  // WebSocket Signaling Gateway
  fastify.get('/ws/signaling', { websocket: true }, (connection) => {
    const socket = connection.socket;
    let clientId = null;
    let role = null;
    let deviceId = null;

    socket.on('message', (rawData) => {
      try {
        const msg = JSON.parse(rawData.toString());

        switch (msg.type) {
          case 'AUTH_REQUEST': {
            try {
              const decoded = jwt.verify(msg.token, JWT_SECRET);
              clientId = `${decoded.role}_${decoded.deviceId}_${Date.now()}`;
              role = decoded.role;
              deviceId = decoded.deviceId;

              store.registerClient({ id: clientId, role, deviceId, ws: socket });
              socket.send(JSON.stringify({ type: 'AUTH_RESPONSE', success: true }));
            } catch (err) {
              socket.send(JSON.stringify({ type: 'AUTH_RESPONSE', success: false, error: 'Unauthorized' }));
              socket.close();
            }
            break;
          }

          case 'PAIR_REQUEST': {
            const session = store.getPairingSession(msg.pairingSessionId);
            if (!session) {
              socket.send(JSON.stringify({ type: 'ERROR', message: 'Pairing session expired' }));
              break;
            }
            session.desktopWs = socket;
            const android = store.findAndroidByDeviceId(session.deviceId);
            if (android && android.ws.readyState === 1) {
              android.ws.send(JSON.stringify(msg));
            }
            break;
          }

          case 'PAIR_APPROVAL': {
            const session = store.getPairingSession(msg.pairingSessionId);
            if (session && session.desktopWs && session.desktopWs.readyState === 1) {
              const turnServers = generateTurnCredentials(session.deviceId);
              session.desktopWs.send(JSON.stringify({
                type: 'PAIR_APPROVAL',
                pairingSessionId: msg.pairingSessionId,
                approved: true,
                turnServers
              }));
            }
            break;
          }

          case 'SDP_OFFER':
          case 'SDP_ANSWER':
          case 'ICE_CANDIDATE': {
            const session = store.getPairingSession(msg.sessionId || msg.pairingSessionId);
            if (session) {
              const targetWs = role === 'android' ? session.desktopWs : store.findAndroidByDeviceId(session.deviceId)?.ws;
              if (targetWs && targetWs.readyState === 1) {
                targetWs.send(JSON.stringify(msg));
              }
            }
            break;
          }

          case 'PING': {
            socket.send(JSON.stringify({ type: 'PONG', timestamp: Date.now() }));
            break;
          }
        }
      } catch (err) {
        fastify.log.error(err);
      }
    });

    socket.on('close', () => {
      if (clientId) store.unregisterClient(clientId);
    });
  });

  await fastify.listen({ port: PORT, host: HOST });
  console.log(`[Backend] SMR Standalone Signaling Backend running on http://${HOST}:${PORT}`);
}

start();
