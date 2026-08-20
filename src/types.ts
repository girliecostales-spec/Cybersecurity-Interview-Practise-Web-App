export interface JobDetails {
  jobTitle: string;
  jobDuties: string;
  jobRequirements: string;
  jobUrl?: string;
}

export interface UploadedFileItem {
  id: string;
  name: string;
  size?: string;
  type: 'resume' | 'qa_doc' | 'link';
  extractedText?: string;
  url?: string;
}

export interface QuestionData {
  questionId: string;
  question: string;
  questionType: 'technical' | 'behavioural' | 'soft_skills' | 'resume_specific' | 'follow_up';
  category: string;
  contextNote?: string;
  tips?: string;
}

export interface StarlElementAssessment {
  status: 'good' | 'needs_work' | 'missing';
  note: string;
}

export interface StarlChecklist {
  situation: StarlElementAssessment;
  task: StarlElementAssessment;
  action: StarlElementAssessment;
  result: StarlElementAssessment;
  learning: StarlElementAssessment;
}

export interface FeedbackItem {
  part: string;
  reason: string;
}

export interface EvaluationResult {
  rating: number; // 1.0 to 5.0
  timeAssessment?: string;
  starlChecklist: StarlChecklist;
  whatDoneWell: FeedbackItem[];
  whatNeedsImprovement: FeedbackItem[];
  recommendedAnswer: string;
  followUpQuestion?: string;
  overallFeedback: string;
}

export interface InterviewTurn {
  id: string;
  question: QuestionData;
  userAnswer: string;
  durationSeconds: number;
  evaluation?: EvaluationResult;
  timestamp: number;
}
