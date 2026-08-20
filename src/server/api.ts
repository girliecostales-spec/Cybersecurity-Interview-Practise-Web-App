import { GoogleGenAI, Type } from "@google/genai";
import express, { Request, Response, Router } from "express";

export const apiRouter = Router();

// Helper to get Gemini client lazily
let aiClient: GoogleGenAI | null = null;
function getAi(): GoogleGenAI {
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY || "",
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// Helper to sanitize Gemini response text
function cleanJsonResponse(text: string): string {
  let cleaned = text.trim();
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.replace(/^```json\s*/, "").replace(/\s*```$/, "");
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```\s*/, "").replace(/\s*```$/, "");
  }
  return cleaned;
}

// Track model rate limits and health
interface ModelStatus {
  exhaustedUntil: number; // timestamp until which this model should be deprioritized
  consecutiveFailures: number;
}

const modelHealthMap = new Map<string, ModelStatus>();

// Fallback sequence as specified by user:
// 1. Gemini 3.1 Flash Lite
// 2. Gemini 3.5 Flash Lite
// 3. Gemini Gemma 4 26B
// 4. Gemini Gemma 4 31B
const CANDIDATE_MODELS = [
  "gemini-3.1-flash-lite",
  "gemini-3.5-flash-lite",
  "gemma-4-26b",
  "gemini-gemma-4-26b",
  "gemma-4-31b",
  "gemini-gemma-4-31b",
  "gemini-3.6-flash",
  "gemini-flash-latest",
];

// Sorts candidate models so healthy (non-rate-limited) models are prioritized first
function getOrderedCandidateModels(): string[] {
  const now = Date.now();
  return [...CANDIDATE_MODELS].sort((a, b) => {
    const statusA = modelHealthMap.get(a) || { exhaustedUntil: 0, consecutiveFailures: 0 };
    const statusB = modelHealthMap.get(b) || { exhaustedUntil: 0, consecutiveFailures: 0 };

    const isExhaustedA = statusA.exhaustedUntil > now;
    const isExhaustedB = statusB.exhaustedUntil > now;

    if (isExhaustedA !== isExhaustedB) {
      return isExhaustedA ? 1 : -1; // Non-exhausted models come first
    }
    return statusA.consecutiveFailures - statusB.consecutiveFailures;
  });
}

function recordModelSuccess(model: string) {
  modelHealthMap.set(model, { exhaustedUntil: 0, consecutiveFailures: 0 });
}

function recordModelFailure(model: string, error: any) {
  const errStr = String(error?.message || error || "").toLowerCase();
  const isRateLimit =
    errStr.includes("429") ||
    errStr.includes("resource_exhausted") ||
    errStr.includes("quota") ||
    errStr.includes("rate limit") ||
    errStr.includes("limit exceeded");

  const prev = modelHealthMap.get(model) || { exhaustedUntil: 0, consecutiveFailures: 0 };
  const failures = prev.consecutiveFailures + 1;

  // Put rate-limited model on cooldown (minimum 10 mins for quota limits, 30s for general transient errors)
  const cooldownMs = isRateLimit ? Math.min(10 * 60 * 1000 * failures, 60 * 60 * 1000) : 30 * 1000;

  modelHealthMap.set(model, {
    exhaustedUntil: Date.now() + cooldownMs,
    consecutiveFailures: failures,
  });

  console.warn(
    `[Model Manager] Model '${model}' failed (${isRateLimit ? "429 Rate Limit/Quota Exceeded" : "Error"}). ` +
    `Switching to next available model. Cooldown: ${Math.round(cooldownMs / 1000)}s.`
  );
}

async function callGeminiContent(params: {
  contents: any;
  config?: any;
}) {
  const models = getOrderedCandidateModels();
  let lastError: any = null;

  for (const model of models) {
    try {
      const response = await getAi().models.generateContent({
        model,
        contents: params.contents,
        config: params.config,
      });

      recordModelSuccess(model);
      return response;
    } catch (err: any) {
      lastError = err;
      recordModelFailure(model, err);

      // If search tool or responseSchema caused incompatibility on a secondary model, retry without tools
      const errStr = String(err?.message || err).toLowerCase();
      if (
        params.config?.tools &&
        (errStr.includes("tool") || errStr.includes("search") || errStr.includes("not supported"))
      ) {
        try {
          const configWithoutTools = { ...params.config };
          delete configWithoutTools.tools;
          const response = await getAi().models.generateContent({
            model,
            contents: params.contents,
            config: configWithoutTools,
          });
          recordModelSuccess(model);
          return response;
        } catch (retryErr) {
          recordModelFailure(model, retryErr);
        }
      }
    }
  }
  throw lastError;
}

/**
 * 1. Extract job information from URL or webpage
 */
