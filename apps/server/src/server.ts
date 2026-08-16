import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import websocket from '@fastify/websocket';
import { config } from './config/env.js';
import { healthRoutes } from './api/routes/health.js';
import { pairingRoutes } from './api/routes/pairing.js';
import { sessionRoutes } from './api/routes/sessions.js';
import { setupSignalingGateway } from './websocket/signalingGateway.js';

const fastify = Fastify({
  logger: {
    level: config.logLevel,
  }
});

async function startServer() {
  try {
    // 1. Plugins
    await fastify.register(cors, {
      origin: true,
      credentials: true
    });

    await fastify.register(rateLimit, {
      max: 200,
      timeWindow: '1 minute'
    });

    await fastify.register(websocket, {
      options: { maxPayload: 1048576 } // 1MB max payload
    });

    // 2. API Routes (Zero-Database Pure In-Memory Mode)
    await fastify.register(healthRoutes, { prefix: '/api/v1' });
    await fastify.register(pairingRoutes, { prefix: '/api/v1' });
    await fastify.register(sessionRoutes, { prefix: '/api/v1' });

    // 3. WebSocket Gateway
    setupSignalingGateway(fastify);

    // 4. Listen
    await fastify.listen({ port: config.port, host: config.host });
    fastify.log.info(`[Server] SMR Zero-Database Signaling Gateway running on http://${config.host}:${config.port}`);
  } catch (err) {
    fastify.log.error(err, '[Server] Fatal startup error');
    process.exit(1);
  }
}

startServer();
