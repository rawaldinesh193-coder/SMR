import { WebSocket } from 'ws';

export interface DeviceRecord {
  id: string;
  deviceName: string;
  model: string;
  androidVersion: string;
  fingerprint: string;
  createdAt: Date;
}

export interface ActiveClient {
  id: string;
  role: 'android' | 'desktop';
  deviceId: string;
  ws: WebSocket;
  authenticated: boolean;
}

export interface PairingSessionRecord {
  pairingSessionId: string;
  deviceId: string;
  pairingToken: string;
  pairingCode: string;
  expiresAt: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
  desktopWs?: WebSocket;
  desktopInfo?: unknown;
}

export interface ConnectionSessionRecord {
  id: string;
  deviceId: string;
  desktopInfo: unknown;
  status: 'ACTIVE' | 'CLOSED' | 'REVOKED';
  startedAt: Date;
}

class InMemorySessionStore {
  private devices: Map<string, DeviceRecord> = new Map();
  private clients: Map<string, ActiveClient> = new Map();
  private pairingSessions: Map<string, PairingSessionRecord> = new Map();
  private connectionSessions: Map<string, ConnectionSessionRecord> = new Map();

  // Device Management
  public registerDevice(device: Omit<DeviceRecord, 'createdAt'>): DeviceRecord {
    const existing = Array.from(this.devices.values()).find(d => d.fingerprint === device.fingerprint);
    if (existing) {
      existing.deviceName = device.deviceName;
      existing.model = device.model;
      existing.androidVersion = device.androidVersion;
      return existing;
    }
    const record: DeviceRecord = { ...device, createdAt: new Date() };
    this.devices.set(device.id, record);
    return record;
  }

  // Active Client Sockets
  public registerClient(client: ActiveClient): void {
    this.clients.set(client.id, client);
  }

  public unregisterClient(clientId: string): void {
    this.clients.delete(clientId);
  }

  public findAndroidByDeviceId(deviceId: string): ActiveClient | undefined {
    for (const client of this.clients.values()) {
      if (client.role === 'android' && client.deviceId === deviceId) {
        return client;
      }
    }
    return undefined;
  }

  // Pairing Sessions
  public createPairingSession(data: PairingSessionRecord): void {
    this.pairingSessions.set(data.pairingSessionId, data);
  }

  public getPairingSession(pairingSessionId: string): PairingSessionRecord | undefined {
    return this.pairingSessions.get(pairingSessionId);
  }

  public getPairingSessionByTokenOrCode(tokenOrCode: string): PairingSessionRecord | undefined {
    for (const session of this.pairingSessions.values()) {
      if (session.pairingToken === tokenOrCode || session.pairingCode === tokenOrCode) {
        return session;
      }
    }
    return undefined;
  }

  public removePairingSession(pairingSessionId: string): void {
    this.pairingSessions.delete(pairingSessionId);
  }

  // Connection Sessions
  public addConnectionSession(session: ConnectionSessionRecord): void {
    this.connectionSessions.set(session.id, session);
  }

  public revokeConnectionSession(sessionId: string): boolean {
    const session = this.connectionSessions.get(sessionId);
    if (session) {
      session.status = 'REVOKED';
      return true;
    }
    return false;
  }

  public getActiveConnectionSessions(): ConnectionSessionRecord[] {
    return Array.from(this.connectionSessions.values()).filter(s => s.status === 'ACTIVE');
  }
}

export const sessionStore = new InMemorySessionStore();
