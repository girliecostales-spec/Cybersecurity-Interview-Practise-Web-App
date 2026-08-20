import React, { useState } from 'react';
import { EvaluationResult } from '../types';
import { SampleAnswerModal } from './SampleAnswerModal';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Award,
  Sparkles,
  ThumbsUp,
  ThumbsDown,
  Clock,
  BookOpen,
  ArrowRight,
} from 'lucide-react';

interface FeedbackSidebarProps {
  evaluation: EvaluationResult | null;
  currentQuestionText?: string;
  isEvaluating: boolean;
  onAskFollowUp?: () => void;
}

export const FeedbackSidebar: React.FC<FeedbackSidebarProps> = ({
  evaluation,
  currentQuestionText = '',
  isEvaluating,
  onAskFollowUp,
}) => {
  const [showSampleModal, setShowSampleModal] = useState(false);

  if (isEvaluating) {
    return (
      <aside className="w-full lg:w-[320px] xl:w-[360px] bg-[#0c0c0e] border-t lg:border-t-0 lg:border-l border-slate-800 p-6 flex flex-col items-center justify-center space-y-4 shrink-0 min-h-0 overflow-y-auto custom-scrollbar">
        <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        <div className="text-center space-y-1">
          <p className="text-xs font-bold text-slate-200">Analyzing Answer...</p>
          <p className="text-[11px] text-slate-500 font-mono">
            Evaluating against STAR-L framework & cybersecurity hiring standards
          </p>
        </div>
      </aside>
    );
  }

  if (!evaluation) {
    return (
      <aside className="w-full lg:w-[320px] xl:w-[360px] bg-[#0c0c0e] border-t lg:border-t-0 lg:border-l border-slate-800 p-6 flex flex-col justify-between shrink-0 min-h-0 overflow-y-auto custom-scrollbar space-y-6">
        <div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
              Feedback Report
            </h2>
            <span className="text-xs font-mono text-slate-600">-- / 5</span>
          </div>

          <div className="p-5 bg-slate-900/40 border border-slate-800 rounded-xl space-y-3 text-center">
            <Award className="w-8 h-8 text-slate-700 mx-auto" />
            <p className="text-xs text-slate-400">
              Submit your response to receive immediate hiring manager ratings and STAR-L breakdown.
            </p>
          </div>
        </div>

        <div className="p-4 bg-blue-950/20 border border-blue-500/20 rounded-xl text-xs text-slate-400 space-y-1">
          <p className="font-semibold text-blue-400">STAR-L Framework</p>
          <p className="text-[11px] text-slate-400 leading-snug">
            Situation • Task • Action • Result • Learning
          </p>
        </div>
      </aside>
    );
  }

  const renderStatusIcon = (status: 'good' | 'needs_work' | 'missing') => {
    switch (status) {
      case 'good':
        return <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />;
      case 'needs_work':
        return <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />;
      case 'missing':
        return <XCircle className="w-4 h-4 text-red-400 shrink-0" />;
      default:
        return <div className="w-4 h-4 rounded-full border border-slate-700 shrink-0" />;
    }
  };

  const starlItems = [
    { key: 'situation', label: 'Situation', assessment: evaluation.starlChecklist.situation },
    { key: 'task', label: 'Task', assessment: evaluation.starlChecklist.task },
    { key: 'action', label: 'Action', assessment: evaluation.starlChecklist.action },
    { key: 'result', label: 'Result', assessment: evaluation.starlChecklist.result },
    { key: 'learning', label: 'Learning', assessment: evaluation.starlChecklist.learning },
  ];

  return (
    <>
      <aside className="w-full lg:w-[320px] xl:w-[360px] bg-[#0c0c0e] border-t lg:border-t-0 lg:border-l border-slate-800 p-6 flex flex-col overflow-y-auto custom-scrollbar shrink-0 space-y-6 min-h-0">
        {/* Rating Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div>
            <h2 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
              Performance Rating
            </h2>
            <p className="text-[11px] text-slate-400 font-mono mt-0.5">
              {evaluation.timeAssessment || '2 min response window'}
            </p>
          </div>

          <div className="flex items-baseline space-x-1 bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800">
            <span className="text-2xl font-bold text-blue-400 font-mono">
              {evaluation.rating.toFixed(1)}
            </span>
            <span className="text-xs text-slate-500">/ 5</span>
          </div>
        </div>

        {/* STAR-L Checklist */}
        <div className="space-y-3">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
            <span>STAR-L Breakdown</span>
            <span className="text-[10px] text-slate-500 font-mono">Evaluation</span>
          </p>

          <ul className="space-y-2">
            {starlItems.map((item) => (
              <li
                key={item.key}
                className="bg-slate-900/50 p-2.5 rounded-lg border border-slate-800/80 space-y-1"
              >
                <div className="flex items-center space-x-2">
                  {renderStatusIcon(item.assessment.status)}
                  <span className="text-xs font-semibold text-slate-200">{item.label}</span>
                </div>
                {item.assessment.note && (
                  <p className="text-[11px] text-slate-400 pl-6 leading-tight">
                    {item.assessment.note}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>

        {/* What Done Well */}
        {evaluation.whatDoneWell && evaluation.whatDoneWell.length > 0 && (
          <div className="p-3.5 bg-emerald-950/20 border border-emerald-500/20 rounded-xl space-y-2">
            <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
              <ThumbsUp className="w-3.5 h-3.5" /> What You Did Well
            </p>
            <ul className="space-y-1.5 pl-1">
              {evaluation.whatDoneWell.map((item, idx) => (
                <li key={idx} className="text-xs text-slate-300">
                  <strong className="text-emerald-300 font-medium">[{item.part}]: </strong>
                  {item.reason}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* What Needs Improvement */}
        {evaluation.whatNeedsImprovement && evaluation.whatNeedsImprovement.length > 0 && (
          <div className="p-3.5 bg-amber-950/20 border border-amber-500/20 rounded-xl space-y-2">
            <p className="text-[10px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
              <ThumbsDown className="w-3.5 h-3.5" /> Areas to Improve
            </p>
            <ul className="space-y-1.5 pl-1">
              {evaluation.whatNeedsImprovement.map((item, idx) => (
                <li key={idx} className="text-xs text-slate-300">
                  <strong className="text-amber-300 font-medium">[{item.part}]: </strong>
                  {item.reason}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Overall Feedback Summary */}
        <div className="p-3.5 bg-blue-950/15 border border-blue-500/20 rounded-xl space-y-1.5">
          <p className="text-[10px] font-bold text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
            <BookOpen className="w-3.5 h-3.5" /> Hiring Manager Feedback
          </p>
          <p className="text-xs text-slate-300 leading-relaxed italic">
            "{evaluation.overallFeedback}"
          </p>
        </div>

        {/* Follow-up question trigger */}
        {evaluation.followUpQuestion && (
          <div className="p-3 bg-purple-950/20 border border-purple-500/30 rounded-xl space-y-2">
            <p className="text-[10px] font-bold text-purple-400 uppercase tracking-wider flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" /> Recommended Follow-Up
            </p>
            <p className="text-xs text-slate-300 italic font-medium">
              "{evaluation.followUpQuestion}"
            </p>
            {onAskFollowUp && (
              <button
                onClick={onAskFollowUp}
                className="w-full py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded text-[11px] font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-1"
              >
                <span>Ask Follow-Up</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            )}
          </div>
        )}

        {/* Sample Answer Action */}
        <div className="mt-auto pt-2">
          <button
            type="button"
            onClick={() => setShowSampleModal(true)}
            className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold uppercase tracking-wider border border-slate-700 shadow-md transition-colors flex items-center justify-center gap-2"
          >
            <Sparkles className="w-4 h-4 text-blue-400" />
            <span>Review Sample Answer</span>
          </button>
        </div>
      </aside>

      {/* Sample Answer Modal */}
      <SampleAnswerModal
        isOpen={showSampleModal}
        onClose={() => setShowSampleModal(false)}
        question={currentQuestionText}
        recommendedAnswer={evaluation.recommendedAnswer}
      />
    </>
  );
};
