import React, { useState } from 'react';
import { JobDetails, UploadedFileItem } from '../types';
import {
  Link,
  Upload,
  FileText,
  Sparkles,
  Globe,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Briefcase,
  Layers,
  FileCheck,
  ChevronDown,
  ChevronUp,
  Target,
  SlidersHorizontal,
  Check,
} from 'lucide-react';

export type QuestionTypeCategory = 'technical' | 'behavioural' | 'soft_skills';

interface JobContextSidebarProps {
  jobDetails: JobDetails;
  onUpdateJobDetails: (updated: Partial<JobDetails>) => void;
  resumeFile: UploadedFileItem | null;
  onUploadResume: (file: File) => Promise<void>;
  onRemoveResume: () => void;
  qaFiles: UploadedFileItem[];
  onUploadQaFile: (file: File) => Promise<void>;
  onAddQaLink: (url: string) => void;
  onRemoveQaFile: (id: string) => void;
  onParseJobUrl: (url: string) => Promise<void>;
  isParsingUrl: boolean;
  isParsingResume: boolean;
  isParsingQaFile: boolean;
  selectedQuestionTypes: QuestionTypeCategory[];
  onToggleQuestionType: (type: QuestionTypeCategory) => void;
  onSelectPresetQuestionTypes: (types: QuestionTypeCategory[]) => void;
}

const CYBER_JOB_PRESETS: { title: string; duties: string; requirements: string }[] = [
  {
    title: 'Junior SOC Analyst (Tier 1)',
    duties:
      'Triage incoming security alerts in SIEM (Splunk/Microsoft Sentinel), analyze phishing emails, perform initial log investigations, document incident tickets, and escalate confirmed threats to Tier 2.',
    requirements:
      '0–2 years of IT or helpdesk experience, CompTIA Security+ or Cisco CyberOps Associate, understanding of TCP/IP, OSI model, common ports, and basic log analysis.',
  },
  {
    title: 'Cybersecurity Analyst / Junior Incident Responder',
    duties:
      'Assist in containing endpoint security incidents, review EDR alerts, gather forensic artifacts from workstations, run scheduled vulnerability scans, and assist with post-incident summaries.',
    requirements:
      '1–3 years of IT experience (helpdesk, sysadmin support, or SOC analyst), Security+ or CySA+ or eJPT, familiarity with Wireshark, Nmap, Windows Event logs, and EDR platforms.',
  },
  {
    title: 'Associate Information Security Analyst (IAM & Compliance)',
    duties:
      'Process access control requests in Active Directory/Okta, perform quarterly user access audits, track vulnerability remediation tickets, and assist with security awareness training.',
    requirements:
      '0–3 years experience in IT or Cybersecurity degree, basic understanding of Identity & Access Management (IAM), NIST CSF guidelines, Active Directory, and basic PowerShell scripting.',
  },
  {
    title: 'Junior Web Penetration Tester / AppSec Associate',
    duties:
      'Perform automated and manual web vulnerability scans using Burp Suite and OWASP ZAP, verify common web flaws (XSS, SQLi, CSRF), write clear reproduction reports, and re-test remediations.',
    requirements:
      '1–3 years IT background or strong CTF/TryHackMe portfolio, eJPT or CompTIA PenTest+, solid knowledge of OWASP Top 10, HTTP protocols, and basic Python or Bash scripting.',
  },
];

