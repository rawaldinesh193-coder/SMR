import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { config } from '../config/env.js';

export interface DeviceTokenPayload {
  deviceId: string;
  fingerprint: string;
  role: 'android' | 'desktop';
  sessionId?: string;
}

export function generateJwtToken(payload: DeviceTokenPayload, expiresIn = '24h'): string {
  return jwt.sign(payload, config.jwtSecret, { expiresIn });
}

export function verifyJwtToken(token: string): DeviceTokenPayload {
  return jwt.verify(token, config.jwtSecret) as DeviceTokenPayload;
}

export function generatePairingCode(): string {
  // Generate 6-digit uppercase alphanumeric code e.g. "SMR-8924"
  const digits = crypto.randomInt(1000, 9999);
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const char1 = chars[crypto.randomInt(0, chars.length)];
  const char2 = chars[crypto.randomInt(0, chars.length)];
  return `${char1}${char2}-${digits}`;
}

export function generatePairingToken(): string {
  return crypto.randomBytes(32).toString('hex');
}