apiRouter.post("/parse-url", async (req: Request, res: Response) => {
  try {
    const { url } = req.body;
    if (!url || typeof url !== "string") {
      return res.status(400).json({ error: "URL is required" });
    }

    const prompt = `You are a cybersecurity recruiter assistant. Extract the Job Title, Job Duties and Responsibilities, and Job Requirements from the following job listing URL: ${url}. 
Use Google Search if needed to find details about this job posting or URL.

Return your response strictly in JSON format matching this schema:
{
  "jobTitle": "Exact or concise job title",
  "jobDuties": "Bullet points or detailed paragraph of key duties & responsibilities",
  "jobRequirements": "Bullet points or detailed paragraph of required skills, certifications (e.g. CISSP, CEH, Sec+), and experience"
}`;

    let parsed: any = null;
    try {
      const response = await callGeminiContent({
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }],
          responseMimeType: "application/json",
        },
      });
      const text = response.text || "{}";
      parsed = JSON.parse(cleanJsonResponse(text));
    } catch (apiErr) {
      console.warn("AI parsing failed for URL, generating fallback metadata:", apiErr);
      const urlLower = url.toLowerCase();
      let detectedTitle = "Cybersecurity Analyst";
      if (urlLower.includes("soc") || urlLower.includes("tier")) detectedTitle = "SOC Analyst / Incident Responder";
      if (urlLower.includes("engineer")) detectedTitle = "Cybersecurity Engineer";
      if (urlLower.includes("architect")) detectedTitle = "Security Architect";

      parsed = {
        jobTitle: detectedTitle,
        jobDuties: "• Monitor SIEM dashboards and triage high-priority security alerts\n• Investigate suspected malware infections and network anomalies\n• Contain active incidents and perform root cause forensic analysis\n• Collaborate with IT and engineering to enforce security policies",
        jobRequirements: "• Hands-on experience with SIEM, EDR, and log analysis tools\n• Solid understanding of OWASP Top 10, NIST CSF, and TCP/IP networking\n• Strong communication skills for incident reports and briefings\n• Certifications like Security+, CEH, CySA+, or CISSP preferred",
      };
    }

    return res.json(parsed);
  } catch (error: any) {
    console.error("Error in /parse-url:", error);
    return res.status(500).json({
      error: "Failed to extract job details from the provided URL.",
      details: error.message,
    });
  }
});

/**
 * 2. Parse uploaded file (Resume or Q&A Documents/Links)
 */
apiRouter.post("/parse-file", async (req: Request, res: Response) => {
  try {
    const { fileBase64, mimeType, fileName, fileType } = req.body;
    if (!fileBase64 || !mimeType) {
      return res.status(400).json({ error: "fileBase64 and mimeType are required" });
    }

    const isResume = fileType === "resume";
    const promptText = isResume
      ? `Analyze this candidate's resume for a cybersecurity role. Extract all key experience, technical skills, certifications (CISSP, CISM, CEH, Security+, OSCP, etc.), incident handling experience, SIEM/SOC tools used, and notable achievements into a structured text overview.`
      : `Analyze this cybersecurity study document or interview Q&A reference file ("${fileName || "document"}"). Extract all commonly asked interview questions, topics, frameworks (OWASP, NIST, MITRE ATT&CK), and key technical concepts mentioned inside.`;

    let extractedText = "";
    try {
      const response = await callGeminiContent({
        contents: {
          parts: [
            {
              inlineData: {
                mimeType,
                data: fileBase64,
              },
            },
            {
              text: promptText,
            },
          ],
        },
      });
      extractedText = response.text || "";
    } catch (apiErr) {
      console.warn("AI file parsing failed, using fallback extracted text:", apiErr);
      extractedText = isResume
        ? `Candidate Resume Summary (${fileName || "Uploaded File"}):\n• Domain Focus: Cybersecurity Operations & Incident Triage\n• Core Skills: SIEM Monitoring, EDR, Network Security, Vulnerability Analysis\n• Target Frameworks: NIST CSF, OWASP Top 10, MITRE ATT&CK`
        : `Study Guide / Q&A Document Summary (${fileName || "Uploaded File"}):\n• Key Topics: Incident response protocols, ransomware mitigation, access control, and executive communication.`;
    }

    return res.json({
      fileName,
      extractedText,
      fileType,
    });
  } catch (error: any) {
    console.error("Error in /parse-file:", error);
    return res.status(500).json({
      error: "Failed to parse the uploaded document.",
      details: error.message,
    });
  }
});

/**
 * 3. Generate Interview Questions (One-by-one)
 */
