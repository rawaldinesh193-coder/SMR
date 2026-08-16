import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });
dotenv.config(); // fallback to local .env

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  host: process.env.HOST || '0.0.0.0',
  nodeEnv: process.env.NODE_ENV || 'development',
  logLevel: process.env.LOG_LEVEL || 'info',

  db: {
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
    database: process.env.POSTGRES_DB || 'smr_mirroring',
    user: process.env.POSTGRES_USER || 'postgres',
    password: process.env.POSTGRES_PASSWORD || 'postgres_secure_password_123',
  },

  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || '',
  },

  jwtSecret: process.env.JWT_SECRET || 'super_secret_jwt_key_minimum_32_chars_long_production',
  pairingSecret: process.env.PAIRING_TOKEN_SECRET || 'pairing_secret_key_random_256bit_entropy',

  turn: {
    stunUrl: process.env.STUN_SERVER_URL || 'stun:stun.l.google.com:19302',
    turnUrl: process.env.TURN_SERVER_URL || 'turn:localhost:3478',
    secret: process.env.TURN_SHARED_SECRET || 'coturn_shared_secret_key_for_hmac_auth',
    ttlSec: parseInt(process.env.TURN_CREDENTIAL_TTL_SEC || '86400', 10),
  }
};