export const JobContextSidebar: React.FC<JobContextSidebarProps> = ({
  jobDetails,
  onUpdateJobDetails,
  resumeFile,
  onUploadResume,
  onRemoveResume,
  qaFiles,
  onUploadQaFile,
  onAddQaLink,
  onRemoveQaFile,
  onParseJobUrl,
  isParsingUrl,
  isParsingResume,
  isParsingQaFile,
  selectedQuestionTypes,
  onToggleQuestionType,
  onSelectPresetQuestionTypes,
}) => {
  const [urlInput, setUrlInput] = useState(jobDetails.jobUrl || '');
  const [qaLinkInput, setQaLinkInput] = useState('');
  const [showPresets, setShowPresets] = useState(false);
  const [showResumePreview, setShowResumePreview] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  const handleUrlSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim()) return;
    setParseError(null);
    try {
      await onParseJobUrl(urlInput.trim());
    } catch (err: any) {
      setParseError('Failed to extract job listing from URL. Please enter details manually.');
    }
  };

  const handleResumeChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      await onUploadResume(e.target.files[0]);
    }
  };

  const handleQaFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      await onUploadQaFile(e.target.files[0]);
    }
  };

  const handleQaLinkSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (qaLinkInput.trim()) {
      onAddQaLink(qaLinkInput.trim());
      setQaLinkInput('');
    }
  };

  const selectPreset = (preset: typeof CYBER_JOB_PRESETS[0]) => {
    onUpdateJobDetails({
      jobTitle: preset.title,
      jobDuties: preset.duties,
      jobRequirements: preset.requirements,
    });
    setShowPresets(false);
  };

  return (
    <aside className="w-full lg:w-[320px] xl:w-[360px] bg-[#0c0c0e] border-b lg:border-b-0 lg:border-r border-slate-800 p-5 flex flex-col space-y-6 overflow-y-auto shrink-0 custom-scrollbar min-h-0">
      {/* URL Link Field (Optional) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
            <Globe className="w-3.5 h-3.5 text-blue-400" /> Job Role URL (Optional)
          </h2>
          <span className="text-[10px] text-slate-500">Auto-Extract</span>
        </div>
        <form onSubmit={handleUrlSubmit} className="space-y-2">
          <div className="relative">
            <input
              type="url"
              className="w-full bg-[#161618] border border-slate-700/80 rounded-lg p-2.5 text-xs text-blue-400 placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors pr-20"
              placeholder="https://careers.company.com/job/123"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
            />
            <button
              type="submit"
              disabled={isParsingUrl || !urlInput.trim()}
              className="absolute right-1 top-1 bottom-1 px-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-600 text-white rounded text-[10px] font-bold uppercase tracking-wider transition-colors flex items-center gap-1"
            >
              {isParsingUrl ? (
                <span className="animate-spin">🌀</span>
              ) : (
                <>
                  <Sparkles className="w-3 h-3" /> Fetch
                </>
              )}
            </button>
          </div>
          {parseError && (
            <p className="text-[11px] text-amber-400 flex items-center gap-1">
              <AlertCircle className="w-3 h-3 shrink-0" /> {parseError}
            </p>
          )}
        </form>
      </div>

      {/* Required Job Details */}
      <div className="space-y-3 pt-2 border-t border-slate-800/80">
        <div className="flex items-center justify-between">
          <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
            <Briefcase className="w-3.5 h-3.5 text-blue-400" /> Job Role Details
            <span className="text-red-400 text-xs">*</span>
          </h2>
          <button
            type="button"
            onClick={() => setShowPresets(!showPresets)}
            className="text-[10px] text-blue-400 hover:text-blue-300 font-medium underline flex items-center gap-0.5"
          >
            Presets {showPresets ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>

        {/* Quick Role Presets */}
        {showPresets && (
          <div className="p-2.5 bg-[#141416] border border-slate-700/60 rounded-lg space-y-2">
            <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
              Pick a Role Preset:
            </p>
            <div className="space-y-1.5">
              {CYBER_JOB_PRESETS.map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => selectPreset(preset)}
                  className="w-full text-left p-2 bg-[#1b1b1e] hover:bg-blue-950/40 border border-slate-800 hover:border-blue-500/40 rounded text-xs text-slate-200 transition-colors"
                >
                  <p className="font-semibold text-blue-300">{preset.title}</p>
                  <p className="text-[10px] text-slate-400 line-clamp-1">{preset.duties}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Job Title */}
        <div className="space-y-1">
          <label className="text-xs text-slate-400 font-medium flex items-center justify-between">
            <span>Job Title</span>
            <span className="text-[10px] text-red-400/80">Required</span>
          </label>
          <input
            type="text"
            required
            className="w-full bg-[#161618] border border-slate-700/80 rounded-lg p-2.5 text-xs text-slate-100 focus:outline-none focus:border-blue-500 transition-colors font-medium"
            placeholder="e.g. Senior Security Operations Analyst"
            value={jobDetails.jobTitle}
            onChange={(e) => onUpdateJobDetails({ jobTitle: e.target.value })}
          />
        </div>

        {/* Job Duties & Responsibilities */}
        <div className="space-y-1">
          <label className="text-xs text-slate-400 font-medium flex items-center justify-between">
            <span>Duties & Responsibilities</span>
            <span className="text-[10px] text-red-400/80">Required</span>
          </label>
          <textarea
            required
            rows={3}
            className="w-full bg-[#161618] border border-slate-700/80 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500 transition-colors resize-none custom-scrollbar"
            placeholder="e.g. Threat hunting, SIEM alert triage, ransomware response, vulnerability scanning..."
            value={jobDetails.jobDuties}
            onChange={(e) => onUpdateJobDetails({ jobDuties: e.target.value })}
          />
        </div>

        {/* Job Requirements */}
        <div className="space-y-1">
          <label className="text-xs text-slate-400 font-medium flex items-center justify-between">
            <span>Job Requirements</span>
            <span className="text-[10px] text-red-400/80">Required</span>
          </label>
          <textarea
            required
            rows={3}
            className="w-full bg-[#161618] border border-slate-700/80 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500 transition-colors resize-none custom-scrollbar"
            placeholder="e.g. 3+ years experience, CISSP / CEH, memory forensics, Splunk/Sentinel, NIST framework..."
            value={jobDetails.jobRequirements}
            onChange={(e) => onUpdateJobDetails({ jobRequirements: e.target.value })}
          />
        </div>
      </div>

      {/* Question Practice Focus & Category Mix */}
      <div className="space-y-3 pt-2 border-t border-slate-800/80">
        <div className="flex items-center justify-between">
          <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
            <Target className="w-3.5 h-3.5 text-blue-400" /> Practice Question Focus
          </h2>
          <span className="text-[10px] text-blue-400/90 font-mono">
            {selectedQuestionTypes.length} Selected
          </span>
        </div>
        <p className="text-[11px] text-slate-400 leading-snug">
          Choose question types to practice. Select specific categories or combine them.
        </p>

        {/* Individual Checkboxes / Toggle Cards */}
        <div className="space-y-1.5">
          {/* Technical */}
          <button
            type="button"
            onClick={() => onToggleQuestionType('technical')}
            className={`w-full flex items-center justify-between p-2.5 rounded-lg border text-xs transition-all ${
              selectedQuestionTypes.includes('technical')
                ? 'bg-cyan-950/40 border-cyan-500/50 text-cyan-200 shadow-sm'
                : 'bg-[#161618] border-slate-800 text-slate-400 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center space-x-2.5 text-left">
              <span className="text-sm">🛠️</span>
              <div>
                <p className="font-semibold text-xs leading-tight">Technical Questions</p>
                <p className="text-[10px] text-slate-400">SIEM, Log Forensics, Protocols & Architecture</p>
              </div>
            </div>
            <div
              className={`w-4 h-4 rounded flex items-center justify-center border transition-colors ${
                selectedQuestionTypes.includes('technical')
                  ? 'bg-cyan-500 border-cyan-400 text-slate-950'
                  : 'border-slate-700 bg-slate-900'
              }`}
            >
              {selectedQuestionTypes.includes('technical') && <Check className="w-3 h-3 stroke-[3]" />}
            </div>
          </button>

          {/* Behavioural */}
          <button
            type="button"
            onClick={() => onToggleQuestionType('behavioural')}
            className={`w-full flex items-center justify-between p-2.5 rounded-lg border text-xs transition-all ${
              selectedQuestionTypes.includes('behavioural')
                ? 'bg-purple-950/40 border-purple-500/50 text-purple-200 shadow-sm'
                : 'bg-[#161618] border-slate-800 text-slate-400 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center space-x-2.5 text-left">
              <span className="text-sm">🧠</span>
              <div>
                <p className="font-semibold text-xs leading-tight">Behavioural Questions</p>
                <p className="text-[10px] text-slate-400">STAR Scenarios, Crisis Response, Past Roles</p>
              </div>
            </div>
            <div
              className={`w-4 h-4 rounded flex items-center justify-center border transition-colors ${
                selectedQuestionTypes.includes('behavioural')
                  ? 'bg-purple-500 border-purple-400 text-slate-950'
                  : 'border-slate-700 bg-slate-900'
              }`}
            >
              {selectedQuestionTypes.includes('behavioural') && <Check className="w-3 h-3 stroke-[3]" />}
            </div>
          </button>

          {/* Soft Skills */}
          <button
            type="button"
            onClick={() => onToggleQuestionType('soft_skills')}
            className={`w-full flex items-center justify-between p-2.5 rounded-lg border text-xs transition-all ${
              selectedQuestionTypes.includes('soft_skills')
                ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-200 shadow-sm'
                : 'bg-[#161618] border-slate-800 text-slate-400 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center space-x-2.5 text-left">
              <span className="text-sm">💬</span>
              <div>
                <p className="font-semibold text-xs leading-tight">Soft Skills & Communication</p>
                <p className="text-[10px] text-slate-400">Executive Briefing, Conflict & Stress Handling</p>
              </div>
            </div>
            <div
              className={`w-4 h-4 rounded flex items-center justify-center border transition-colors ${
                selectedQuestionTypes.includes('soft_skills')
                  ? 'bg-emerald-500 border-emerald-400 text-slate-950'
                  : 'border-slate-700 bg-slate-900'
              }`}
            >
              {selectedQuestionTypes.includes('soft_skills') && <Check className="w-3 h-3 stroke-[3]" />}
            </div>
          </button>
        </div>

        {/* Preset Combinations */}
        <div className="pt-1">
          <p className="text-[10px] text-slate-400 font-mono mb-1.5 uppercase">Quick Preset Combinations:</p>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => onSelectPresetQuestionTypes(['technical', 'behavioural', 'soft_skills'])}
              className={`text-[10px] px-2 py-1 rounded border transition-colors ${
                selectedQuestionTypes.length === 3
                  ? 'bg-blue-600 text-white border-blue-400 font-bold'
                  : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-700'
              }`}
            >
              ✨ All 3 Types
            </button>
            <button
              type="button"
              onClick={() => onSelectPresetQuestionTypes(['technical', 'behavioural'])}
              className={`text-[10px] px-2 py-1 rounded border transition-colors ${
                selectedQuestionTypes.length === 2 &&
                selectedQuestionTypes.includes('technical') &&
                selectedQuestionTypes.includes('behavioural')
                  ? 'bg-blue-600 text-white border-blue-400 font-bold'
                  : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-700'
              }`}
            >
              Tech + Behavioural
            </button>
            <button
              type="button"
              onClick={() => onSelectPresetQuestionTypes(['technical', 'soft_skills'])}
              className={`text-[10px] px-2 py-1 rounded border transition-colors ${
                selectedQuestionTypes.length === 2 &&
                selectedQuestionTypes.includes('technical') &&
                selectedQuestionTypes.includes('soft_skills')
                  ? 'bg-blue-600 text-white border-blue-400 font-bold'
                  : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-700'
              }`}
            >
              Tech + Soft Skills
            </button>
            <button
              type="button"
              onClick={() => onSelectPresetQuestionTypes(['behavioural', 'soft_skills'])}
              className={`text-[10px] px-2 py-1 rounded border transition-colors ${
                selectedQuestionTypes.length === 2 &&
                selectedQuestionTypes.includes('behavioural') &&
                selectedQuestionTypes.includes('soft_skills')
                  ? 'bg-blue-600 text-white border-blue-400 font-bold'
                  : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-700'
              }`}
            >
              Behav + Soft Skills
            </button>
            <button
              type="button"
              onClick={() => onSelectPresetQuestionTypes(['technical'])}
              className={`text-[10px] px-2 py-1 rounded border transition-colors ${
                selectedQuestionTypes.length === 1 && selectedQuestionTypes.includes('technical')
                  ? 'bg-blue-600 text-white border-blue-400 font-bold'
                  : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-700'
              }`}
            >
              Technical Only
            </button>
            <button
              type="button"
              onClick={() => onSelectPresetQuestionTypes(['behavioural'])}
              className={`text-[10px] px-2 py-1 rounded border transition-colors ${
                selectedQuestionTypes.length === 1 && selectedQuestionTypes.includes('behavioural')
                  ? 'bg-blue-600 text-white border-blue-400 font-bold'
                  : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-700'
              }`}
            >
              Behavioural Only
            </button>
            <button
              type="button"
              onClick={() => onSelectPresetQuestionTypes(['soft_skills'])}
              className={`text-[10px] px-2 py-1 rounded border transition-colors ${
                selectedQuestionTypes.length === 1 && selectedQuestionTypes.includes('soft_skills')
                  ? 'bg-blue-600 text-white border-blue-400 font-bold'
                  : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-700'
              }`}
            >
              Soft Skills Only
            </button>
          </div>
        </div>
      </div>

      {/* Resume Upload (Optional) */}
      <div className="space-y-3 pt-2 border-t border-slate-800/80">
        <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
          <FileText className="w-3.5 h-3.5 text-blue-400" /> Resume Upload (Optional)
        </h2>

        {resumeFile ? (
          <div className="bg-[#141417] border border-slate-700/80 rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 truncate">
                <FileCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="text-xs text-slate-200 font-medium truncate">
                  {resumeFile.name}
                </span>
              </div>
              <button
                type="button"
                onClick={onRemoveResume}
                className="text-slate-500 hover:text-red-400 p-1 transition-colors"
                title="Remove resume"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
            {resumeFile.extractedText && (
              <div>
                <button
                  type="button"
                  onClick={() => setShowResumePreview(!showResumePreview)}
                  className="text-[10px] text-blue-400 hover:underline font-mono flex items-center gap-1"
                >
                  {showResumePreview ? 'Hide Extracted Key Details' : 'View Extracted Details'}
                </button>
                {showResumePreview && (
                  <div className="mt-2 p-2 bg-[#09090b] border border-slate-800 rounded text-[11px] text-slate-400 max-h-32 overflow-y-auto font-mono whitespace-pre-line custom-scrollbar">
                    {resumeFile.extractedText}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <label className="flex items-center space-x-3 w-full bg-[#161618] border border-dashed border-slate-700 hover:border-blue-500 rounded-lg p-3 cursor-pointer hover:bg-slate-800/50 transition-all group">
            <Upload className="w-4 h-4 text-slate-500 group-hover:text-blue-400 transition-colors shrink-0" />
            <div className="text-left">
              <p className="text-xs text-slate-300 font-medium">
                {isParsingResume ? 'Analyzing Resume...' : 'Upload Resume (PDF, DOC, TXT)'}
              </p>
              <p className="text-[10px] text-slate-500">Personalizes AI questions to your work history</p>
            </div>
            <input
              type="file"
              accept=".pdf,.doc,.docx,.txt"
              onChange={handleResumeChange}
              disabled={isParsingResume}
              className="hidden"
            />
          </label>
        )}
      </div>

      {/* Commonly Asked Questions Documents & Links (Optional) */}
      <div className="space-y-3 pt-2 border-t border-slate-800/80">
        <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5 text-blue-400" /> Q&A Documents & Links (Optional)
        </h2>
        <p className="text-[11px] text-slate-400 leading-snug">
          Upload interview prep files or paste links containing common questions for this role.
        </p>

        {/* Upload file button */}
        <label className="flex items-center justify-between w-full bg-[#161618] border border-slate-700/80 hover:border-blue-500 rounded-lg p-2.5 cursor-pointer hover:bg-slate-800/50 transition-colors">
          <div className="flex items-center space-x-2">
            <FileText className="w-4 h-4 text-blue-400" />
            <span className="text-xs text-slate-300 font-medium">
              {isParsingQaFile ? 'Parsing Q&A Doc...' : 'Attach Q&A Document'}
            </span>
          </div>
          <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded font-mono">
            + File
          </span>
          <input
            type="file"
            accept=".pdf,.doc,.docx,.txt"
            onChange={handleQaFileChange}
            disabled={isParsingQaFile}
            className="hidden"
          />
        </label>

        {/* Add link form */}
        <form onSubmit={handleQaLinkSubmit} className="flex gap-2">
          <input
            type="url"
            className="flex-1 bg-[#161618] border border-slate-700/80 rounded-lg p-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500"
            placeholder="Paste reference link (e.g. NIST IR)"
            value={qaLinkInput}
            onChange={(e) => setQaLinkInput(e.target.value)}
          />
          <button
            type="submit"
            disabled={!qaLinkInput.trim()}
            className="px-3 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 text-xs font-medium rounded-lg transition-colors"
          >
            Add
          </button>
        </form>

        {/* List of uploaded QA files & links */}
        {qaFiles.length > 0 && (
          <div className="space-y-1.5">
            {qaFiles.map((file) => (
              <div
                key={file.id}
                className="flex items-center justify-between text-xs text-slate-300 bg-slate-800/40 p-2.5 rounded-lg border border-slate-800"
              >
                <div className="flex items-center space-x-2 truncate">
                  {file.type === 'link' ? (
                    <Link className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                  ) : (
                    <FileText className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                  )}
                  <span className="truncate font-mono text-[11px]">{file.name}</span>
                </div>
                <button
                  type="button"
                  onClick={() => onRemoveQaFile(file.id)}
                  className="text-slate-500 hover:text-red-400 transition-colors p-0.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
};