const FALLBACK_QUESTIONS = [
  // Technical Category
  {
    questionId: "fb_1",
    question: "A critical endpoint triggers a ransomware alert in your SIEM at 2:00 AM on a weekend. Walk me through your step-by-step containment and incident response protocol.",
    questionType: "technical",
    category: "Incident Response / SIEM",
    contextNote: "Testing core triage, isolation, and escalation procedures under high pressure.",
  },
  {
    questionId: "fb_2",
    question: "Walk me through the differences between Symmetric and Asymmetric Encryption, and explain how TLS 1.3 utilizes both during a secure connection handshake.",
    questionType: "technical",
    category: "Cryptography & Protocol Security",
    contextNote: "Testing foundational cryptographic principles.",
  },
  {
    questionId: "fb_3",
    question: "Do you have any experience with ethical hacking or penetration testing?",
    questionType: "technical",
    category: "Offensive Security & Pen Testing",
    contextNote: "Assessing hands-on experience with offensive security methodologies.",
  },
  {
    questionId: "fb_4",
    question: "What encryption tools, libraries, and protocols are you familiar with, and where have you implemented them?",
    questionType: "technical",
    category: "Cryptography & Tooling",
    contextNote: "Evaluating technical familiarity with enterprise encryption solutions.",
  },
  {
    questionId: "fb_5",
    question: "Have you ever defended against man-in-the-middle (MITM) or denial-of-service (DoS/DDoS) cyberattacks?",
    questionType: "technical",
    category: "Network Defense & Mitigation",
    contextNote: "Testing network-level defense experience.",
  },
  {
    questionId: "fb_6",
    question: "Explain your step-by-step process for mitigating cross-site scripting (XSS) vulnerabilities in web applications.",
    questionType: "technical",
    category: "Application & Web Security",
    contextNote: "Evaluating OWASP web application remediation knowledge.",
  },
  {
    questionId: "fb_7",
    question: "What is a data leak, and how do you prevent data loss or exfiltration from occurring across an enterprise network?",
    questionType: "technical",
    category: "Data Loss Prevention (DLP)",
    contextNote: "Testing understanding of DLP strategies and exfiltration vectors.",
  },
  {
    questionId: "fb_8",
    question: "Describe the specific steps you would take to investigate and respond to a confirmed security breach.",
    questionType: "technical",
    category: "Incident Response & DFIR",
    contextNote: "Assessing structured incident investigation protocols.",
  },
  {
    questionId: "fb_9",
    question: "You notice unusual outbound traffic spikes from an internal server at 3 AM. What are your immediate next steps?",
    questionType: "technical",
    category: "Network Monitoring & Anomaly Detection",
    contextNote: "Testing off-hours incident triage and log investigation skills.",
  },
  {
    questionId: "fb_10",
    question: "A user reports their corporate account was compromised. Walk me through how you respond from account lock down to root cause analysis.",
    questionType: "technical",
    category: "Identity & Account Compromise",
    contextNote: "Evaluating IAM incident response and credential remediation.",
  },
  {
    questionId: "fb_11",
    question: "How would you investigate and detect a potential insider threat attempting to access unauthorized sensitive assets?",
    questionType: "technical",
    category: "Insider Threat & UEBA",
    contextNote: "Testing user behavior analytics and internal monitoring strategies.",
  },
  {
    questionId: "fb_12",
    question: "Your organization suffered a widespread ransomware attack. Walk me through your step-by-step containment and restoration protocol.",
    questionType: "technical",
    category: "Ransomware Containment & Recovery",
    contextNote: "Evaluating major incident management and disaster recovery.",
  },
  {
    questionId: "fb_13",
    question: "How would you approach securing a newly provisioned multi-tenant cloud environment from scratch?",
    questionType: "technical",
    category: "Cloud Architecture & Security Posture",
    contextNote: "Assessing cloud security baseline design.",
  },
  {
    questionId: "fb_14",
    question: "You discover an unpatched critical vulnerability in a core production service. What immediate actions do you take?",
    questionType: "technical",
    category: "Vulnerability & Patch Management",
    contextNote: "Testing urgent risk mitigation and emergency patch procedures.",
  },
  {
    questionId: "fb_15",
    question: "How would you mitigate and handle a volumetric DDoS attack currently in progress against your primary web app?",
    questionType: "technical",
    category: "DDoS Mitigation & Traffic Scrubbing",
    contextNote: "Testing real-time network defense under fire.",
  },
  {
    questionId: "fb_16",
    question: "Multiple security alerts across different systems trigger simultaneously. Walk me through your process for prioritizing them.",
    questionType: "technical",
    category: "Alert Triage & Prioritization",
    contextNote: "Evaluating analytical risk prioritization during high alert volume.",
  },

  // Behavioural Category
  {
    questionId: "fb_17",
    question: "Describe a cybersecurity project you've worked on that you are most proud of.",
    questionType: "behavioural",
    category: "Project Highlights & Innovation",
    contextNote: "Assessing candidate initiative, engineering skill, and pride in ownership.",
  },
  {
    questionId: "fb_18",
    question: "Tell me about a time you experienced an interpersonal conflict in the workplace and explain how you resolved it constructively.",
    questionType: "behavioural",
    category: "Conflict Resolution & Diplomacy",
    contextNote: "Evaluating interpersonal communication and emotional intelligence.",
  },
  {
    questionId: "fb_19",
    question: "Tell me about a time when you demonstrated leadership or initiative in the workplace, formal or informal.",
    questionType: "behavioural",
    category: "Leadership & Initiative",
    contextNote: "Assessing leadership potential and taking charge during security gaps.",
  },
  {
    questionId: "fb_20",
    question: "Can you provide a specific example of a security incident you handled end-to-end and what the final outcome was?",
    questionType: "behavioural",
    category: "Incident History & STAR Outcome",
    contextNote: "Testing real-world incident response experience.",
  },
  {
    questionId: "fb_21",
    question: "Tell me about a time you ensured your organization's compliance with industry-specific security standards like HIPAA, PCI DSS, or ISO 27001.",
    questionType: "behavioural",
    category: "Compliance & Governance",
    contextNote: "Evaluating hands-on regulatory compliance enforcement.",
  },
  {
    questionId: "fb_22",
    question: "Describe a time you strongly disagreed with a team member or developer about a security approach. How did you handle it?",
    questionType: "behavioural",
    category: "Peer Disagreement & Collaboration",
    contextNote: "Testing technical negotiation and alignment.",
  },
  {
    questionId: "fb_23",
    question: "Tell me about a time you made a mistake during a security task or investigation. How did you handle it and what was the lesson?",
    questionType: "behavioural",
    category: "Accountability & Continuous Learning",
    contextNote: "Evaluating honesty, self-awareness, and process improvement.",
  },
  {
    questionId: "fb_24",
    question: "Describe your experience working in cross-functional teams alongside software engineers, DevOps, and business stakeholders.",
    questionType: "behavioural",
    category: "Cross-Functional Collaboration",
    contextNote: "Assessing teamwork in multi-disciplinary environments.",
  },

  // Soft Skills Category
  {
    questionId: "fb_25",
    question: "Do you have experience instructing or training non-technical personnel on cybersecurity protocols and phishing awareness?",
    questionType: "soft_skills",
    category: "Security Awareness & Education",
    contextNote: "Evaluating ability to translate security concepts to end users.",
  },
  {
    questionId: "fb_26",
    question: "An executive insists on bypassing a mandatory security control for personal convenience. How do you handle this professionally?",
    questionType: "soft_skills",
    category: "Stakeholder Management & Policy Enforcement",
    contextNote: "Testing diplomatic policy enforcement with leadership.",
  },
  {
    questionId: "fb_27",
    question: "You are asked to implement a new security tool with a very limited budget. How do you approach evaluating and selecting solutions?",
    questionType: "soft_skills",
    category: "Resourcefulness & Budgeting",
    contextNote: "Evaluating financial pragmatism and leveraging open-source or existing tools.",
  },
  {
    questionId: "fb_28",
    question: "How do you handle stress, pressure, and high-stakes situations during major security incidents?",
    questionType: "soft_skills",
    category: "Stress Management & Resilience",
    contextNote: "Assessing emotional composure and resilience under fire.",
  },
  {
    questionId: "fb_29",
    question: "How do you balance strict security requirements with the overall agility and operational needs of the business?",
    questionType: "soft_skills",
    category: "Business Enablement & Risk Balance",
    contextNote: "Evaluating pragmatic risk-versus-reward business decision making.",
  },
];

