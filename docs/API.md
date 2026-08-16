# REST API Reference Manual

Base URL: `http://<host>:4000/api/v1`

---

### 1. Health & Readiness

#### `GET /health`
Returns system uptime and health status.

#### `GET /ready`
Verifies PostgreSQL database connection pool.

---

### 2. Pairing Management

#### `POST /pairing/create`
Generates a new pairing session for an Android smartphone.

- **Request Body**:
  ```json
  {
    "deviceInfo": {
      "deviceId": "dev_99102",
      "deviceName": "Pixel 8 Pro",
      "model": "Pixel 8 Pro",
      "androidVersion": "14",
      "sdkInt": 34,
      "fingerprint": "google/pixel8pro/14:user",
      "screenWidth": 1440,
      "screenHeight": 3120,
      "screenDensity": 3.0,
      "rotation": 0,
      "accessibilityEnabled": true
    }
  }
  ```

- **Response (201 Created)**:
  ```json
  {
    "success": true,
    "data": {
      "pairingSessionId": "c4b82f09-3221-4f9e-9d22-123456789abc",
      "pairingCode": "SMR-8924",
      "pairingToken": "e7f891...",
      "pairingUrl": "http://localhost:4000/pair?token=e7f891...",
      "qrCodeUrl": "data:image/png;base64,...",
      "expiresAt": "2026-08-16T16:00:00.000Z",
      "androidJwt": "eyJhbGci..."
    }
  }
  ```

#### `POST /pairing/claim`
Claims a pairing session from a desktop application or browser.

---

### 3. Session Revocation

#### `POST /sessions/revoke`
Revokes an active session immediately.
