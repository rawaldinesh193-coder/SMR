# PostgreSQL Database Schema & Migrations

The database manages device metadata, active pairing sessions, and connection audit logs. Screen frames and input streams are never persisted.

## Schema Tables
- `users`: User entity table.
- `devices`: Registered Android phones and desktop clients.
- `pairing_sessions`: Short-lived pairing codes & QR tokens.
- `connection_sessions`: Active WebRTC connection tracking.
- `audit_events`: Audit logs for security monitoring.