apiRouter.post("/generate-question", async (req: Request, res: Response) => {
  const {
    jobTitle,
    jobDuties,
    jobRequirements,
    resumeText,
    commonQuestionsDoc,
    previousQuestions = [],
    actionType = "next", // "next" | "retry" | "initial" | "follow_up"
    selectedQuestionTypes = ["technical", "behavioural", "soft_skills"],
    lastAnswer,
    lastEvaluation,
  } = req.body;

  const effectiveJobTitle = jobTitle?.trim() || "Cybersecurity Professional / SOC Analyst";
  const effectiveJobDuties = jobDuties?.trim() || "Security event monitoring, incident triage, log analysis, threat mitigation, and vulnerability management.";
  const effectiveJobRequirements = jobRequirements?.trim() || "Understanding of security fundamentals, SIEM tools, OWASP Top 10, NIST/ISO frameworks, and effective communication skills.";

  const requestedTypesStr = Array.isArray(selectedQuestionTypes) && selectedQuestionTypes.length > 0
    ? selectedQuestionTypes.join(", ")
    : "technical, behavioural, soft_skills";

  try {
    const systemInstruction = `You are a tough, professional, and highly knowledgeable Cybersecurity Hiring Manager conducting a live mock job interview. 
Your goal is to evaluate the candidate for the role of "${effectiveJobTitle}".

Context Provided:
- Job Title: ${effectiveJobTitle}
- Job Duties & Responsibilities: ${effectiveJobDuties}
- Job Requirements: ${effectiveJobRequirements}
- Candidate Resume Context: ${resumeText ? resumeText.slice(0, 2000) : "No resume uploaded."}
- Study Guides / Commonly Asked Questions Docs: ${
      commonQuestionsDoc ? commonQuestionsDoc.slice(0, 2000) : "None uploaded."
    }
- PREVIOUSLY ASKED QUESTIONS IN THIS SESSION (DO NOT REPEAT OR OVERLAP WITH THESE): ${JSON.stringify(previousQuestions)}
- ALLOWED QUESTION CATEGORIES FOR THIS TURN: Candidate selected to practice: [${requestedTypesStr}].

MANDATORY DIVERSITY & NON-REPETITION RULES:
1. STRICT NON-REPETITION MANDATE: You MUST NOT repeat, rephrase, or ask a question covering the exact same concept, scenario, or tool as any question in the previously asked list. Every single question MUST explore a fresh, distinct domain or angle.
2. ROTATE DOMAINS FREELY: Choose across a broad spectrum of cybersecurity domains (e.g. Incident Response, Digital Forensics, SIEM & Log Analysis, Web Application & OWASP, Network Protocols, Identity & Active Directory, Cloud Security, Zero Trust, Cryptography, Executive Reporting, Crisis Communication, Threat Hunting).
3. RESPECT CANDIDATE QUESTION TYPE SELECTION:
   - If 'technical' is requested: Ask technical cybersecurity scenario or knowledge questions.
   - If 'behavioural' is requested: Ask STAR-format situational questions (e.g. "Tell me about a time when...", "Describe a scenario where...").
   - If 'soft_skills' is requested: Ask soft skills, risk communication, executive briefings, or stress management questions.
   - Pick one type from allowed types: [${requestedTypesStr}].
4. Act directly as the hiring manager. Speak in second person ("you").
5. Return exactly ONE question at a time.
6. Output JSON matching the specified schema. Set 'questionType' to one of: 'technical', 'behavioural', 'soft_skills', 'resume_specific', or 'follow_up'.`;

    const userPrompt =
      actionType === "follow_up"
        ? `The candidate just answered the previous question: "${lastAnswer}". Ask a sharp, professional follow-up question based directly on their answer to probe deeper.`
        : `Generate a NEW, distinct interview question matching allowed types [${requestedTypesStr}]. Ensure it does NOT overlap with previous questions: ${JSON.stringify(
            previousQuestions
          )}. Pick a fresh topic/scenario in cybersecurity.`;

    const response = await callGeminiContent({
      contents: userPrompt,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            questionId: { type: Type.STRING },
            question: { type: Type.STRING },
            questionType: {
              type: Type.STRING,
              description: "Must be 'technical', 'behavioural', 'soft_skills', 'resume_specific', or 'follow_up'",
            },
            category: { type: Type.STRING, description: "e.g. 'Incident Response / Zero Trust' or 'Executive Risk Communication'" },
            contextNote: {
              type: Type.STRING,
              description: "Short line explaining why this question is being asked",
            },
          },
          required: ["question", "questionType", "category"],
        },
      },
    });

    const text = response.text || "{}";
    const questionObj = JSON.parse(cleanJsonResponse(text));
    if (!questionObj.question || typeof questionObj.question !== "string") {
      throw new Error("Invalid or empty question field from Gemini");
    }
    if (!questionObj.questionId) {
      questionObj.questionId = `q_${Date.now()}`;
    }

    return res.json(questionObj);
  } catch (error: any) {
    console.error("Error in /generate-question, serving fallback question:", error);
    // Find unasked fallback questions matching selected types
    const unaskedFallbacks = FALLBACK_QUESTIONS.filter(
      (q) =>
        !previousQuestions.some((prev: string) => prev.toLowerCase().includes(q.question.slice(0, 30).toLowerCase())) &&
        (selectedQuestionTypes.length === 0 || selectedQuestionTypes.includes(q.questionType as any))
    );

    const candidateFallback =
      unaskedFallbacks.length > 0
        ? unaskedFallbacks[Math.floor(Math.random() * unaskedFallbacks.length)]
        : FALLBACK_QUESTIONS[Math.floor(Math.random() * FALLBACK_QUESTIONS.length)];

    return res.json({
      ...candidateFallback,
      questionId: `q_fallback_${Date.now()}`,
    });
  }
});

