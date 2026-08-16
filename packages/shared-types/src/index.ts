/**
 * Shared Domain Types across Android, Desktop, and Backend Signaling
 */

export interface DeviceInfo {
  deviceId: string;
  deviceName: string;
  model: string;
  androidVersion: string;
  sdkInt: number;
  fingerprint: string;
  screenWidth: number;
  screenHeight: number;
  screenDensity: number;
  rotation: number; // 0, 90, 180, 270
  accessibilityEnabled: boolean;
}

export interface DesktopClientInfo {
  clientId: string;
  clientName: string;
  os: string;
  appVersion: string;
  browser: string;
  ipAddress?: string;
}

export enum SessionState {
  IDLE = 'IDLE',
  PAIRING = 'PAIRING',
  WAITING_FOR_APPROVAL = 'WAITING_FOR_APPROVAL',
  APPROVED = 'APPROVED',
  SIGNALING = 'SIGNALING',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  RECONNECTING = 'RECONNECTING',
  DISCONNECTING = 'DISCONNECTING',
  DISCONNECTED = 'DISCONNECTED',
  EXPIRED = 'EXPIRED',
  FAILED = 'FAILED'
}

export interface PairingSessionDetails {
  pairingSessionId: string;
  pairingCode: string;
  pairingToken: string;
  pairingUrl: string;
  qrCodeUrl?: string;
  expiresAt: string; // ISO 8601
  deviceInfo: DeviceInfo;
}

export interface ConnectionDiagnostics {
  rttMs: number;
  packetLossRate: number;
  jitterMs: number;
  videoBitrateKbps: number;
  videoFps: number;
  videoWidth: number;
  videoHeight: number;
  videoCodec: string;
  audioCodec?: string;
  iceState: string;
  connectionType: 'P2P_DIRECT' | 'TURN_RELAY' | 'UNKNOWN';
  candidatePair?: {
    localCandidate: string;
    remoteCandidate: string;
  };
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}
