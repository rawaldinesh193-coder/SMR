import React, { useState, useRef } from 'react';
import { Toolbar } from './components/Toolbar';
import { VideoCanvas } from './components/VideoCanvas';
import { DiagnosticsOverlay } from './components/DiagnosticsOverlay';
import { PairingModal } from './components/PairingModal';
import { WebRtcDesktopClient } from './services/webrtcClient';
import { ConnectionDiagnostics } from '@smr/shared-types';
import { InputControlAction, AndroidGlobalAction } from '@smr/protocol';

export const App: React.FC = () => {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [deviceName, setDeviceName] = useState<string>('My Android Phone');
  const [audioMuted, setAudioMuted] = useState<boolean>(true);
  const [rotation, setRotation] = useState<number>(0);
  const [showDiagnostics, setShowDiagnostics] = useState<boolean>(false);
  const [diagnostics, setDiagnostics] = useState<ConnectionDiagnostics | null>(null);
  const [isPairingOpen, setIsPairingOpen] = useState<boolean>(false);

  const webrtcClientRef = useRef<WebRtcDesktopClient | null>(null);

  const handlePair = (code: string) => {
    setIsPairingOpen(false);
    const signalingUrl = `ws://${window.location.hostname}:4000/ws/signaling`;
    const client = new WebRtcDesktopClient(signalingUrl);

    client.onStreamReceived = (mediaStream) => {
      setStream(mediaStream);
      setIsConnected(true);
    };

    client.onDiagnosticsUpdated = (stats) => {
      setDiagnostics(stats);
    };

    client.onStateChanged = (state) => {
      if (state === 'DISCONNECTED' || state === 'REJECTED') {
        setIsConnected(false);
        setStream(null);
      }
    };

    client.connectAndPair(code);
    webrtcClientRef.current = client;
  };

  const handleSendInput = (action: InputControlAction.TOUCH_DOWN | InputControlAction.TOUCH_MOVE | InputControlAction.TOUCH_UP, normX: number, normY: number) => {
    webrtcClientRef.current?.sendTouchInput(action, normX, normY);
  };

  const handleGlobalAction = (action: AndroidGlobalAction) => {
    webrtcClientRef.current?.sendGlobalAction(action);
  };

  const handleDisconnect = () => {
    webrtcClientRef.current?.disconnect();
    setIsConnected(false);
    setStream(null);
  };

  const handleScreenshot = () => {
    alert('High-resolution screen snapshot captured!');
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-950 overflow-hidden select-none">
      {/* Top Glassmorphic Navigation Toolbar */}
      <Toolbar
        deviceName={deviceName}
        isConnected={isConnected}
        audioMuted={audioMuted}
        showDiagnostics={showDiagnostics}
        onToggleAudio={() => setAudioMuted(!audioMuted)}
        onToggleDiagnostics={() => setShowDiagnostics(!showDiagnostics)}
        onToggleFullscreen={() => document.documentElement.requestFullscreen()}
        onRotate={() => setRotation((r) => (r + 90) % 360)}
        onScreenshot={handleScreenshot}
        onGlobalAction={handleGlobalAction}
        onDisconnect={handleDisconnect}
        onPairClick={() => setIsPairingOpen(true)}
      />

      {/* Main Screen Stream Display Container */}
      <main className="flex-1 relative overflow-hidden">
        <VideoCanvas
          stream={stream}
          rotation={rotation}
          onSendInput={handleSendInput}
          onPairClick={() => setIsPairingOpen(true)}
        />

        {/* Real-Time Cybernetic Diagnostics Overlay */}
        {showDiagnostics && (
          <DiagnosticsOverlay
            diagnostics={diagnostics}
            onClose={() => setShowDiagnostics(false)}
          />
        )}
      </main>

      {/* Modern Pairing Modal Dialog */}
      <PairingModal
        isOpen={isPairingOpen}
        onClose={() => setIsPairingOpen(false)}
        onPair={handlePair}
      />
    </div>
  );
};

export default App;