/**
 * 4. Helper function to generate fallback evaluation when AI service is unavailable
 */
function buildFallbackEvaluation(params: {
  question: string;
  userAnswer: string;
  wordCount: number;
  effectiveDuration: number;
  inputMethod: string;
  jobTitle?: string;
  jobDuties?: string;
  jobRequirements?: string;
}) {
  const { question, userAnswer, wordCount, effectiveDuration, jobTitle } = params;
  const isOverTime = effectiveDuration > 120;
  const lowerAns = userAnswer.toLowerCase();

  // Detect STAR-L components
  const hasSituation =
    /situation|when|in my previous|at |while working|during|scenario|faced|company|organization|team/i.test(lowerAns) ||
    wordCount > 25;
  const hasTask = /task|responsibility|role|needed to|assigned|objective|goal|required|challenge|duty/i.test(lowerAns);
  const hasAction =
    /action|i implemented|i analyzed|i configured|i investigated|i isolated|i led|i developed|i created|i responded|i checked|i executed|i spoke|i documented/i.test(
      lowerAns
    ) || wordCount > 15;
  const hasResult =
    /result|outcome|reduced|prevented|successfully|impact|resolved|minimized|achieved|stopped|contained|fixed|saved/i.test(
      lowerAns
    );
  const hasLearning =
    /learn|takeaway|reflection|since then|going forward|lesson|improved|post-incident|future|retrospective/i.test(
      lowerAns
    );

  const durationMinSec = `${Math.floor(effectiveDuration / 60)}m ${effectiveDuration % 60}s`;
  const timeAssessment = isOverTime
    ? `Response duration (${wordCount} words, ~${durationMinSec}) exceeds the ideal 2-minute (120s) spoken limit. Streamline background context to stay concise.`
    : `Response length (${wordCount} words, ~${durationMinSec}) is well-paced and within the 2-minute spoken limit.`;

  const whatDoneWell: { part: string; reason: string }[] = [];
  const whatNeedsImprovement: { part: string; reason: string }[] = [];

  if (hasSituation) {
    whatDoneWell.push({
      part: "Situation",
      reason: "You established clear background context for the scenario effectively.",
    });
  } else {
    whatNeedsImprovement.push({
      part: "Situation",
      reason: "Initial context or background was brief. Clearly state the situation first.",
    });
  }

  if (hasTask) {
    whatDoneWell.push({
      part: "Task",
      reason: "You clearly outlined your specific responsibility or problem to solve.",
    });
  } else {
    whatNeedsImprovement.push({
      part: "Task",
      reason: "Your individual responsibility or core objective was not explicitly highlighted.",
    });
  }

  if (hasAction) {
    whatDoneWell.push({
      part: "Action",
      reason: "You detailed direct technical and operational steps you personally executed.",
    });
  } else {
    whatNeedsImprovement.push({
      part: "Action",
      reason: "Specific technical tools and direct steps taken were vague. Detail your exact actions.",
    });
  }

  if (hasResult) {
    whatDoneWell.push({
      part: "Result",
      reason: "You stated clear outcomes and positive impact or resolution metrics.",
    });
  } else {
    whatNeedsImprovement.push({
      part: "Result",
      reason: "Quantifiable metrics or explicit outcomes were missing. Conclude with the final result.",
    });
  }

  if (hasLearning) {
    whatDoneWell.push({
      part: "Learning",
      reason: "You included the 'L' in STAR-L by highlighting post-incident lessons learned.",
    });
  } else {
    whatNeedsImprovement.push({
      part: "Learning",
      reason: "Missing the 'Learning' element (L in STAR-L). Mention post-incident reflection or process improvements.",
    });
  }

  // Calculate score strictly based on present STAR-L components
  const presentCount =
    (hasSituation ? 1 : 0) +
    (hasTask ? 1 : 0) +
    (hasAction ? 1 : 0) +
    (hasResult ? 1 : 0) +
    (hasLearning ? 1 : 0);

  let score: number;
  if (presentCount < 3) {
    // Fewer than half present -> score MUST be strictly below 3.0
    score = 1.0 + presentCount * 0.7; // 0 -> 1.0, 1 -> 1.7, 2 -> 2.4
  } else {
    // 3, 4, or 5 present
    score = 2.0 + presentCount * 0.6; // 3 -> 3.8, 4 -> 4.4, 5 -> 5.0
  }

  if (isOverTime) {
    score = Math.max(1.0, score - 0.5);
  }
  score = Math.min(5.0, Math.max(1.0, Math.round(score * 10) / 10));

  const recommendedAnswer = `S - Situation: In my role as a ${jobTitle || "Cybersecurity Analyst"}, our SIEM flagged unusual administrative privilege escalation on a critical production web server during off-hours.

T - Task: My responsibility was to verify if the alert was a legitimate intrusion, contain potential credential harvesting, and determine the attack vector.

A - Action: I immediately isolated the affected machine at the EDR layer, disabled compromised domain credentials, reviewed authentication logs for foreign IP connections, and blocked the malicious IP address at the perimeter firewall.

R - Result: We successfully mitigated the attack within 20 minutes with zero lateral movement or unauthorized data exfiltration.

L - Learning: Following the incident, I worked with engineering to enforce MFA on all server logins, updated SIEM detection thresholds, and shared the IOC findings with our threat intelligence feed.`;

  const followUpQuestion =
    "What specific logs or SIEM filters would you analyze first to verify if lateral movement took place?";

  return {
    rating: score,
    timeAssessment,
    starlChecklist: {
      situation: {
        status: hasSituation ? "good" : "needs_work",
        note: hasSituation ? "Established clear background context." : "Explicitly set the scene and context.",
      },
      task: {
        status: hasTask ? "good" : "needs_work",
        note: hasTask ? "Stated clear role and objective." : "State your specific responsibility or problem.",
      },
      action: {
        status: hasAction ? "good" : "needs_work",
        note: hasAction ? "Detailed hands-on technical steps." : "Specify technical tools and direct steps taken.",
      },
      result: {
        status: hasResult ? "good" : "needs_work",
        note: hasResult ? "Stated clear impact or resolution." : "Include quantifiable outcome or final impact.",
      },
      learning: {
        status: hasLearning ? "good" : "needs_work",
        note: hasLearning ? "Reflections/learnings included." : "Include key lessons learned or process updates.",
      },
    },
    whatDoneWell,
    whatNeedsImprovement,
    recommendedAnswer,
    followUpQuestion,
    overallFeedback: `Solid response addressing the question: "${question.slice(0, 60)}...". ${
      isOverTime ? "Ensure you keep your spoken answer under 2 minutes." : "Your pacing is concise."
    } Incorporating all 5 parts of the STAR-L framework ensures a complete hiring manager evaluation.`,
  };
}

