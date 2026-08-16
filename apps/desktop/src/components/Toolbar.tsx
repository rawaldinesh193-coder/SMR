import React from 'react';
import { 
  Smartphone, 
  Maximize2, 
  RotateCw, 
  Camera, 
  Volume2, 
  VolumeX, 
  Activity, 
  Power, 
  ArrowLeft, 
  Home, 
  Square,
  Zap,
  Radio
} from 'lucide-react';
import { AndroidGlobalAction } from '@smr/protocol';

interface ToolbarProps {
  deviceName: string;
  isConnected: boolean;
  audioMuted: boolean;
  showDiagnostics: boolean;
  onToggleAudio: () => void;
  onToggleDiagnostics: () => void;
  onToggleFullscreen: () => void;
  onRotate: () => void;
  onScreenshot: () => void;
  onGlobalAction: (action: AndroidGlobalAction) => void;
  onDisconnect: () => void;
  onPairClick: () => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  deviceName,
  isConnected,
  audioMuted,
  showDiagnostics,
  onToggleAudio,
  onToggleDiagnostics,
  onToggleFullscreen,
  onRotate,
  onScreenshot,
  onGlobalAction,
  onDisconnect,
  onPairClick
}) => {
  return (
    <header className="h-16 bg-slate-950/80 backdrop-blur-xl border-b border-slate-800/80 px-6 flex items-center justify-between shadow-2xl z-40">
      {/* Brand & Device Status Indicator */}
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-2 bg-gradient-to-r from-sky-500/10 to-blue-600/10 border border-sky-500/20 px-3 py-1.5 rounded-xl">
          <Smartphone className="w-5 h-5 text-sky-400 animate-pulse" />
          <span className="font-heading font-bold text-slate-100 text-sm tracking-wide">SMR Mirror</span>
        </div>

        <div className="h-4 w-px bg-slate-800" />

        <div className="flex items-center space-x-3">
          <div>
            <h1 className="text-xs font-semibold text-slate-200 tracking-tight">{deviceName}</h1>
            <div className="flex items-center space-x-2 mt-0.5">
              <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400 glow-pill-emerald animate-ping' : 'bg-rose-500'}`} />
              <span className="text-[10px] text-slate-400 font-mono tracking-wider">
                {isConnected ? 'WEBRTC ACTIVE (DTLS-SRTP P2P)' : 'OFFLINE'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Android Gesture Controls (Back / Home / Recents) */}
      {isConnected && (
        <div className="flex items-center bg-slate-900/90 border border-slate-800 rounded-xl p-1 space-x-1 shadow-inner">
          <button
            onClick={() => onGlobalAction(AndroidGlobalAction.BACK)}
            className="p-2 hover:bg-slate-800 active:scale-95 rounded-lg text-slate-300 hover:text-sky-400 transition"
            title="Android Back"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => onGlobalAction(AndroidGlobalAction.HOME)}
            className="p-2 hover:bg-slate-800 active:scale-95 rounded-lg text-slate-300 hover:text-sky-400 transition"
            title="Android Home"
          >
            <Home className="w-4 h-4" />
          </button>
          <button
            onClick={() => onGlobalAction(AndroidGlobalAction.RECENTS)}
            className="p-2 hover:bg-slate-800 active:scale-95 rounded-lg text-slate-300 hover:text-sky-400 transition"
            title="Android Recents"
          >
            <Square className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Action Toolbar Buttons */}
      <div className="flex items-center space-x-2">
        {isConnected ? (
          <>
            <button
              onClick={onToggleAudio}
              className="p-2.5 hover:bg-slate-800/80 rounded-xl text-slate-300 hover:text-white transition"
              title={audioMuted ? 'Unmute Audio' : 'Mute Audio'}
            >
              {audioMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
            </button>
            <button
              onClick={onRotate}
              className="p-2.5 hover:bg-slate-800/80 rounded-xl text-slate-300 hover:text-sky-400 transition"
              title="Rotate Screen (90°)"
            >
              <RotateCw className="w-4 h-4" />
            </button>
            <button
              onClick={onScreenshot}
              className="p-2.5 hover:bg-slate-800/80 rounded-xl text-slate-300 hover:text-sky-400 transition"
              title="Take High-Res Snapshot"
            >
              <Camera className="w-4 h-4" />
            </button>
            <button
              onClick={onToggleFullscreen}
              className="p-2.5 hover:bg-slate-800/80 rounded-xl text-slate-300 hover:text-sky-400 transition"
              title="Full Screen Mode"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
            <button
              onClick={onToggleDiagnostics}
              className={`p-2.5 rounded-xl transition ${showDiagnostics ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30 glow-pill-sky' : 'hover:bg-slate-800/80 text-slate-300'}`}
              title="Network & WebRTC Diagnostics"
            >
              <Activity className="w-4 h-4" />
            </button>
            <button
              onClick={onDisconnect}
              className="ml-3 px-4 py-2 bg-rose-600/15 text-rose-400 border border-rose-500/30 hover:bg-rose-600/30 hover:border-rose-500/50 rounded-xl text-xs font-semibold flex items-center space-x-2 transition shadow-lg"
            >
              <Power className="w-3.5 h-3.5" />
              <span>Revoke & Disconnect</span>
            </button>
          </>
        ) : (
          <button
            onClick={onPairClick}
            className="px-5 py-2 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-sky-500/20 flex items-center space-x-2 transition transform hover:scale-[1.02]"
          >
            <Zap className="w-4 h-4" />
            <span>Pair Device</span>
          </button>
        )}
      </div>
    </header>
  );
};
