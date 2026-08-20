import React from 'react';
import { X, Sparkles, CheckCircle2, Copy, Check } from 'lucide-react';

interface SampleAnswerModalProps {
  isOpen: boolean;
  onClose: () => void;
  question: string;
  recommendedAnswer: string;
}

export const SampleAnswerModal: React.FC<SampleAnswerModalProps> = ({
  isOpen,
  onClose,
  question,
  recommendedAnswer,
}) => {
  const [copied, setCopied] = React.useState(false);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(recommendedAnswer);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#0c0c0e] border border-slate-800 rounded-xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-[#121215]">
          <div className="flex items-center space-x-2 text-blue-400">
            <Sparkles className="w-5 h-5" />
            <h3 className="text-base font-bold text-white tracking-tight">
              Recommended STAR-L Sample Answer
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Question Context */}
        <div className="p-5 bg-blue-950/20 border-b border-slate-800 space-y-1">
          <p className="text-[10px] uppercase font-bold text-blue-400 tracking-wider">
            Target Question
          </p>
          <p className="text-sm text-slate-200 italic font-medium">"{question}"</p>
        </div>

        {/* Sample Answer Body */}
        <div className="p-6 overflow-y-auto custom-scrollbar space-y-4 font-sans leading-relaxed text-sm text-slate-200 whitespace-pre-line">
          {recommendedAnswer}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 bg-[#121215] flex items-center justify-between">
          <p className="text-[11px] text-slate-400 font-mono">
            Structured for high-impact cybersecurity interviews
          </p>
          <div className="flex space-x-3">
            <button
              onClick={handleCopy}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400" /> Copied!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" /> Copy Answer
                </>
              )}
            </button>
            <button
              onClick={onClose}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
