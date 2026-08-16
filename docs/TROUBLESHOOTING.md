# Troubleshooting Guide

### Common Issues & Resolutions

1. **Screen Mirroring Connects but Remote Mouse Input Does Not Work**:
   - Cause: Accessibility Service permission not granted on Android device.
   - Fix: Open Android System Settings -> Accessibility -> Enable **SMR Remote Control Engine**.

2. **WebRTC Connection Fails on Restrictive Corporate Wi-Fi**:
   - Cause: P2P UDP ports blocked by network firewall.
   - Fix: System automatically falls back to Coturn TURN relay server on TCP port 3478 / 5349.
