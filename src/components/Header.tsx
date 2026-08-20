import React from 'react';
import { ShieldCheck, User } from 'lucide-react';

interface HeaderProps {
  sessionId: string;
  activeTurnIndex: number;
  totalTurns: number;
  onResetSession: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  sessionId,
  activeTurnIndex,
  totalTurns,
  onResetSession,
}) => {
  return (
    <header className="flex items-center justify-between px-6 h-16 border-b border-slate-800 bg-[#0c0c0e] shrink-0">
      <div className="flex items-center space-x-3">
        <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-900/20 border border-blue-500/30">
          <ShieldCheck className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-base font-bold tracking-tight text-white flex items-center gap-2">
            Mock Interview Practise
            <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 uppercase">
              Cybersecurity Role
            </span>
          </h1>
          <p className="text-[11px] text-slate-400">
            STAR-L Framework & Voice AI Hiring Manager
          </p>
        </div>
      </div>

      <div className="flex space-x-4 items-center">
        {totalTurns > 0 && (
          <span className="text-xs text-slate-400 font-mono bg-slate-800/60 px-2.5 py-1 rounded border border-slate-700/60">
            Q{activeTurnIndex + 1} of {totalTurns}
          </span>
        )}
        <span className="text-xs text-slate-400 font-mono tracking-wider hidden sm:inline-block">
          SESSION_ID: <span className="text-slate-200">{sessionId}</span>
        </span>
        <button
          onClick={onResetSession}
          className="text-xs text-slate-400 hover:text-slate-200 border border-slate-800 hover:border-slate-700 bg-slate-900 px-3 py-1.5 rounded transition-colors"
          title="Start fresh session"
        >
          New Session
        </button>
        <div className="h-8 w-8 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700 shadow-inner">
          <User className="w-4 h-4 text-slate-300" />
        </div>
      </div>
    </header>
  );
};
