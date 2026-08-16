# SMR Mirror — Industrial-Grade Phone Screen Mirroring & Remote Control Platform

[![Production Security](https://img.shields.io/badge/Security-DTLS--SRTP%20%7C%20Keystore-blue.svg)](#security)
[![Architecture](https://img.shields.io/badge/Architecture-WebRTC%20P2P%20%7C%20Fastify%20%7C%20Electron-emerald.svg)](#architecture)
[![Android](https://img.shields.io/badge/Android-API%2026%2B%20%7C%20Kotlin%20%7C%20Compose-violet.svg)](#android-setup)

SMR Mirror is an enterprise-grade monorepo platform designed for low-latency smartphone screen mirroring, remote gesture/input control, QR & short-code pairing, and session security between Android devices and Desktop (Electron/Web) clients.

---

## Technical Architecture Highlights

- **WebRTC PeerConnection Media Pipeline**: Android `MediaProjection` captures hardware VP8/H.264 video frames streamed directly over P2P WebRTC transport (`DTLS-SRTP`).
- **Low-Latency Input Control**: Mouse, touch gestures, swipes, and global actions (`Back`, `Home`, `Recents`) are serialized over WebRTC `RTCDataChannel` and executed via Android `AccessibilityService`.
- **Ephemeral Credentials**: Dynamic TURN relay credentials generated using Coturn REST API HMAC-SHA1 algorithms.
- **Secure Key Store**: Cryptographic pairing tokens (256-bit entropy) and JWT tokens stored securely via Android `EncryptedSharedPreferences` / `MasterKey`.
- **Coordinate Transformation Engine**: Mathematical viewport letterboxing, zoom, aspect ratio, and rotation normalization engine (`CoordinateTransformService`).

---

## Monorepo Layout

```
/ (monorepo root)
├── apps/
│   ├── android/       # Kotlin, Jetpack Compose, WebRTC, MediaProjection, AccessibilityService
│   ├── desktop/       # Electron, React, TypeScript, Vite, WebRTC Receiver, DataChannel
│   └── server/        # Fastify, WebSocket Signaling, PostgreSQL, Redis, Pino Logging
├── packages/
│   ├── protocol/      # WebSocket & DataChannel JSON/Binary Protocol Specs
│   ├── shared-types/  # Shared TypeScript & Kotlin Domain Interfaces
│   └── validation/    # Zod API & WebSocket payload validation schemas
├── infrastructure/
│   ├── docker/        # Production Dockerfile for Signaling Server
│   ├── docker-compose.yml # PostgreSQL, Redis, Coturn, Signaling Server
│   └── turn/          # Coturn turnserver.conf configuration
└── docs/              # Comprehensive Production Architecture & Operation Guides
```

---

## Quick Start Guide

### Prerequisites
- Node.js >= 18.0.0 & pnpm >= 8.0.0
- Android Studio / Android SDK (Min API 26, Target API 34)
- Docker & Docker Compose

### 1. Backend Signaling Infrastructure
```bash
# Copy environment variables template
cp .env.example .env

# Start PostgreSQL, Redis, Coturn, and Fastify Server with Docker
cd infrastructure
docker-compose up -d --build
```

### 2. Desktop Application
```bash
# Build shared packages and launch Desktop Electron app
pnpm install
pnpm build
pnpm --filter @smr/desktop dev
```

### 3. Android Application
Open `/apps/android` in Android Studio and run on an Android 8.0+ device or emulator.

---

## Documentation Index

- 📖 [System Architecture](docs/ARCHITECTURE.md)
- 🔒 [Security Model](docs/SECURITY.md)
- 🔌 [REST API Specification](docs/API.md)
- 💬 [WebSocket Protocol](docs/WEBSOCKET_PROTOCOL.md)
- 📱 [Android Setup Guide](docs/ANDROID_SETUP.md)
- 💻 [Desktop Setup Guide](docs/DESKTOP_SETUP.md)
- 🚀 [Deployment Guide](docs/DEPLOYMENT.md)
- 🗄️ [Database Schema & Migrations](docs/DATABASE.md)
- 🧪 [Testing & Verification](docs/TESTING.md)
- 🛠️ [Troubleshooting Guide](docs/TROUBLESHOOTING.md)
- 🛡️ [Privacy Policy](docs/PRIVACY.md)
- 🤝 [Contributing Guidelines](docs/CONTRIBUTING.md)

---

## License
Commercial Production Proprietary Software — All Rights Reserved.
