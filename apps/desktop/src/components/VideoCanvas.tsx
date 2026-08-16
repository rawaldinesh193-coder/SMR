import React, { useRef, useEffect } from 'react';
import { InputControlAction } from '@smr/protocol';
import { transformDesktopClickToNormalized } from '../services/coordinateTransform';
import { Smartphone, Zap, ShieldCheck, Radio } from 'lucide-react';

interface VideoCanvasProps {
  stream: MediaStream | null;
  rotation: number;
  onSendInput: (action: InputControlAction.TOUCH_DOWN | InputControlAction.TOUCH_MOVE | InputControlAction.TOUCH_UP, normX: number, normY: number) => void;
  onPairClick: () => void;
}

export const VideoCanvas: React.FC<VideoCanvasProps> = ({ stream, rotation, onSendInput, onPairClick }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const isMouseDownRef = useRef<boolean>(false);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const handleMouseEvent = (
    e: React.MouseEvent<HTMLVideoElement>,
    action: InputControlAction.TOUCH_DOWN | InputControlAction.TOUCH_MOVE | InputControlAction.TOUCH_UP
  ) => {
    if (!videoRef.current) return;
    const rect = videoRef.current.getBoundingClientRect();
    const { normX, normY } = transformDesktopClickToNormalized(e.clientX, e.clientY, rect, {
      videoWidth: videoRef.current.videoWidth || 1080,
      videoHeight: videoRef.current.videoHeight || 1920,
      elementWidth: rect.width,
      elementHeight: rect.height,
      rotation,
      zoom: 1.0
    });

    onSendInput(action, normX, normY);
  };

  return (
    <div className="canvas-container select-none p-8">
      {stream ? (
        <div className="phone-frame-mockup">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{ transform: `rotate(${rotation}deg)` }}
            className="video-frame border border-slate-700/60 shadow-2xl"
            onMouseDown={(e) => {
              isMouseDownRef.current = true;
              handleMouseEvent(e, InputControlAction.TOUCH_DOWN);
            }}
            onMouseMove={(e) => {
              if (isMouseDownRef.current) {
                handleMouseEvent(e, InputControlAction.TOUCH_MOVE);
              }
            }}
            onMouseUp={(e) => {
              if (isMouseDownRef.current) {
                isMouseDownRef.current = false;
                handleMouseEvent(e, InputControlAction.TOUCH_UP);
              }
            }}
          />
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center text-center max-w-lg glass-panel-glow p-10 rounded-3xl border border-sky-500/20 shadow-2xl">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-sky-500/20 to-blue-600/20 border border-sky-500/30 flex items-center justify-center mb-6 shadow-inner glow-pill-sky">
            <Smartphone className="w-10 h-10 text-sky-400" />
          </div>
          <h2 className="text-2xl font-bold font-heading text-slate-100 tracking-tight">No Active Stream</h2>
          <p className="text-sm text-slate-400 mt-2 leading-relaxed">
            Connect your Android smartphone using QR Code or short pairing link to stream screen and remote control gestures in real time.
          </p>

          <div className="grid grid-cols-2 gap-4 w-full my-6 text-left text-xs font-mono text-slate-400">
            <div className="flex items-center space-x-2 bg-slate-900/80 p-3 rounded-xl border border-slate-800">
              <Zap className="w-4 h-4 text-sky-400" />
              <span>Sub-100ms WebRTC</span>
            </div>
            <div className="flex items-center space-x-2 bg-slate-900/80 p-3 rounded-xl border border-slate-800">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>DTLS-SRTP P2P</span>
            </div>
          </div>

          <button
            onClick={onPairClick}
            className="w-full py-3.5 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white rounded-xl text-sm font-semibold shadow-lg shadow-sky-500/25 transition transform hover:scale-[1.01]"
          >
            Pair Android Device Now
          </button>
        </div>
      )}
    </div>
  );
};
