import React from 'react';
import { ConnectionDiagnostics } from '@smr/shared-types';
import { Activity, Radio, ShieldCheck, Cpu, HardDrive } from 'lucide-react';

interface DiagnosticsOverlayProps {
  diagnostics: ConnectionDiagnostics | null;
  onClose: () => void;
}

export const DiagnosticsOverlay: React.FC<DiagnosticsOverlayProps> = ({ diagnostics, onClose }) => {
  if (!diagnostics) return null;

  return (
    <div className="absolute top-20 right-6 w-80 glass-panel-glow rounded-2xl p-5 shadow-2xl z-50 text-xs font-mono border border-sky-500/30">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
        <div className="flex items-center space-x-2">
          <Activity className="w-4 h-4 text-sky-400 animate-pulse" />
          <span className="font-bold font-heading text-sky-400 uppercase tracking-widest text-xs">WebRTC Diagnostics</span>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-white font-bold text-base px-1">×</button>
      </div>

      <div className="space-y-2.5">
        <div className="flex justify-between items-center bg-slate-900/60 p-2 rounded-lg border border-slate-800">
          <span className="text-slate-400">RTT (Latency):</span>
          <span className={`font-semibold ${diagnostics.rttMs < 50 ? 'text-emerald-400' : 'text-amber-400'}`}>
            {diagnostics.rttMs} ms
          </span>
        </div>
        <div className="flex justify-between items-center bg-slate-900/60 p-2 rounded-lg border border-slate-800">
          <span className="text-slate-400">Frame Rate:</span>
          <span className="text-slate-200 font-semibold">{diagnostics.videoFps} FPS</span>
        </div>
        <div className="flex justify-between items-center bg-slate-900/60 p-2 rounded-lg border border-slate-800">
          <span className="text-slate-400">Bitrate:</span>
          <span className="text-slate-200 font-semibold">{diagnostics.videoBitrateKbps} Kbps</span>
        </div>
        <div className="flex justify-between items-center bg-slate-900/60 p-2 rounded-lg border border-slate-800">
          <span className="text-slate-400">Video Codec:</span>
          <span className="text-sky-300 font-semibold">{diagnostics.videoCodec}</span>
        </div>
        <div className="flex justify-between items-center bg-slate-900/60 p-2 rounded-lg border border-slate-800">
          <span className="text-slate-400">Resolution:</span>
          <span className="text-slate-200">{diagnostics.videoWidth}x{diagnostics.videoHeight}</span>
        </div>
        <div className="flex justify-between items-center bg-slate-900/60 p-2 rounded-lg border border-slate-800">
          <span className="text-slate-400">ICE State:</span>
          <span className="text-emerald-400 font-semibold uppercase">{diagnostics.iceState}</span>
        </div>
        <div className="flex justify-between items-center bg-slate-900/60 p-2 rounded-lg border border-slate-800">
          <span className="text-slate-400">Transport:</span>
          <span className="text-sky-400 font-semibold">{diagnostics.connectionType}</span>
        </div>
      </div>
    </div>
  );
};
