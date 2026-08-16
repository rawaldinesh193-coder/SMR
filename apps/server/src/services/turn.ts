import crypto from 'crypto';
import { config } from '../config/env.js';

export interface TurnServerConfig {
  urls: string | string[];
  username?: string;
  credential?: string;
}

export function generateTurnCredentials(usernameSuffix = 'user'): TurnServerConfig[] {
  const timestamp = Math.floor(Date.now() / 1000) + config.turn.ttlSec;
  const username = `${timestamp}:${usernameSuffix}`;
  
  const hmac = crypto.createHmac('sha1', config.turn.secret);
  hmac.update(username);
  const credential = hmac.digest('base64');

  return [
    {
      urls: config.turn.stunUrl,
    },
    {
      urls: config.turn.turnUrl,
      username,
      credential,
    }
  ];
}
