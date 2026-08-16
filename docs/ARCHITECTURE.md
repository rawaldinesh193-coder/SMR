# Architectural Specification & Design System

## Overview
The SMR Mirror platform provides high-frame-rate, sub-100ms latency video streaming and full bidirectional remote control between an Android mobile device and a Desktop workstation.

## Media Pipeline Architecture

1. **Android Frame Capture**:
   - `MediaProjectionManager` obtains user screen capture consent.
   - `ScreenCapturerAndroid` captures hardware frames from `VirtualDisplay`.
   - `PeerConnectionFactory` encodes frames via hardware VP8/H.264 video encoders.

2. **WebRTC Media Transport**:
   - WebRTC `PeerConnection` negotiates SDP offer/answer over WebSocket signaling.
   - Direct P2P media stream sent over DTLS-SRTP.
   - Fallback to Coturn TURN relay when direct ICE candidates fail (restrictive NAT/firewalls).

3. **Desktop Video Renderer**:
   - Electron React Renderer receives `MediaStreamTrack`.
   - Renders directly onto an optimized HTML5 `<video>` canvas.

## Input Control & Accessibility Injection

1. **Input Event Capture**:
   - Desktop captures mouse down, move, up, scroll, and key press events on the HTML `<video>` element.
2. **Coordinate Normalization**:
   - `CoordinateTransformService` translates local element pixel clicks to normalized `(0.0..1.0)` coordinates.
3. **DataChannel Transmission**:
   - Event JSON payloads sent over WebRTC `RTCDataChannel` (`input_control`).
4. **Android Accessibility Execution**:
   - Android app receives packet and broadcasts to `RemoteAccessibilityService`.
   - `RemoteAccessibilityService.dispatchGesture()` injects touch, tap, drag, or swipe strokes onto native screen display.
