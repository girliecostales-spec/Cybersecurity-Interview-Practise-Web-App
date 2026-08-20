import React, { useState, useEffect, useRef } from 'react';
import { QuestionData, EvaluationResult } from '../types';
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Play,
  RotateCcw,
  ArrowRight,
  Send,
  HelpCircle,
  Sparkles,
  Clock,
  ShieldAlert,
  Bot,
  MessageSquare,
  Sliders,
  Filter,
} from 'lucide-react';

type QuestionTypeCategory = 'technical' | 'behavioural' | 'soft_skills';

interface InterviewAreaProps {
  currentQuestion: QuestionData | null;
  onGenerateQuestion: (action: 'next' | 'retry' | 'follow_up') => Promise<void>;
  onSubmitAnswer: (
    answer: string,
    durationSeconds: number,
    inputMethod?: 'voice' | 'typed'
  ) => Promise<void>;
  isLoadingQuestion: boolean;
  isEvaluating: boolean;
  lastEvaluation: EvaluationResult | null;
  hasJobContext: boolean;
  selectedQuestionTypes: QuestionTypeCategory[];
  onToggleQuestionType: (type: QuestionTypeCategory) => void;
  onSelectPresetQuestionTypes: (types: QuestionTypeCategory[]) => void;
}

export const InterviewArea: React.FC<InterviewAreaProps> = ({
  currentQuestion,
  onGenerateQuestion,
  onSubmitAnswer,
  isLoadingQuestion,
  isEvaluating,
  lastEvaluation,
  hasJobContext,
  selectedQuestionTypes,
  onToggleQuestionType,
  onSelectPresetQuestionTypes,
}) => {
  const [answerText, setAnswerText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [usedVoiceMode, setUsedVoiceMode] = useState(false);
  const [isSpeakingQuestion, setIsSpeakingQuestion] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const timerRef = useRef<any>(null);
  const recognitionRef = useRef<any>(null);
  const baseTextRef = useRef<string>('');

  // Speech Recognition setup (Voice Mode)
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;

      recognition.onresult = (event: any) => {
        let fullSpeech = '';
        for (let i = 0; i < event.results.length; i++) {
          fullSpeech += event.results[i][0].transcript + ' ';
        }
        const prefix = baseTextRef.current ? baseTextRef.current.trim() + ' ' : '';
        setAnswerText((prefix + fullSpeech).trim());
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsRecording(false);
      };

      recognition.onend = () => {
        setIsRecording(false);
      };

      recognitionRef.current = recognition;
    }
  }, []);

  // Timer logic
  useEffect(() => {
    if (isTimerRunning) {
      timerRef.current = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isTimerRunning]);

  // When question changes, reset answer & timer
  useEffect(() => {
    setAnswerText('');
    setElapsedSeconds(0);
    setIsTimerRunning(false);
    setUsedVoiceMode(false);
  }, [currentQuestion?.questionId]);

  const toggleRecording = () => {
    if (!recognitionRef.current) {
      alert('Speech Recognition is not supported in your browser. You can type your answer in the field.');
      return;
    }

    if (isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
    } else {
      try {
        baseTextRef.current = answerText;
        recognitionRef.current.start();
        setIsRecording(true);
        setUsedVoiceMode(true);
        if (!isTimerRunning) setIsTimerRunning(true);
      } catch (err) {
        console.error('Failed to start recording:', err);
      }
    }
  };

  const handleSpeakQuestion = () => {
    if (!currentQuestion?.question) return;

    if ('speechSynthesis' in window) {
      if (isSpeakingQuestion) {
        window.speechSynthesis.cancel();
        setIsSpeakingQuestion(false);
        return;
      }

      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(currentQuestion.question);
      utterance.rate = 0.95;
      utterance.pitch = 1.0;

      utterance.onend = () => setIsSpeakingQuestion(false);
      utterance.onerror = () => setIsSpeakingQuestion(false);

      setIsSpeakingQuestion(true);
      window.speechSynthesis.speak(utterance);
    }
  };

  // Word count & read-aloud time calculations (138 wpm = ~2.3 words/sec)
  const wordCount = answerText.trim().split(/\s+/).filter(Boolean).length;
  const estimatedReadAloudSeconds = Math.ceil(wordCount / 2.3);
  const effectiveDuration = usedVoiceMode ? elapsedSeconds : estimatedReadAloudSeconds;
  const isOverTime = effectiveDuration > 120; // 2 minutes threshold

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!answerText.trim() || isEvaluating) return;
    setIsTimerRunning(false);
    if (isRecording && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsRecording(false);
    }

    const inputMethod: 'voice' | 'typed' = usedVoiceMode ? 'voice' : 'typed';
    const finalDuration = usedVoiceMode
      ? elapsedSeconds > 0
        ? elapsedSeconds
        : estimatedReadAloudSeconds
      : estimatedReadAloudSeconds;

    await onSubmitAnswer(answerText.trim(), finalDuration, inputMethod);
  };

  const handleRetry = () => {
    setAnswerText('');
    setElapsedSeconds(0);
    setIsTimerRunning(false);
    setUsedVoiceMode(false);
    if (isRecording && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsRecording(false);
    }
  };

  const formatTime = (totalSecs: number) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const renderTypeBadge = (type?: string) => {
    switch (type) {
      case 'technical':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
            🛠️ Technical
          </span>
        );
      case 'behavioural':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-purple-500/10 text-purple-300 border border-purple-500/30">
            🧠 Behavioural
          </span>
        );
      case 'soft_skills':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
            💬 Soft Skills
          </span>
        );
      case 'resume_specific':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/30">
            📄 Resume-Specific
          </span>
        );
      case 'follow_up':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-500/10 text-indigo-300 border border-indigo-500/30">
            🔍 Follow-Up
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <section className="flex-1 flex flex-col justify-between bg-[#09090b] relative overflow-y-auto custom-scrollbar min-h-0">
      {/* Top Question Area */}
      <div className="p-6 md:p-8 space-y-6">
        {!hasJobContext && (
          <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center justify-between text-amber-300 text-xs">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Please specify Job Title, Duties & Requirements in the left panel to begin.</span>
            </div>
          </div>
        )}

        {/* Practice Question Types Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-[#0e0e11] border border-slate-800/80 rounded-xl px-4 py-2.5 text-xs text-slate-300">
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            <span className="font-semibold text-slate-200">Practice Focus:</span>
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => onToggleQuestionType('technical')}
                className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors border ${
                  selectedQuestionTypes.includes('technical')
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                    : 'bg-slate-900 text-slate-500 border-slate-800 hover:text-slate-300'
                }`}
              >
                🛠️ Technical
              </button>
              <button
                type="button"
                onClick={() => onToggleQuestionType('behavioural')}
                className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors border ${
                  selectedQuestionTypes.includes('behavioural')
                    ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                    : 'bg-slate-900 text-slate-500 border-slate-800 hover:text-slate-300'
                }`}
              >
                🧠 Behavioural
              </button>
              <button
                type="button"
                onClick={() => onToggleQuestionType('soft_skills')}
                className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors border ${
                  selectedQuestionTypes.includes('soft_skills')
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : 'bg-slate-900 text-slate-500 border-slate-800 hover:text-slate-300'
                }`}
              >
                💬 Soft Skills
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-400">Preset:</span>
            <select
              className="bg-[#161618] border border-slate-700/80 rounded px-2.5 py-1 text-[11px] text-blue-300 font-medium focus:outline-none cursor-pointer"
              value={
                selectedQuestionTypes.length === 3
                  ? 'all'
                  : selectedQuestionTypes.length === 2 && selectedQuestionTypes.includes('technical') && selectedQuestionTypes.includes('behavioural')
                  ? 'tech_behav'
                  : selectedQuestionTypes.length === 2 && selectedQuestionTypes.includes('technical') && selectedQuestionTypes.includes('soft_skills')
                  ? 'tech_soft'
                  : selectedQuestionTypes.length === 2 && selectedQuestionTypes.includes('behavioural') && selectedQuestionTypes.includes('soft_skills')
                  ? 'behav_soft'
                  : selectedQuestionTypes.length === 1 && selectedQuestionTypes.includes('technical')
                  ? 'tech_only'
                  : selectedQuestionTypes.length === 1 && selectedQuestionTypes.includes('behavioural')
                  ? 'behav_only'
                  : selectedQuestionTypes.length === 1 && selectedQuestionTypes.includes('soft_skills')
                  ? 'soft_only'
                  : 'custom'
              }
              onChange={(e) => {
                const val = e.target.value;
                if (val === 'all') onSelectPresetQuestionTypes(['technical', 'behavioural', 'soft_skills']);
                else if (val === 'tech_behav') onSelectPresetQuestionTypes(['technical', 'behavioural']);
                else if (val === 'tech_soft') onSelectPresetQuestionTypes(['technical', 'soft_skills']);
                else if (val === 'behav_soft') onSelectPresetQuestionTypes(['behavioural', 'soft_skills']);
                else if (val === 'tech_only') onSelectPresetQuestionTypes(['technical']);
                else if (val === 'behav_only') onSelectPresetQuestionTypes(['behavioural']);
                else if (val === 'soft_only') onSelectPresetQuestionTypes(['soft_skills']);
              }}
            >
              <option value="all">✨ All 3 Question Types</option>
              <option value="tech_behav">🛠️ + 🧠 Tech & Behavioural Only</option>
              <option value="tech_soft">🛠️ + 💬 Tech & Soft Skills Only</option>
              <option value="behav_soft">🧠 + 💬 Behavioural & Soft Skills Only</option>
              <option value="tech_only">🛠️ Technical Questions Only</option>
              <option value="behav_only">🧠 Behavioural Questions Only</option>
              <option value="soft_only">💬 Soft Skills & Communication Only</option>
            </select>
          </div>
        </div>

        {/* Interviewer Question Box */}
        <div className="bg-[#0c0c0e] border border-slate-800/90 rounded-xl p-6 shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/5 rounded-full blur-2xl pointer-events-none"></div>

          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-lg bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400 font-bold shadow-inner">
                <Bot className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-xs text-blue-400 font-semibold tracking-wider uppercase">
                    Hiring Manager
                  </p>
                  {currentQuestion && renderTypeBadge(currentQuestion.questionType)}
                </div>
                {currentQuestion?.category && (
                  <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wide block mt-0.5">
                    {currentQuestion.category}
                  </span>
                )}
              </div>
            </div>

            {/* Read Aloud Button */}
            {currentQuestion && (
              <button
                type="button"
                onClick={handleSpeakQuestion}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-xs text-slate-300 transition-colors border border-slate-700/60"
                title="Listen to question"
              >
                {isSpeakingQuestion ? (
                  <>
                    <VolumeX className="w-3.5 h-3.5 text-blue-400 animate-pulse" />
                    <span className="text-blue-400 font-medium">Stop Audio</span>
                  </>
                ) : (
                  <>
                    <Volume2 className="w-3.5 h-3.5 text-slate-400" />
                    <span>Read Aloud</span>
                  </>
                )}
              </button>
            )}
          </div>

          {/* Question Text */}
          {isLoadingQuestion ? (
            <div className="py-6 flex flex-col items-center justify-center space-y-3">
              <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-xs text-slate-400 font-mono animate-pulse">
                Generating targeted question...
              </p>
            </div>
          ) : currentQuestion ? (
            <div className="space-y-3">
              <p className="text-base md:text-lg leading-relaxed text-slate-100 font-medium tracking-tight">
                "{currentQuestion.question}"
              </p>
              {currentQuestion.contextNote && (
                <p className="text-xs text-slate-400 italic font-sans bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                  💡 Note: {currentQuestion.contextNote}
                </p>
              )}
            </div>
          ) : (
            <div className="py-8 text-center space-y-3">
              <p className="text-sm text-slate-400">
                Click "Start Mock Interview" to receive your first cybersecurity question.
              </p>
              <button
                onClick={() => onGenerateQuestion('next')}
                disabled={!hasJobContext}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-600 text-white rounded-lg text-xs font-bold uppercase tracking-wider transition-colors shadow-lg shadow-blue-900/30"
              >
                Start Mock Interview
              </button>
            </div>
          )}
        </div>

        {/* User Answer Area */}
        {currentQuestion && (
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="flex flex-wrap items-center justify-between text-xs text-slate-400 px-1 gap-2">
              <div className="flex items-center space-x-3">
                {isRecording ? (
                  <span className="flex items-center space-x-2 text-red-400 font-medium animate-pulse">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>
                    <span>Voice Recording Active (Timer Running)...</span>
                  </span>
                ) : usedVoiceMode ? (
                  <span className="text-cyan-400 font-medium flex items-center gap-1.5">
                    <Mic className="w-3.5 h-3.5 text-cyan-400" /> Spoken Voice Mode Active
                  </span>
                ) : (
                  <span className="text-slate-400 flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5 text-slate-500" /> Type answer or use Voice Mode
                  </span>
                )}
              </div>

              {/* Word counter & Spoken Duration Estimate */}
              <div className="flex items-center gap-2 font-mono text-[11px]">
                <span className="text-slate-400">{wordCount} words</span>
                <span className="text-slate-700">•</span>
                {usedVoiceMode ? (
                  <span className="text-cyan-300 font-semibold">Recorded: {formatTime(elapsedSeconds)}</span>
                ) : (
                  <span
                    className={
                      estimatedReadAloudSeconds > 120 ? 'text-amber-400 font-semibold' : 'text-slate-400'
                    }
                  >
                    Est. Read-Aloud: ~{formatTime(estimatedReadAloudSeconds)}
                  </span>
                )}
              </div>
            </div>

            {/* Answer Textarea Box */}
            <div className="relative group">
              <textarea
                value={answerText}
                onChange={(e) => {
                  setAnswerText(e.target.value);
                  if (!isTimerRunning && e.target.value && usedVoiceMode) {
                    setIsTimerRunning(true);
                  }
                }}
                rows={7}
                disabled={isEvaluating}
                className="w-full bg-[#121214] border border-slate-700/90 rounded-xl p-5 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-all text-sm leading-relaxed shadow-2xl resize-none custom-scrollbar"
                placeholder="In my previous role, I responded to a potential lateral movement alert in our SIEM... (Format using STAR-L: Situation, Task, Action, Result, Learning)"
              />

              {/* Mic & Submit floating controls */}
              <div className="absolute bottom-4 right-4 flex items-center space-x-3">
                <button
                  type="button"
                  onClick={toggleRecording}
                  className={`p-3 rounded-full shadow-lg transition-all ${
                    isRecording
                      ? 'bg-red-600 hover:bg-red-500 text-white animate-pulse ring-4 ring-red-500/20'
                      : 'bg-slate-800 hover:bg-blue-600 text-slate-200 hover:text-white border border-slate-700'
                  }`}
                  title={isRecording ? 'Stop voice recording' : 'Start voice mode (Speech-to-Text)'}
                >
                  {isRecording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                </button>

                <button
                  type="submit"
                  disabled={!answerText.trim() || isEvaluating}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-600 text-white rounded-lg text-xs font-bold uppercase tracking-wider transition-colors shadow-lg shadow-blue-900/30 flex items-center gap-2"
                >
                  {isEvaluating ? (
                    <>
                      <span className="animate-spin">🌀</span> Evaluating...
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" /> Submit Answer
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* STAR-L Framework Helper Banner */}
            <div className="p-3 bg-[#0c0c0e] border border-slate-800/80 rounded-lg flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
              <span className="font-semibold text-slate-300">STAR-L Structure Checklist:</span>
              <div className="flex flex-wrap gap-2 text-[10px]">
                <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300">
                  S - Situation
                </span>
                <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300">
                  T - Task
                </span>
                <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300">
                  A - Action
                </span>
                <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300">
                  R - Result
                </span>
                <span className="px-2 py-0.5 rounded bg-blue-900/30 border border-blue-500/30 text-blue-300">
                  L - Learning
                </span>
              </div>
            </div>
          </form>
        )}
      </div>

      {/* Action Bar (Bottom Footer) */}
      <div className="h-20 border-t border-slate-800 bg-[#0c0c0e] px-6 md:px-8 flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={handleRetry}
            disabled={!currentQuestion || isEvaluating}
            className="px-4 py-2 rounded-lg border border-slate-700 hover:border-slate-600 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-xs text-slate-300 font-bold uppercase tracking-wider transition-colors flex items-center gap-1.5"
            title="Retry current question"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Retry
          </button>

          <button
            type="button"
            onClick={() => onGenerateQuestion('next')}
            disabled={!hasJobContext || isLoadingQuestion || isEvaluating}
            className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-600 text-white text-xs font-bold uppercase tracking-wider transition-colors shadow-lg shadow-blue-900/30 flex items-center gap-1.5"
          >
            <span>Next Question</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>

          {lastEvaluation && (
            <button
              type="button"
              onClick={() => onGenerateQuestion('follow_up')}
              disabled={isLoadingQuestion || isEvaluating}
              className="hidden lg:flex px-4 py-2 rounded-lg border border-blue-500/40 bg-blue-950/30 hover:bg-blue-900/40 text-blue-300 text-xs font-bold uppercase tracking-wider transition-colors items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" /> Ask Follow-Up
            </button>
          )}
        </div>

        {/* Stopwatch Timer & Rating Bar */}
        <div className="flex items-center space-x-6">
          <div className="text-right">
            <p className="text-[10px] text-slate-500 uppercase font-mono flex items-center justify-end gap-1">
              {usedVoiceMode ? (
                <span className="text-cyan-400 font-semibold">🎙️ Voice Mode</span>
              ) : (
                <span className="text-slate-400">⌨️ Read-Aloud Time</span>
              )}
            </p>
            <p
              className={`font-mono text-sm font-bold flex items-center gap-1 justify-end ${
                isOverTime ? 'text-red-400 animate-pulse' : 'text-slate-200'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />{' '}
              {usedVoiceMode ? formatTime(elapsedSeconds) : `~${formatTime(estimatedReadAloudSeconds)}`} / 02:00
            </p>
            <span
              className={`text-[10px] font-mono block ${
                isOverTime ? 'text-red-400 font-semibold' : 'text-emerald-400'
              }`}
            >
              {isOverTime ? '⚠️ Exceeds 2m limit' : '✓ Ideal (< 2m spoken)'}
            </span>
          </div>

          {lastEvaluation && (
            <div className="hidden sm:block text-right border-l border-slate-800 pl-6">
              <p className="text-[10px] text-slate-500 uppercase font-mono">Latest Rating</p>
              <div className="flex items-center space-x-1 mt-0.5">
                {[1, 2, 3, 4, 5].map((star) => (
                  <div
                    key={star}
                    className={`w-3.5 h-1.5 rounded-full ${
                      star <= Math.round(lastEvaluation.rating) ? 'bg-blue-500' : 'bg-slate-800'
                    }`}
                  />
                ))}
                <span className="text-xs font-bold text-blue-400 font-mono ml-1">
                  {lastEvaluation.rating.toFixed(1)}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
