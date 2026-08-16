import React, { useState } from 'react';
import { QrCode, Smartphone, Zap } from 'lucide-react';

interface PairingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPair: (code: string) => void;
}

export const PairingModal: React.FC<PairingModalProps> = ({ isOpen, onClose, onPair }) => {
  const [code, setCode] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (code.trim()) {
      onPair(code.trim().toUpperCase());
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="glass-panel-glow border border-sky-500/30 rounded-3xl p-8 w-full max-w-md shadow-2xl relative animate-in fade-in zoom-in duration-200">
        <div className="w-12 h-12 rounded-2xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center mb-4">
          <QrCode className="w-6 h-6 text-sky-400" />
        </div>

        <h2 className="text-2xl font-bold font-heading text-slate-100 mb-1">Pair Smartphone</h2>
        <p className="text-xs text-slate-400 mb-6 leading-relaxed">
          Enter the short pairing code or scan token displayed on your Android SMR app.
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-widest mb-2 font-mono">
              Pairing Code
            </label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="SMR-8924"
              className="w-full px-4 py-3.5 bg-slate-950/80 border border-slate-800 rounded-2xl text-center text-2xl font-mono font-bold tracking-widest text-sky-400 focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 transition shadow-inner"
              autoFocus
            />
          </div>

          <div className="flex space-x-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="w-1/2 py-3 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold border border-slate-800 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!code.trim()}
              className="w-1/2 py-3 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-lg shadow-sky-500/20 flex items-center justify-center space-x-2 transition"
            >
              <Zap className="w-4 h-4" />
              <span>Connect</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
