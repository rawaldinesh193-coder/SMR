# WebSocket Signaling Protocol Specification

WebSocket Endpoint: `ws://<host>:4000/ws/signaling`

---

## Message Format

All WebSocket messages are JSON encoded objects containing a `type` property.

```json
{
  "type": "MESSAGE_TYPE",
  "payload": {}
}
```

## Message Handshake Flow

1. `AUTH_REQUEST`:
   - Client sends JWT token obtained during device registration.
2. `AUTH_RESPONSE`:
   - Gateway acknowledges authentication success.
3. `PAIR_REQUEST`:
   - Desktop sends pairing request targeting `pairingSessionId`.
4. `PAIR_APPROVAL`:
   - Smartphone user approves request; desktop receives session tokens & ephemeral TURN servers.
5. `SDP_OFFER` / `SDP_ANSWER` / `ICE_CANDIDATE`:
   - Relayed directly between peers to establish WebRTC media connection.
