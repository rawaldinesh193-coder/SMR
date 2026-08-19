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

// Multi-Device In-Memory Session Store (Supports up to 8 concurrent streams)
class MultiDeviceStore {
  constructor() {
    this.clients = new Map(); // socket -> client metadata
    this.androidDevices = new Map(); // deviceId -> { socket, info, registeredAt }
    this.desktopClients = new Set(); // Set of desktop sockets
    this.maxDevices = 8;
  }

  registerClient(socket, role, deviceId, deviceInfo = {}) {
    const client = {
      socket,
      role,
      deviceId: deviceId || (role === 'android' ? `device_${Date.now()}` : 'desktop_console'),
      deviceInfo,
      registeredAt: Date.now()
    };

    this.clients.set(socket, client);

    if (role === 'desktop') {
      this.desktopClients.add(socket);
    } else if (role === 'android') {
      if (this.androidDevices.size >= this.maxDevices && !this.androidDevices.has(client.deviceId)) {
        return { success: false, reason: 'Max 8 devices limit reached' };
      }
      this.androidDevices.set(client.deviceId, client);
    }

    this.broadcastDeviceList();
    return { success: true, deviceId: client.deviceId };
  }

  unregisterClient(socket) {
    const client = this.clients.get(socket);
    if (client) {
      if (client.role === 'desktop') {
        this.desktopClients.delete(socket);
      } else if (client.role === 'android') {
        this.androidDevices.delete(client.deviceId);
      }
      this.clients.delete(socket);
      this.broadcastDeviceList();
    }
  }

  getAndroidDevice(deviceId) {
    return this.androidDevices.get(deviceId);
  }

  getAllAndroidDevices() {
    return Array.from(this.androidDevices.values()).map(dev => ({
      deviceId: dev.deviceId,
      deviceInfo: dev.deviceInfo,
      online: dev.socket && dev.socket.readyState === 1
    }));
  }

  broadcastDeviceList() {
    const devices = this.getAllAndroidDevices();
    const payload = JSON.stringify({
      type: 'DEVICE_LIST_UPDATE',
      devices,
      count: devices.length,
      maxDevices: this.maxDevices
    });

    for (const desktopSocket of this.desktopClients) {
      if (desktopSocket && desktopSocket.readyState === 1) {
        try { desktopSocket.send(payload); } catch (e) {}
      }
    }
  }
}