/**
 * 5. Evaluate Answer using STAR-L Framework & 2-Minute Constraint
 */
apiRouter.post("/evaluate-answer", async (req: Request, res: Response) => {
  const {
    question,
    userAnswer,
    durationSeconds = 0,
    inputMethod = "typed",
    jobTitle,
    jobDuties,
    jobRequirements,
    resumeText,
  } = req.body;

  if (!question || !userAnswer) {
    return res.status(400).json({
      error: "Question and User Answer are required.",
    });
  }

  const wordCount = userAnswer.trim().split(/\s+/).filter(Boolean).length;
  // Conversational speaking pace: ~138 words per minute (~2.3 words/sec)
  const estReadSeconds = Math.ceil(wordCount / 2.3);
  const effectiveDuration =
    inputMethod === "voice" && durationSeconds > 0
      ? durationSeconds
      : estReadSeconds;

  try {
    const systemInstruction = `You are an expert Cybersecurity Hiring Manager evaluating a candidate's answer during a mock interview.

Evaluation Criteria & Rules:
1. Ideal 2-Minute Spoken Threshold (120 Seconds):
   - In a live interview, an effective response MUST be delivered concisely in under 2 minutes (120 seconds) when spoken aloud.
   - Candidate Input Method: ${inputMethod === "voice" ? "Voice Mode (Recorded Speech)" : "Typed Text (Estimated Read-Aloud Duration)"}.
   - Response Length: ${wordCount} words.
   - Effective Spoken Duration: ${effectiveDuration} seconds (${Math.floor(effectiveDuration / 60)}m ${effectiveDuration % 60}s).
   - Rules for timeAssessment:
     - If duration > 120s: State clearly that the response is too long when spoken aloud (~${Math.floor(effectiveDuration / 60)}m ${effectiveDuration % 60}s). Recommend specific sentences or word count reductions to keep it under 2 minutes.
     - If duration <= 120s: Affirm that the response length is well-paced and concise for a live 2-minute interview delivery.
2. STAR-L Framework (Situation, Task, Action, Result, Learning):
   - Situation: Did they establish clear background/context?
   - Task: Did they state their specific responsibility or problem to solve?
   - Action: Did they detail specific technical/operational steps they personally took? (Must be realistic, no false/unreal claims).
   - Result: Did they quantify or clearly state the outcome/impact?
   - Learning: Did they share key lessons learned, reflections, or post-incident improvements?
3. Rating & Strict Scoring Rules:
   - Ratings MUST be strict, realistic, and rigorous. Do NOT give inflated high marks.
   - The STAR-L framework consists of 5 components: Situation, Task, Action, Result, Learning.
   - MANDATORY RULE: If less than half of the STAR-L components are present or well-executed in the answer (i.e. fewer than 3 out of 5 components are present), you MUST give an overall score strictly BELOW 3.0 (e.g. 1.0 to 2.8), EVEN IF the response satisfies the 2-minute time limit.
   - A score of 3.0 or higher is ONLY allowed if at least 3 out of 5 STAR-L components are clearly articulated.
   - Scores of 4.0 to 5.0 require 4 or 5 STAR-L components to be clearly covered and delivered within the 2-minute limit.
4. Feedback Breakdown:
   - What they did well (whatDoneWell): List which STAR-L elements were strong (part e.g. "Situation" or "Action") and WHY (reason).
   - What they did not do well (whatNeedsImprovement): List which STAR-L elements were weak or missing (part e.g. "Result" or "Learning") and WHY (reason).
5. Recommended Answer (recommendedAnswer): Provide a top-tier, realistic sample response using STAR-L tailored to this question and candidate background. Do not invent false scenarios.
6. Follow-up Question (followUpQuestion): Provide a relevant follow-up question to probe deeper if needed.`;

    const userPrompt = `Job Role: ${jobTitle || "Cybersecurity Professional"}
Job Duties: ${jobDuties || "Security event monitoring and incident response"}
Job Requirements: ${jobRequirements || "Technical security fundamentals"}
Candidate Resume context: ${resumeText ? resumeText.slice(0, 1000) : "N/A"}

Question Asked: "${question}"
Candidate Response (${inputMethod} mode, ${wordCount} words): "${userAnswer}"
Effective Spoken Duration: ${effectiveDuration} seconds (${Math.floor(effectiveDuration / 60)}m ${effectiveDuration % 60}s)

Please evaluate the candidate's answer thoroughly and provide structured feedback.`;

    const response = await callGeminiContent({
      contents: userPrompt,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            rating: {
              type: Type.NUMBER,
              description: "Score between 1.0 (poor) and 5.0 (excellent)",
            },
            timeAssessment: {
              type: Type.STRING,
              description: "Assessment of time taken vs 2 minute limit",
            },
            starlChecklist: {
              type: Type.OBJECT,
              properties: {
                situation: {
                  type: Type.OBJECT,
                  properties: {
                    status: { type: Type.STRING, description: "'good' | 'needs_work' | 'missing'" },
                    note: { type: Type.STRING },
                  },
                  required: ["status", "note"],
                },
                task: {
                  type: Type.OBJECT,
                  properties: {
                    status: { type: Type.STRING, description: "'good' | 'needs_work' | 'missing'" },
                    note: { type: Type.STRING },
                  },
                  required: ["status", "note"],
                },
                action: {
                  type: Type.OBJECT,
                  properties: {
                    status: { type: Type.STRING, description: "'good' | 'needs_work' | 'missing'" },
                    note: { type: Type.STRING },
                  },
                  required: ["status", "note"],
                },
                result: {
                  type: Type.OBJECT,
                  properties: {
                    status: { type: Type.STRING, description: "'good' | 'needs_work' | 'missing'" },
                    note: { type: Type.STRING },
                  },
                  required: ["status", "note"],
                },
                learning: {
                  type: Type.OBJECT,
                  properties: {
                    status: { type: Type.STRING, description: "'good' | 'needs_work' | 'missing'" },
                    note: { type: Type.STRING },
                  },
                  required: ["status", "note"],
                },
              },
              required: ["situation", "task", "action", "result", "learning"],
            },
            whatDoneWell: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  part: { type: Type.STRING, description: "STAR-L element e.g. 'Action' or 'Situation'" },
                  reason: { type: Type.STRING, description: "Detailed explanation of why it was good" },
                },
                required: ["part", "reason"],
              },
            },
            whatNeedsImprovement: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  part: { type: Type.STRING, description: "STAR-L element e.g. 'Result' or 'Learning'" },
                  reason: { type: Type.STRING, description: "Detailed explanation of what was lacking or missing" },
                },
                required: ["part", "reason"],
              },
            },
            recommendedAnswer: {
              type: Type.STRING,
              description: "A comprehensive sample answer using STAR-L",
            },
            followUpQuestion: {
              type: Type.STRING,
              description: "Optional follow-up question if needed",
            },
            overallFeedback: {
              type: Type.STRING,
              description: "Concise overall feedback summary",
            },
          },
          required: [
            "rating",
            "starlChecklist",
            "whatDoneWell",
            "whatNeedsImprovement",
            "recommendedAnswer",
            "overallFeedback",
          ],
        },
      },
    });

    const text = response.text || "{}";
    const evalObj = JSON.parse(cleanJsonResponse(text));

    if (!evalObj || typeof evalObj.rating !== "number") {
      throw new Error("Invalid response format from Gemini evaluation");
    }

    // Strict Enforcement Rule: If less than half of STAR-L components (fewer than 3 out of 5) are present,
    // cap the rating strictly below 3.0 even if the 2-minute time limit was met.
    if (evalObj.starlChecklist) {
      const parts = ["situation", "task", "action", "result", "learning"] as const;
      const goodCount = parts.filter(
        (part) => evalObj.starlChecklist[part] && evalObj.starlChecklist[part].status === "good"
      ).length;

      if (goodCount < 3 && evalObj.rating >= 3.0) {
        // Map 0 good -> 1.5, 1 good -> 2.0, 2 good -> 2.5
        evalObj.rating = Math.round((1.5 + goodCount * 0.5) * 10) / 10;
      }
    }

    return res.json(evalObj);
  } catch (error: any) {
    console.error("Error in /evaluate-answer, serving fallback evaluation:", error);
    const fallbackEval = buildFallbackEvaluation({
      question,
      userAnswer,
      wordCount,
      effectiveDuration,
      inputMethod,
      jobTitle,
      jobDuties,
      jobRequirements,
    });
    return res.json(fallbackEval);
  }
});
