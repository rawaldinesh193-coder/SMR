# Security Model & Threat Protections

## Security Principles

1. **Zero Trust Signaling**:
   - The signaling backend acts purely as an authentication and SDP/ICE broker. Media frames and control events never pass through the backend database or logs.

2. **Cryptographic Session Pairing**:
   - Pairing tokens generated with 256-bit entropy (`crypto.randomBytes(32)`).
   - Short-lived pairing sessions (5-minute expiration).
   - Single-use claim restriction to prevent replay attacks.

3. **Transport & Media Security**:
   - WebRTC DTLS (Datagram Transport Layer Security) for key exchange.
   - SRTP (Secure Real-time Transport Protocol) for video payload encryption.
   - Ephemeral HMAC-SHA1 credentials for TURN relay servers.

4. **Android On-Device Key Security**:
   - Android `EncryptedSharedPreferences` backed by `MasterKey` AES-256-GCM hardware-backed keystore.

5. **Instant Revocation**:
   - `/api/v1/sessions/revoke` endpoint immediately terminates WebSocket handles and closes active WebRTC PeerConnections.
