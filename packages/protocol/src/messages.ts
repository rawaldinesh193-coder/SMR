/**
 * WebSocket Protocol Message Definitions for SMR Phone Mirroring Platform
 */

export enum WebSocketMessageType {
  // Connection / Auth
  AUTH_REQUEST = 'AUTH_REQUEST',
  AUTH_RESPONSE = 'AUTH_RESPONSE',

  // Pairing Flow
  PAIR_REQUEST = 'PAIR_REQUEST',
  PAIR_APPROVAL = 'PAIR_APPROVAL',
  PAIR_REJECTED = 'PAIR_REJECTED',

  // WebRTC Signaling
  SDP_OFFER = 'SDP_OFFER',
  SDP_ANSWER = 'SDP_ANSWER',
  ICE_CANDIDATE = 'ICE_CANDIDATE',

  // Session Control
  SESSION_READY = 'SESSION_READY',
  SESSION_REVOKED = 'SESSION_REVOKED',
  DISCONNECT = 'DISCONNECT',

  // Heartbeat
  PING = 'PING',
  PONG = 'PONG',

  // Errors
  ERROR = 'ERROR'
}

export interface AuthRequestMessage {
  type: WebSocketMessageType.AUTH_REQUEST;
  token: string;
  role: 'android' | 'desktop';
  deviceId: string;
}

export interface AuthResponseMessage {
  type: WebSocketMessageType.AUTH_RESPONSE;
  success: boolean;
  error?: string;
}

export interface PairRequestMessage {
  type: WebSocketMessageType.PAIR_REQUEST;
  pairingSessionId: string;
  desktopName: string;
  desktopFingerprint: string;
}

export interface PairApprovalMessage {
  type: WebSocketMessageType.PAIR_APPROVAL;
  pairingSessionId: string;
  approved: boolean;
  sessionToken?: string;
  turnServers?: Array<{
    urls: string | string[];
    username?: string;
    credential?: string;
  }>;
}

export interface PairRejectedMessage {
  type: WebSocketMessageType.PAIR_REJECTED;
  pairingSessionId: string;
  reason: string;
}

export interface SdpOfferMessage {
  type: WebSocketMessageType.SDP_OFFER;
  sessionId: string;
  sdp: string;
}

export interface SdpAnswerMessage {
  type: WebSocketMessageType.SDP_ANSWER;
  sessionId: string;
  sdp: string;
}

export interface IceCandidateMessage {
  type: WebSocketMessageType.ICE_CANDIDATE;
  sessionId: string;
  candidate: {
    candidate: string;
    sdpMid: string | null;
    sdpMLineIndex: number | null;
  };
}

export interface SessionRevokedMessage {
  type: WebSocketMessageType.SESSION_REVOKED;
  sessionId: string;
  reason: string;
}

export interface DisconnectMessage {
  type: WebSocketMessageType.DISCONNECT;
  sessionId: string;
  reason?: string;
}

export interface PingMessage {
  type: WebSocketMessageType.PING;
  timestamp: number;
}

export interface PongMessage {
  type: WebSocketMessageType.PONG;
  timestamp: number;
}

export interface ErrorMessage {
  type: WebSocketMessageType.ERROR;
  code: string;
  message: string;
}

export type WebSocketMessage =
  | AuthRequestMessage
  | AuthResponseMessage
  | PairRequestMessage
  | PairApprovalMessage
  | PairRejectedMessage
  | SdpOfferMessage
  | SdpAnswerMessage
  | IceCandidateMessage
  | SessionRevokedMessage
  | DisconnectMessage
  | PingMessage
  | PongMessage
  | ErrorMessage;
