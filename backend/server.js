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

// Zero-Database In-Memory Session Store with Direct Peer Mapping & Resilient Personal Auto-Connect
class InMemoryStore {
  constructor() {
    this.clients = new Map();
    this.pairingSessions = new Map();
    this.peerPairs = new Map();
    this.latestAndroidWs = null;
    this.latestDesktopWs = null;
  }

  registerClient(client) {
    this.clients.set(client.id, client);
    if (client.role === 'android') {
      this.latestAndroidWs = client.ws;
    } else if (client.role === 'desktop') {
      this.latestDesktopWs = client.ws;
    }
  }

  unregisterClient(clientId) {
    const client = this.clients.get(clientId);
    if (client) {
      if (this.latestAndroidWs === client.ws) this.latestAndroidWs = null;
      if (this.latestDesktopWs === client.ws) this.latestDesktopWs = null;
      this.peerPairs.delete(client.ws);
    }
    this.clients.delete(clientId);
  }

  getLatestAndroid() {
    if (this.latestAndroidWs && this.latestAndroidWs.readyState === 1) {
      return this.latestAndroidWs;
    }
    for (const client of this.clients.values()) {
      if (client.role === 'android' && client.ws && client.ws.readyState === 1) {
        this.latestAndroidWs = client.ws;
        return client.ws;
      }
    }
    return null;
  }

  getLatestDesktop() {
    if (this.latestDesktopWs && this.latestDesktopWs.readyState === 1) {
      return this.latestDesktopWs;
    }
    for (const client of this.clients.values()) {
      if (client.role === 'desktop' && client.ws && client.ws.readyState === 1) {
        this.latestDesktopWs = client.ws;
        return client.ws;
      }
    }
    return null;
  }

  createPairingSession(data) {
    this.pairingSessions.set(data.pairingSessionId, data);
  }

  getPairingSession(id) {
    return this.pairingSessions.get(id);
  }

  getPairingByCodeOrToken(codeOrToken) {
    if (!codeOrToken) return undefined;
    const cleanLookup = String(codeOrToken).replace(/[^A-Z0-9]/gi, '').toUpperCase();

    for (const s of this.pairingSessions.values()) {
      const cleanToken = String(s.pairingToken || '').replace(/[^A-Z0-9]/gi, '').toUpperCase();
      const cleanCode = String(s.pairingCode || '').replace(/[^A-Z0-9]/gi, '').toUpperCase();

      if (cleanToken === cleanLookup || cleanCode === cleanLookup) {
        return s;
      }
    }

    const activeSessions = Array.from(this.pairingSessions.values()).filter(s => Date.now() <= s.expiresAt);
    if (activeSessions.length > 0) {
      return activeSessions[activeSessions.length - 1];
    }

    return undefined;
  }

  linkPeers(ws1, ws2) {
    if (ws1 && ws2) {
      this.peerPairs.set(ws1, ws2);
      this.peerPairs.set(ws2, ws1);
    }
  }

  getTargetPeer(ws) {
    return this.peerPairs.get(ws);
  }
}

const store = new InMemoryStore();

function generatePairingCode() {
  const digits = crypto.randomInt(1000, 9999);
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const char1 = chars[crypto.randomInt(0, chars.length)];
  const char2 = chars[crypto.randomInt(0, chars.length)];
  return `${char1}${char2}-${digits}`;
}

function generateTurnCredentials(usernameSuffix = 'user') {
  const timestamp = Math.floor(Date.now() / 1000) + 86400;
  const username = `${timestamp}:${usernameSuffix}`;
  const hmac = crypto.createHmac('sha1', TURN_SECRET);
  hmac.update(username);
  const credential = hmac.digest('base64');

  return [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:global.stun.twilio.com:3478' },
    { urls: TURN_URL, username, credential }
  ];
}

const fastify = Fastify({ logger: { level: 'info' } });

