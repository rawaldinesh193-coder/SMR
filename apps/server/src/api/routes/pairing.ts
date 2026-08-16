import { FastifyInstance } from 'fastify';
import QRCode from 'qrcode';
import crypto from 'crypto';
import { CreatePairingSessionSchema, ClaimPairingSessionSchema, ApprovePairingSchema } from '@smr/validation';
import { generatePairingCode, generatePairingToken, generateJwtToken } from '../../services/auth.js';
import { sessionStore } from '../../services/sessionStore.js';
import { generateTurnCredentials } from '../../services/turn.js';

export async function pairingRoutes(fastify: FastifyInstance): Promise<void> {
  // Create pairing session (Zero Database — Pure In-Memory)
  fastify.post('/pairing/create', async (req, reply) => {
    const parseResult = CreatePairingSessionSchema.safeParse(req.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'Invalid device information payload',
          details: parseResult.error.format()
        }
      });
    }

    const { deviceInfo } = parseResult.data;
    const dbDeviceId = deviceInfo.deviceId || crypto.randomUUID();

    // Register in memory
    sessionStore.registerDevice({
      id: dbDeviceId,
      deviceName: deviceInfo.deviceName,
      model: deviceInfo.model,
      androidVersion: deviceInfo.androidVersion,
      fingerprint: deviceInfo.fingerprint
    });

    // Generate pairing code & tokens
    const pairingSessionId = crypto.randomUUID();
    const pairingCode = generatePairingCode();
    const pairingToken = generatePairingToken();
    const expiresAt = Date.now() + 5 * 60 * 1000;

    sessionStore.createPairingSession({
      pairingSessionId,
      deviceId: dbDeviceId,
      pairingToken,
      pairingCode,
      expiresAt,
      status: 'PENDING'
    });

    const hostHeader = req.headers.host || 'localhost:4000';
    const protocol = req.protocol || 'http';
    const pairingUrl = `${protocol}://${hostHeader}/pair?token=${pairingToken}`;
    const qrCodeUrl = await QRCode.toDataURL(pairingUrl);

    const androidJwt = generateJwtToken({
      deviceId: dbDeviceId,
      fingerprint: deviceInfo.fingerprint,
      role: 'android'
    });

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

  // Claim pairing session (Zero Database)
  fastify.post('/pairing/claim', async (req, reply) => {
    const parseResult = ClaimPairingSessionSchema.safeParse(req.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'INVALID_REQUEST', message: 'Invalid claim payload', details: parseResult.error.format() }
      });
    }

    const { pairingCode, pairingToken, desktopInfo } = parseResult.data;
    const lookup = pairingToken || pairingCode;
    if (!lookup) {
      return reply.status(400).send({ success: false, error: { code: 'INVALID_REQUEST', message: 'Code or Token required' } });
    }

    const session = sessionStore.getPairingSessionByTokenOrCode(lookup);
    if (!session || Date.now() > session.expiresAt) {
      return reply.status(404).send({
        success: false,
        error: { code: 'PAIRING_SESSION_EXPIRED', message: 'Pairing session is invalid or expired' }
      });
    }

    session.desktopInfo = desktopInfo;

    const desktopJwt = generateJwtToken({
      deviceId: session.deviceId,
      fingerprint: desktopInfo.clientName,
      role: 'desktop',
      sessionId: session.pairingSessionId
    });

    return reply.status(200).send({
      success: true,
      data: {
        pairingSessionId: session.pairingSessionId,
        desktopJwt,
        status: 'WAITING_FOR_APPROVAL'
      }
    });
  });

  // Approve pairing (Zero Database)
  fastify.post('/pairing/approve', async (req, reply) => {
    const parseResult = ApprovePairingSchema.safeParse(req.body);
    if (!parseResult.success) {
      return reply.status(400).send({ success: false, error: { code: 'INVALID_REQUEST', message: 'Invalid request' } });
    }

    const { pairingSessionId, approved } = parseResult.data;
    const session = sessionStore.getPairingSession(pairingSessionId);

    if (!session) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Pairing session not found' } });
    }

    if (!approved) {
      session.status = 'REJECTED';
      sessionStore.removePairingSession(pairingSessionId);
      return reply.status(200).send({
        success: true,
        data: { status: 'REJECTED' }
      });
    }

    session.status = 'APPROVED';
    const sessionToken = generateJwtToken({
      deviceId: session.deviceId,
      fingerprint: session.pairingToken,
      role: 'android',
      sessionId: pairingSessionId
    }, '7d');

    sessionStore.addConnectionSession({
      id: pairingSessionId,
      deviceId: session.deviceId,
      desktopInfo: session.desktopInfo,
      status: 'ACTIVE',
      startedAt: new Date()
    });

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
}
