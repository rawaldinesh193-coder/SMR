import { FastifyInstance } from 'fastify';
import { RevokeSessionSchema } from '@smr/validation';
import { sessionStore } from '../../services/sessionStore.js';

export async function sessionRoutes(fastify: FastifyInstance): Promise<void> {
  // Revoke session instantly (Zero Database)
  fastify.post('/sessions/revoke', async (req, reply) => {
    const parseResult = RevokeSessionSchema.safeParse(req.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'INVALID_REQUEST', message: 'Invalid revocation payload' }
      });
    }

    const { sessionId, reason } = parseResult.data;
    sessionStore.revokeConnectionSession(sessionId);
    sessionStore.removePairingSession(sessionId);

    return reply.status(200).send({
      success: true,
      data: {
        sessionId,
        status: 'REVOKED',
        message: reason || 'Session revoked by user request'
      }
    });
  });

  // Get active device sessions (Zero Database)
  fastify.get('/sessions/active', async (_req, reply) => {
    const active = sessionStore.getActiveConnectionSessions();
    return reply.status(200).send({
      success: true,
      data: active
    });
  });
}