async function start() {
  await fastify.register(cors, { origin: true, credentials: true });
  await fastify.register(rateLimit, { max: 500, timeWindow: '1 minute' });
  await fastify.register(websocket, { options: { maxPayload: 1048576 } });

  fastify.get('/', async () => ({
    status: 'online',
    service: 'SMR Mirror Personal WebRTC Signaling Gateway',
    version: '2.5.0',
    mode: 'browser_and_app_hybrid_streaming',
    websocketSignaling: '/ws/signaling',
    connectDeepLink: '/connect'
  }));

  fastify.get('/api/v1/health', async () => ({
    status: 'ok',
    service: 'SMR Hybrid WebRTC Signaling Backend',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  }));

  // Hybrid Web & Native App One-Click Connect Landing Route
  fastify.get('/connect', async (req, reply) => {
    reply.type('text/html').send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>SMR Cyber Mirror — Web Screen Streamer</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;600;700&family=Orbitron:wght@600;800&display=swap" rel="stylesheet">
      </head>
      <body class="bg-slate-950 text-slate-100 flex flex-col items-center justify-center h-screen p-6 text-center select-none font-mono">

        <div class="max-w-md w-full p-8 bg-slate-900/90 border border-emerald-500/40 rounded-3xl shadow-[0_0_35px_rgba(0,255,102,0.25)]">
          <div class="w-16 h-16 mx-auto mb-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-bold text-3xl animate-pulse">⚡</div>
          <h1 class="text-2xl font-bold text-emerald-400 mb-2 font-orbitron">SMR CYBER STREAMER</h1>
          <p class="text-xs text-slate-400 mb-6 leading-relaxed">
            No app installed? Stream your phone screen directly from this browser to your laptop in 1 tap.
          </p>

          <button id="web-stream-btn" onclick="startWebBrowserScreenStream()" class="w-full py-4 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-2xl text-sm shadow-[0_0_30px_rgba(0,255,102,0.4)] transition transform active:scale-95 mb-4">
            ⚡ STREAM SCREEN IN BROWSER (NO APP NEEDED)
          </button>

          <a href="smrmirror://connect" class="block text-xs text-emerald-400/80 hover:text-emerald-300 underline">
            Or Open Installed Native SMR Android App
          </a>
        </div>

        <script>
          let ws = null;
          let pc = null;

          // Try launching native Android app if installed
          setTimeout(() => {
            window.location.href = "smrmirror://connect";
          }, 300);

          async function startWebBrowserScreenStream() {
            const btn = document.getElementById('web-stream-btn');
            btn.innerText = "REQUESTING BROWSER SCREEN PERMISSION...";

            try {
              const stream = await navigator.mediaDevices.getDisplayMedia({
                video: { cursor: "always" },
                audio: false
              });

              btn.innerText = "CONNECTING WEBRTC TO LAPTOP...";

              const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
              ws = new WebSocket(\`\${wsProtocol}//\${window.location.host}/ws/signaling\`);

              ws.onopen = () => {
                ws.send(JSON.stringify({ type: 'AUTH_REQUEST', role: 'android', deviceId: 'browser_mobile_phone' }));
              };

              ws.onmessage = async (event) => {
                const msg = JSON.parse(event.data);

                if (msg.type === 'AUTH_RESPONSE') {
                  initWebRtc(stream);
                } else if (msg.type === 'SDP_ANSWER') {
                  if (pc) await pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: msg.sdp }));
                } else if (msg.type === 'ICE_CANDIDATE' && msg.candidate) {
                  if (pc) await pc.addIceCandidate(new RTCIceCandidate(msg.candidate));
                }
              };

            } catch (err) {
              console.error("Browser screen capture error", err);
              alert("Browser screen capture prompt closed or not supported by this browser: " + err.message);
              btn.innerText = "⚡ STREAM SCREEN IN BROWSER (NO APP NEEDED)";
            }
          }

          function initWebRtc(stream) {
            pc = new RTCPeerConnection({
              iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                { urls: 'stun:global.stun.twilio.com:3478' }
              ]
            });

            stream.getTracks().forEach(track => pc.addTrack(track, stream));

            pc.onicecandidate = (e) => {
              if (e.candidate && ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'ICE_CANDIDATE', candidate: e.candidate.toJSON() }));
              }
            };

            pc.createOffer().then(offer => {
              pc.setLocalDescription(offer);
              ws.send(JSON.stringify({ type: 'SDP_OFFER', sdp: offer.sdp, pairingSessionId: 'personal_session' }));
              document.getElementById('web-stream-btn').innerText = "🟢 STREAMING LIVE TO LAPTOP";
            });
          }
        </script>
      </body>
      </html>
    `);
  });

  fastify.post('/api/v1/pairing/create', async (req, reply) => {
    const { deviceInfo } = req.body || {};
    const dbDeviceId = deviceInfo?.deviceId || 'personal_phone';
    const pairingSessionId = 'personal_session_' + crypto.randomUUID();
    const pairingCode = generatePairingCode();
    const pairingToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + 24 * 60 * 60 * 1000;

    store.createPairingSession({
      pairingSessionId,
      deviceId: dbDeviceId,
      pairingToken,
      pairingCode,
      expiresAt,
      status: 'PENDING',
      deviceInfo
    });

    const androidJwt = jwt.sign({ deviceId: dbDeviceId, role: 'android' }, JWT_SECRET, { expiresIn: '7d' });

    return reply.status(201).send({
      success: true,
      data: {
        pairingSessionId,
        pairingCode,
        pairingToken,
        expiresAt: new Date(expiresAt).toISOString(),
        androidJwt,
        deviceInfo
      }
    });
  });

  fastify.post('/api/v1/pairing/claim', async (req, reply) => {
    const { pairingCode, desktopInfo } = req.body || {};
    const session = store.getPairingByCodeOrToken(pairingCode) || Array.from(store.pairingSessions.values())[0] || {
      pairingSessionId: 'personal_session_default',
      deviceId: 'personal_phone'
    };

    const desktopJwt = jwt.sign({
      deviceId: session.deviceId,
      role: 'desktop',
      sessionId: session.pairingSessionId
    }, JWT_SECRET, { expiresIn: '7d' });

    return reply.status(200).send({
      success: true,
      data: {
        pairingSessionId: session.pairingSessionId,
        desktopJwt,
        deviceId: session.deviceId,
        status: 'WAITING_FOR_APPROVAL'
      }
    });
  });

  fastify.get('/ws/signaling', { websocket: true }, (connection) => {
    const socket = connection?.socket || connection?.raw || connection;
    if (!socket || typeof socket.on !== 'function') return;

    let clientId = null;
    let role = null;
    let deviceId = null;

    const safeSend = (wsTarget, payload) => {
      try {
        if (wsTarget && typeof wsTarget.send === 'function' && wsTarget.readyState === 1) {
          wsTarget.send(typeof payload === 'string' ? payload : JSON.stringify(payload));
        }
      } catch (e) {
        fastify.log.error('WebSocket send error', e);
      }
    };

    socket.on('message', (rawData) => {
      try {
        const msg = JSON.parse(rawData.toString());

        switch (msg.type) {
          case 'AUTH_REQUEST': {
            role = msg.role || 'desktop';
            deviceId = msg.deviceId || (role === 'android' ? 'personal_phone' : 'personal_laptop');
            clientId = `${role}_${deviceId}_${Date.now()}`;

            store.registerClient({ id: clientId, role, deviceId, ws: socket });
            safeSend(socket, { type: 'AUTH_RESPONSE', success: true });

            if (role === 'desktop') {
              const androidWs = store.getLatestAndroid();
              if (androidWs) {
                store.linkPeers(socket, androidWs);
                safeSend(socket, { type: 'PHONE_STATUS', status: 'ONLINE', message: 'Personal phone ready for instant streaming' });
              }
            } else if (role === 'android') {
              const desktopWs = store.getLatestDesktop();
              if (desktopWs) {
                store.linkPeers(socket, desktopWs);
                safeSend(desktopWs, { type: 'PHONE_STATUS', status: 'ONLINE', message: 'Personal phone ready for instant streaming' });
              }
            }
            break;
          }

          case 'AUTO_CONNECT':
          case 'PAIR_REQUEST': {
            const androidWs = store.getLatestAndroid();
            if (androidWs) {
              store.linkPeers(socket, androidWs);
              safeSend(androidWs, {
                type: 'PAIR_REQUEST',
                pairingSessionId: msg.pairingSessionId || 'personal_session',
                desktopName: msg.desktopName || 'Personal Laptop'
              });
            } else {
              safeSend(socket, { type: 'ERROR', message: 'Smartphone is offline. Open SMR app on phone or tap browser stream.' });
            }
            break;
          }

          case 'PAIR_APPROVAL': {
            const turnServers = generateTurnCredentials('personal_device');
            const targetWs = store.getTargetPeer(socket) || store.getLatestDesktop();
            if (targetWs) {
              store.linkPeers(socket, targetWs);
              safeSend(targetWs, {
                type: 'PAIR_APPROVAL',
                pairingSessionId: msg.pairingSessionId || 'personal_session',
                approved: true,
                turnServers
              });
            }
            break;
          }

          case 'SDP_OFFER':
          case 'SDP_ANSWER':
          case 'ICE_CANDIDATE':
          case 'REMOTE_INPUT': {
            let targetWs = store.getTargetPeer(socket);
            if (!targetWs || targetWs.readyState !== 1) {
              targetWs = role === 'android' ? store.getLatestDesktop() : store.getLatestAndroid();
              if (targetWs) store.linkPeers(socket, targetWs);
            }
            if (targetWs) {
              safeSend(targetWs, msg);
            }
            break;
          }

          case 'PING': {
            safeSend(socket, { type: 'PONG', timestamp: Date.now() });
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
  console.log(`[Backend] Personal WebRTC Gateway running on http://${HOST}:${PORT}`);
}

start();
