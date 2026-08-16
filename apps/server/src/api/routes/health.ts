import { FastifyInstance } from 'fastify';
import { sessionStore } from '../../services/sessionStore.js';

export async function healthRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/health', async (_req, reply) => {
    return reply.status(200).send({
      status: 'ok',
      mode: 'zero_database_in_memory',
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    });
  });

  fastify.get('/ready', async (_req, reply) => {
    return reply.status(200).send({
      status: 'ready',
      mode: 'zero_database_in_memory'
    });
  });

  fastify.get('/metrics', async (_req, reply) => {
    return reply.status(200).send({
      mode: 'zero_database_in_memory',
      activeSessions: sessionStore.getActiveConnectionSessions().length,
      memoryUsage: process.memoryUsage()
    });
  });
}
