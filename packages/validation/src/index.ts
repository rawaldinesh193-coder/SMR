import { z } from 'zod';

export const DeviceInfoSchema = z.object({
  deviceId: z.string().min(1),
  deviceName: z.string().min(1),
  model: z.string().min(1),
  androidVersion: z.string().min(1),
  sdkInt: z.number().int().positive(),
  fingerprint: z.string().min(1),
  screenWidth: z.number().int().positive(),
  screenHeight: z.number().int().positive(),
  screenDensity: z.number().positive(),
  rotation: z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]),
  accessibilityEnabled: z.boolean()
});

export const CreatePairingSessionSchema = z.object({
  deviceInfo: DeviceInfoSchema
});

export const ClaimPairingSessionSchema = z.object({
  pairingCode: z.string().min(6).max(12).optional(),
  pairingToken: z.string().min(10).optional(),
  desktopInfo: z.object({
    clientName: z.string().min(1),
    os: z.string().min(1),
    appVersion: z.string().min(1),
    browser: z.string().min(1)
  })
}).refine(data => data.pairingCode || data.pairingToken, {
  message: 'Either pairingCode or pairingToken must be provided'
});

export const ApprovePairingSchema = z.object({
  pairingSessionId: z.string().uuid(),
  approved: z.boolean()
});

export const RevokeSessionSchema = z.object({
  sessionId: z.string().uuid(),
  reason: z.string().optional()
});