const store = new MultiDeviceStore();

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
    service: 'SMR Multi-Device WebRTC Signaling Gateway (8 Devices)',
    version: '3.0.0',
    mode: 'multi_device_matrix_streaming',
    maxConcurrentDevices: 8,
    websocketSignaling: '/ws/signaling',
    connectDeepLink: '/connect'
  }));

  fastify.get('/api/v1/health', async () => ({
    status: 'ok',
    service: 'SMR 8-Device WebRTC Signaling Backend',
    activeDevices: store.androidDevices.size,
    maxDevices: 8,
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  }));

  // Hybrid Web Screen Streamer Landing Page
  fastify.get('/connect', async (req, reply) => {
    reply.type('text/html').send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>SMR Cyber Streamer — Multi-Device Web Streamer</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;600;700&family=Orbitron:wght@600;800&display=swap" rel="stylesheet">
      </head>
      <body class="bg-slate-950 text-slate-100 flex flex-col items-center justify-center h-screen p-6 text-center select-none font-mono">

        <div class="max-w-md w-full p-8 bg-slate-900/90 border border-emerald-500/40 rounded-3xl shadow-[0_0_35px_rgba(0,255,102,0.25)]">
          <div class="w-16 h-16 mx-auto mb-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-bold text-3xl animate-pulse">⚡</div>
          <h1 class="text-2xl font-bold text-emerald-400 mb-2 font-orbitron">MULTI-STREAM CONNECTOR</h1>
          <p class="text-xs text-slate-400 mb-6 leading-relaxed">
            Connect this device to the laptop matrix console (Up to 8 devices simultaneously).
          </p>

          <button id="web-stream-btn" onclick="startWebBrowserScreenStream()" class="w-full py-4 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-2xl text-sm shadow-[0_0_30px_rgba(0,255,102,0.4)] transition transform active:scale-95 mb-4 font-orbitron">
            STREAM SCREEN TO CONSOLE
          </button>

          <a href="smrmirror://connect" class="block text-xs text-emerald-400/80 hover:text-emerald-300 underline">
            Or Open Installed Native SMR Android App
          </a>
        </div>

        <script>
          let ws = null;
          let pc = null;
          const deviceId = "browser_phone_" + Math.floor(1000 + Math.random() * 9000);

          setTimeout(() => {
            window.location.href = "smrmirror://connect";
          }, 300);

          async function startWebBrowserScreenStream() {
            const btn = document.getElementById('web-stream-btn');
            btn.innerText = "REQUESTING SCREEN PERMISSION...";

            try {
              const stream = await navigator.mediaDevices.getDisplayMedia({
                video: { cursor: "always" },
                audio: false
              });

              btn.innerText = "CONNECTING WEBRTC MULTI-STREAM...";

              const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
              ws = new WebSocket(\`\${wsProtocol}//\${window.location.host}/ws/signaling\`);

              ws.onopen = () => {
                ws.send(JSON.stringify({
                  type: 'AUTH_REQUEST',
                  role: 'android',
                  deviceId: deviceId,
                  deviceInfo: { model: 'Browser Mobile', brand: 'WebStream' }
                }));
              };

              ws.onmessage = async (event) => {
                const msg = JSON.parse(event.data);

                if (msg.type === 'AUTH_RESPONSE') {
                  initWebRtc(stream);
                } else if (msg.type === 'SDP_ANSWER' && msg.deviceId === deviceId) {
                  if (pc) await pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: msg.sdp }));
                } else if (msg.type === 'ICE_CANDIDATE' && msg.deviceId === deviceId && msg.candidate) {
                  if (pc) await pc.addIceCandidate(new RTCIceCandidate(msg.candidate));
                }
              };

            } catch (err) {
              console.error("Browser screen capture error", err);
              alert("Browser screen capture prompt closed or not supported: " + err.message);
              btn.innerText = "STREAM SCREEN TO CONSOLE";
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
                ws.send(JSON.stringify({ type: 'ICE_CANDIDATE', deviceId: deviceId, candidate: e.candidate.toJSON() }));
              }
            };

            pc.createOffer().then(offer => {
              pc.setLocalDescription(offer);
              ws.send(JSON.stringify({ type: 'SDP_OFFER', deviceId: deviceId, sdp: offer.sdp, pairingSessionId: 'multi_session' }));
              document.getElementById('web-stream-btn').innerText = "STREAMING LIVE TO CONSOLE";
            });
          }
        </script>
      </body>
      </html>
    `);
  });

  fastify.post('/api/v1/pairing/create', async (req, reply) => {
    const { deviceInfo } = req.body || {};
    const dbDeviceId = deviceInfo?.deviceId || 'phone_' + crypto.randomUUID().slice(0, 8);
    const pairingSessionId = 'multi_session_' + crypto.randomUUID();
    const expiresAt = Date.now() + 24 * 60 * 60 * 1000;
    const androidJwt = jwt.sign({ deviceId: dbDeviceId, role: 'android' }, JWT_SECRET, { expiresIn: '7d' });

    return reply.status(201).send({
      success: true,
      data: {
        pairingSessionId,
        deviceId: dbDeviceId,
        expiresAt: new Date(expiresAt).toISOString(),
        androidJwt,
        deviceInfo
      }
    });
  });

  fastify.get('/ws/signaling', { websocket: true }, (connection) => {
    const socket = connection?.socket || connection?.raw || connection;
    if (!socket || typeof socket.on !== 'function') return;

    let clientMeta = null;

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
            const role = msg.role || 'desktop';
            const deviceId = msg.deviceId || (role === 'android' ? `device_${Date.now()}` : 'desktop_console');
            const res = store.registerClient(socket, role, deviceId, msg.deviceInfo || {});

            clientMeta = store.clients.get(socket);

            safeSend(socket, {
              type: 'AUTH_RESPONSE',
              success: res.success,
              deviceId: res.deviceId,
              reason: res.reason
            });

            if (role === 'desktop') {
              safeSend(socket, {
                type: 'DEVICE_LIST_UPDATE',
                devices: store.getAllAndroidDevices(),
                count: store.androidDevices.size,
                maxDevices: store.maxDevices
              });
            }
            break;
          }

          case 'AUTO_CONNECT':
          case 'PAIR_REQUEST': {
            const targetDeviceId = msg.deviceId;
            if (targetDeviceId) {
              const dev = store.getAndroidDevice(targetDeviceId);
              if (dev && dev.socket) {
                safeSend(dev.socket, {
                  type: 'PAIR_REQUEST',
                  deviceId: targetDeviceId,
                  desktopName: msg.desktopName || 'Laptop Console'
                });
              }
            } else {
              // Request stream from all connected devices
              for (const dev of store.androidDevices.values()) {
                if (dev.socket && dev.socket.readyState === 1) {
                  safeSend(dev.socket, {
                    type: 'PAIR_REQUEST',
                    deviceId: dev.deviceId,
                    desktopName: msg.desktopName || 'Laptop Console'
                  });
                }
              }
            }
            break;
          }

          case 'PAIR_APPROVAL': {
            const turnServers = generateTurnCredentials(msg.deviceId || 'device');
            const devId = msg.deviceId || clientMeta?.deviceId;
            for (const desktopSocket of store.desktopClients) {
              safeSend(desktopSocket, {
                type: 'PAIR_APPROVAL',
                deviceId: devId,
                approved: true,
                turnServers
              });
            }
            break;
          }

          case 'SDP_OFFER': {
            const devId = msg.deviceId || clientMeta?.deviceId;
            for (const desktopSocket of store.desktopClients) {
              safeSend(desktopSocket, {
                type: 'SDP_OFFER',
                deviceId: devId,
                sdp: msg.sdp,
                deviceInfo: clientMeta?.deviceInfo
              });
            }
            break;
          }

          case 'SDP_ANSWER': {
            const devId = msg.deviceId;
            const dev = store.getAndroidDevice(devId);
            if (dev && dev.socket) {
              safeSend(dev.socket, {
                type: 'SDP_ANSWER',
                deviceId: devId,
                sdp: msg.sdp
              });
            }
            break;
          }

          case 'ICE_CANDIDATE': {
            const devId = msg.deviceId || clientMeta?.deviceId;
            if (clientMeta?.role === 'android') {
              for (const desktopSocket of store.desktopClients) {
                safeSend(desktopSocket, {
                  type: 'ICE_CANDIDATE',
                  deviceId: devId,
                  candidate: msg.candidate
                });
              }
            } else if (clientMeta?.role === 'desktop') {
              const dev = store.getAndroidDevice(devId);
              if (dev && dev.socket) {
                safeSend(dev.socket, {
                  type: 'ICE_CANDIDATE',
                  deviceId: devId,
                  candidate: msg.candidate
                });
              }
            }
            break;
          }

          case 'REMOTE_INPUT': {
            const devId = msg.deviceId;
            const dev = store.getAndroidDevice(devId);
            if (dev && dev.socket) {
              safeSend(dev.socket, {
                type: 'REMOTE_INPUT',
                deviceId: devId,
                payload: msg.payload
              });
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
      store.unregisterClient(socket);
    });
  });

  await fastify.listen({ port: PORT, host: HOST });
  console.log(`[Backend] Multi-Device Gateway running on http://${HOST}:${PORT}`);
}

start();
