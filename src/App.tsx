import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { JobContextSidebar } from './components/JobContextSidebar';
import { InterviewArea } from './components/InterviewArea';
import { FeedbackSidebar } from './components/FeedbackSidebar';
import { JobDetails, UploadedFileItem, InterviewTurn, QuestionData, EvaluationResult } from './types';

export default function App() {
  const [sessionId, setSessionId] = useState<string>(
    `CYBER_${Math.floor(100 + Math.random() * 900)}`
  );

  // Job Context state
  const [jobDetails, setJobDetails] = useState<JobDetails>({
    jobTitle: 'Junior SOC Analyst (Tier 1)',
    jobDuties:
      'Triage incoming security alerts in SIEM (Splunk/Microsoft Sentinel), analyze phishing emails, perform initial log investigations, document incident tickets, and escalate confirmed threats to Tier 2.',
    jobRequirements:
      '0–2 years of IT or helpdesk experience, CompTIA Security+ or Cisco CyberOps Associate, understanding of TCP/IP, OSI model, common ports, and basic log analysis.',
    jobUrl: '',
  });

  // Resume state
  const [resumeFile, setResumeFile] = useState<UploadedFileItem | null>(null);

  // QA / Reference docs & links state
  const [qaFiles, setQaFiles] = useState<UploadedFileItem[]>([
    {
      id: 'qa_1',
      name: 'OWASP_Top_10_2024.pdf',
      type: 'qa_doc',
      extractedText:
        'OWASP Top 10 Security Risks: A01 Broken Access Control, A02 Cryptographic Failures, A03 Injection, A04 Insecure Design, A05 Security Misconfiguration, A06 Vulnerable Components, A07 Identification Failures, A08 Software Integrity Failures, A09 Security Logging Failures, A10 SSRF.',
    },
    {
      id: 'qa_2',
      name: 'NIST_SP_800-61_Incident_Response.url',
      type: 'link',
      url: 'https://csrc.nist.gov/publications/detail/sp/800-61/rev-2/final',
    },
  ]);

  // Practice Question Types state
  const [selectedQuestionTypes, setSelectedQuestionTypes] = useState<
    ('technical' | 'behavioural' | 'soft_skills')[]
  >(['technical', 'behavioural', 'soft_skills']);

  const handleToggleQuestionType = (type: 'technical' | 'behavioural' | 'soft_skills') => {
    setSelectedQuestionTypes((prev) => {
      if (prev.includes(type)) {
        if (prev.length === 1) return prev; // keep at least 1 selected
        return prev.filter((t) => t !== type);
      } else {
        return [...prev, type];
      }
    });
  };

  const handleSelectPresetQuestionTypes = (
    types: ('technical' | 'behavioural' | 'soft_skills')[]
  ) => {
    if (types.length > 0) {
      setSelectedQuestionTypes(types);
    }
  };

  // Session interview turns
  const [turns, setTurns] = useState<InterviewTurn[]>([]);
  const [activeTurnIndex, setActiveTurnIndex] = useState<number>(-1);

  // Loading states
  const [isParsingUrl, setIsParsingUrl] = useState(false);
  const [isParsingResume, setIsParsingResume] = useState(false);
  const [isParsingQaFile, setIsParsingQaFile] = useState(false);
  const [isLoadingQuestion, setIsLoadingQuestion] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);

  // Check if minimum required job context exists
  const hasJobContext = Boolean(
    jobDetails.jobTitle.trim() || jobDetails.jobDuties.trim() || jobDetails.jobRequirements.trim()
  );

  const handleUpdateJobDetails = (updated: Partial<JobDetails>) => {
    setJobDetails((prev) => ({ ...prev, ...updated }));
  };

  // Utility to convert file to base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        // Strip data:mime;base64, header
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  // 1. Auto-extract job details from URL
  const handleParseJobUrl = async (url: string) => {
    setIsParsingUrl(true);
    try {
      const response = await fetch('/api/parse-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });

      if (!response.ok) {
        throw new Error('Failed to parse URL');
      }

      const data = await response.json();
      setJobDetails({
        jobTitle: data.jobTitle || jobDetails.jobTitle,
        jobDuties: data.jobDuties || jobDetails.jobDuties,
        jobRequirements: data.jobRequirements || jobDetails.jobRequirements,
        jobUrl: url,
      });
    } catch (err) {
      console.error('Error parsing URL:', err);
      throw err;
    } finally {
      setIsParsingUrl(false);
    }
  };

  // 2. Upload and parse resume
  const handleUploadResume = async (file: File) => {
    setIsParsingResume(true);
    try {
      const base64 = await fileToBase64(file);
      const response = await fetch('/api/parse-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileBase64: base64,
          mimeType: file.type || 'application/pdf',
          fileName: file.name,
          fileType: 'resume',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to parse resume');
      }

      const data = await response.json();
      setResumeFile({
        id: `res_${Date.now()}`,
        name: file.name,
        size: `${(file.size / 1024).toFixed(1)} KB`,
        type: 'resume',
        extractedText: data.extractedText,
      });
    } catch (err) {
      console.error('Error uploading resume:', err);
      alert('Failed to process resume file. You can still proceed with your interview practice.');
    } finally {
      setIsParsingResume(false);
    }
  };

  const handleRemoveResume = () => {
    setResumeFile(null);
  };

  // 3. Upload QA File
  const handleUploadQaFile = async (file: File) => {
    setIsParsingQaFile(true);
    try {
      const base64 = await fileToBase64(file);
      const response = await fetch('/api/parse-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileBase64: base64,
          mimeType: file.type || 'application/pdf',
          fileName: file.name,
          fileType: 'qa_doc',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to parse Q&A doc');
      }

      const data = await response.json();
      const newItem: UploadedFileItem = {
        id: `qa_${Date.now()}`,
        name: file.name,
        size: `${(file.size / 1024).toFixed(1)} KB`,
        type: 'qa_doc',
        extractedText: data.extractedText,
      };

      setQaFiles((prev) => [...prev, newItem]);
    } catch (err) {
      console.error('Error uploading Q&A doc:', err);
      alert('Failed to process Q&A document.');
    } finally {
      setIsParsingQaFile(false);
    }
  };

  const handleAddQaLink = (url: string) => {
    const newItem: UploadedFileItem = {
      id: `link_${Date.now()}`,
      name: new URL(url).hostname || url,
      type: 'link',
      url,
    };
    setQaFiles((prev) => [...prev, newItem]);
  };

  const handleRemoveQaFile = (id: string) => {
    setQaFiles((prev) => prev.filter((item) => item.id !== id));
  };

  // 4. Generate Interview Question
  const handleGenerateQuestion = async (action: 'next' | 'retry' | 'follow_up') => {
    if (action === 'retry' && activeTurnIndex >= 0) {
      // Just clear current answer for retry
      setTurns((prev) => {
        const copy = [...prev];
        copy[activeTurnIndex] = {
          ...copy[activeTurnIndex],
          userAnswer: '',
          durationSeconds: 0,
          evaluation: undefined,
        };
        return copy;
      });
      return;
    }

    setIsLoadingQuestion(true);
    try {
      const previousQuestions = turns.map((t) => t.question.question);
      const currentTurn = activeTurnIndex >= 0 ? turns[activeTurnIndex] : null;

      // Combine QA files text
      const commonQuestionsDoc = qaFiles
        .map((f) => f.extractedText || f.url || '')
        .filter(Boolean)
        .join('\n\n');

      const response = await fetch('/api/generate-question', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobTitle: jobDetails.jobTitle,
          jobDuties: jobDetails.jobDuties,
          jobRequirements: jobDetails.jobRequirements,
          resumeText: resumeFile?.extractedText || '',
          commonQuestionsDoc,
          previousQuestions,
          actionType: action,
          selectedQuestionTypes,
          lastAnswer: currentTurn?.userAnswer || '',
          lastEvaluation: currentTurn?.evaluation ? JSON.stringify(currentTurn.evaluation) : '',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate question');
      }

      const qData: QuestionData = await response.json();

      const newTurn: InterviewTurn = {
        id: `turn_${Date.now()}`,
        question: qData,
        userAnswer: '',
        durationSeconds: 0,
        timestamp: Date.now(),
      };

      setTurns((prev) => [...prev, newTurn]);
      setActiveTurnIndex((prev) => prev + 1);
    } catch (err) {
      console.error('Error generating question:', err);
      alert('Could not generate question. Please try again.');
    } finally {
      setIsLoadingQuestion(false);
    }
  };

  // Initial question load when turns is empty
  useEffect(() => {
    if (turns.length === 0) {
      handleGenerateQuestion('next');
    }
  }, []);

  // 5. Submit Answer & Evaluate with STAR-L
  // Mobile tab state for small viewports / iPhone
  const [activeMobileTab, setActiveMobileTab] = useState<'job' | 'interview' | 'feedback'>('interview');

  // Auto switch mobile tab to feedback upon evaluation complete
  const handleSubmitAnswer = async (
    userAnswer: string,
    durationSeconds: number,
    inputMethod: 'voice' | 'typed' = 'typed'
  ) => {
    if (activeTurnIndex < 0 || !turns[activeTurnIndex]) return;

    setIsEvaluating(true);
    try {
      const currentTurn = turns[activeTurnIndex];
      const response = await fetch('/api/evaluate-answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: currentTurn.question.question,
          userAnswer,
          durationSeconds,
          inputMethod,
          jobTitle: jobDetails.jobTitle,
          jobDuties: jobDetails.jobDuties,
          jobRequirements: jobDetails.jobRequirements,
          resumeText: resumeFile?.extractedText || '',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to evaluate answer');
      }

      const evalData: EvaluationResult = await response.json();

      setTurns((prev) => {
        const copy = [...prev];
        copy[activeTurnIndex] = {
          ...copy[activeTurnIndex],
          userAnswer,
          durationSeconds,
          evaluation: evalData,
        };
        return copy;
      });

      // Switch to feedback tab on mobile screens automatically
      if (window.innerWidth < 1024) {
        setActiveMobileTab('feedback');
      }
    } catch (err) {
      console.error('Error evaluating answer:', err);
      alert('Failed to evaluate answer. Please try again.');
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleResetSession = () => {
    if (window.confirm('Start a new mock interview session? This will reset the question history.')) {
      setSessionId(`CYBER_${Math.floor(100 + Math.random() * 900)}`);
      setTurns([]);
      setActiveTurnIndex(-1);
      setActiveMobileTab('interview');
    }
  };

  const activeTurn = activeTurnIndex >= 0 ? turns[activeTurnIndex] : null;

  return (
    <div className="flex flex-col min-h-[100dvh] min-h-screen w-full bg-[#09090b] text-slate-100 font-sans">
      {/* Header */}
      <Header
        sessionId={sessionId}
        activeTurnIndex={activeTurnIndex}
        totalTurns={turns.length}
        onResetSession={handleResetSession}
      />

      {/* Mobile / iPhone Responsive Navigation Bar (Visible on < lg screens) */}
      <div className="lg:hidden flex items-center justify-around bg-[#0c0c0e] border-b border-slate-800 p-1.5 shrink-0 sticky top-0 z-20">
        <button
          type="button"
          onClick={() => setActiveMobileTab('job')}
          className={`flex-1 py-2 px-2 text-center rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
            activeMobileTab === 'job'
              ? 'bg-blue-600/20 text-blue-400 border border-blue-500/40 shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <span>💼 Job Setup</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveMobileTab('interview')}
          className={`flex-1 py-2 px-2 text-center rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
            activeMobileTab === 'interview'
              ? 'bg-blue-600/20 text-blue-400 border border-blue-500/40 shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <span>🎙️ Interview</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveMobileTab('feedback')}
          className={`flex-1 py-2 px-2 text-center rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
            activeMobileTab === 'feedback'
              ? 'bg-blue-600/20 text-blue-400 border border-blue-500/40 shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <span>📊 Report</span>
          {activeTurn?.evaluation && (
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          )}
        </button>
      </div>

      {/* Main Container */}
      <main className="flex flex-col lg:flex-row flex-1 w-full min-h-0 overflow-y-auto lg:overflow-hidden">
        {/* Left Sidebar: Job Context & Uploads */}
        <div className={`w-full lg:w-auto ${activeMobileTab === 'job' ? 'block' : 'hidden lg:block'}`}>
          <JobContextSidebar
            jobDetails={jobDetails}
            onUpdateJobDetails={handleUpdateJobDetails}
            resumeFile={resumeFile}
            onUploadResume={handleUploadResume}
            onRemoveResume={handleRemoveResume}
            qaFiles={qaFiles}
            onUploadQaFile={handleUploadQaFile}
            onAddQaLink={handleAddQaLink}
            onRemoveQaFile={handleRemoveQaFile}
            onParseJobUrl={handleParseJobUrl}
            isParsingUrl={isParsingUrl}
            isParsingResume={isParsingResume}
            isParsingQaFile={isParsingQaFile}
            selectedQuestionTypes={selectedQuestionTypes}
            onToggleQuestionType={handleToggleQuestionType}
            onSelectPresetQuestionTypes={handleSelectPresetQuestionTypes}
          />
        </div>

        {/* Middle Area: Question & Interaction */}
        <div className={`flex-1 flex flex-col min-h-0 w-full ${activeMobileTab === 'interview' ? 'flex' : 'hidden lg:flex'}`}>
          <InterviewArea
            currentQuestion={activeTurn ? activeTurn.question : null}
            onGenerateQuestion={async (action) => {
              if (window.innerWidth < 1024) setActiveMobileTab('interview');
              await handleGenerateQuestion(action);
            }}
            onSubmitAnswer={handleSubmitAnswer}
            isLoadingQuestion={isLoadingQuestion}
            isEvaluating={isEvaluating}
            lastEvaluation={activeTurn?.evaluation || null}
            hasJobContext={hasJobContext}
            selectedQuestionTypes={selectedQuestionTypes}
            onToggleQuestionType={handleToggleQuestionType}
            onSelectPresetQuestionTypes={handleSelectPresetQuestionTypes}
          />
        </div>

        {/* Right Sidebar: Feedback & STAR-L Report */}
        <div className={`w-full lg:w-auto ${activeMobileTab === 'feedback' ? 'block' : 'hidden lg:block'}`}>
          <FeedbackSidebar
            evaluation={activeTurn?.evaluation || null}
            currentQuestionText={activeTurn?.question.question || ''}
            isEvaluating={isEvaluating}
            onAskFollowUp={async () => {
              if (window.innerWidth < 1024) setActiveMobileTab('interview');
              await handleGenerateQuestion('follow_up');
            }}
          />
        </div>
      </main>
    </div>
  );
}
