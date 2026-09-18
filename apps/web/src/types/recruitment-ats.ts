/** Enterprise ATS — Recruitment types */

export type JobStatus = "open" | "closed" | "on_hold" | "draft";
export type JobPriority = "low" | "medium" | "high" | "critical";
export type EmploymentType = "full_time" | "contract" | "intern" | "part_time";

export type {
  CandidatePipelineStatus,
  PipelineStageId as PipelineStage,
} from "@/config/pipeline-config";

import type {
  CandidatePipelineStatus,
  PipelineStageId,
} from "@/config/pipeline-config";
import {
  PIPELINE_STAGES as CONFIG_STAGES,
  STATUS_LABELS,
} from "@/config/pipeline-config";

export type CandidateSource =
  | "referral"
  | "linkedin"
  | "indeed"
  | "naukri"
  | "company_website"
  | "campus"
  | "walk_in"
  | "recruiter"
  | "other";

/** Round name used when scheduling interviews */
export type InterviewRound = "round_1" | "round_2" | "hr";
export type InterviewMode = "online" | "offline";
export type InterviewRecommendation = "selected" | "hold" | "rejected";

/** @deprecated prefer InterviewRound */
export type InterviewType = "hr" | "technical" | "manager" | "final" | InterviewRound;

export type OfferStatus = "draft" | "sent" | "accepted" | "rejected" | "expired";

export type DocKind =
  | "resume"
  | "portfolio"
  | "certificate"
  | "experience_letter"
  | "education"
  | "identity"
  | "offer_letter"
  | "other";

export type DocVerificationStatus = "verified" | "pending" | "expired";

export const DOC_KIND_LABELS: Record<DocKind, string> = {
  resume: "Resume",
  portfolio: "Portfolio",
  certificate: "Certificate",
  experience_letter: "Experience",
  education: "Academic",
  identity: "Identity",
  offer_letter: "Offer Letter",
  other: "Other",
};

export const DOC_STATUS_LABELS: Record<DocVerificationStatus, string> = {
  verified: "Verified",
  pending: "Pending",
  expired: "Expired",
};

export const PIPELINE_STAGES: { id: PipelineStageId; label: string }[] =
  CONFIG_STAGES.map((s) => ({ id: s.id, label: s.label }));

export const CANDIDATE_STATUS_LABELS = STATUS_LABELS;

export const INTERVIEW_ROUND_LABELS: Record<InterviewRound, string> = {
  round_1: "Round 1",
  round_2: "Round 2",
  hr: "HR Discussion",
};

export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  open: "Open",
  closed: "Closed",
  on_hold: "On Hold",
  draft: "Draft",
};

export const SOURCE_LABELS: Record<CandidateSource, string> = {
  referral: "Referral",
  linkedin: "LinkedIn",
  indeed: "Indeed",
  naukri: "Naukri",
  company_website: "Company Website",
  campus: "Campus",
  walk_in: "Walk-In",
  recruiter: "Recruiter",
  other: "Other",
};

export const OFFER_STATUS_LABELS: Record<OfferStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  accepted: "Accepted",
  rejected: "Rejected",
  expired: "Expired",
};

export type JobOpening = {
  id: string;
  jobCode: string;
  title: string;
  department: string;
  designation: string;
  employmentType: EmploymentType;
  branch: string;
  location: string;
  hiringManager: string;
  recruiter: string;
  positions: number;
  filled: number;
  salaryMin: number;
  salaryMax: number;
  experienceMin: number;
  experienceMax: number;
  skills: string[];
  description: string;
  deadline: string;
  priority: JobPriority;
  status: JobStatus;
  createdAt: string;
  updatedAt: string;
  apiId?: string;
  /** Job description document name/URI for interview attach */
  jdFileName?: string;
};

export type AtsCandidate = {
  id: string;
  candidateCode: string;
  fullName: string;
  email: string;
  phone: string;
  alternatePhone: string;
  gender: string;
  dob: string;
  currentCompany: string;
  currentDesignation: string;
  experienceYears: number;
  expectedSalary: number;
  noticePeriodDays: number;
  /** Legacy single-line location; prefer address/state/pincode */
  location: string;
  address: string;
  state: string;
  pincode: string;
  resumeName: string;
  resumeUrl: string;
  portfolioUrl: string;
  linkedinUrl: string;
  source: CandidateSource;
  recruiter: string;
  createdAt: string;
  updatedAt: string;
  apiId?: string;
};

export type StageHistoryEntry = {
  stage: PipelineStageId;
  label: string;
  enteredAt: string;
  exitedAt?: string;
};

export type PipelineApplication = {
  id: string;
  applicationCode: string;
  candidateId: string;
  jobId: string;
  stage: PipelineStageId;
  status: CandidatePipelineStatus;
  appliedAt: string;
  notes: string;
  updatedAt: string;
  stageEnteredAt?: string;
  stageHistory?: StageHistoryEntry[];
  exitedAtStage?: PipelineStageId | null;
  exitedAt?: string | null;
  exitReason?: string | null;
};

export type AtsInterview = {
  id: string;
  interviewCode: string;
  candidateId: string;
  jobId: string;
  applicationId: string;
  /** Round name: Round 1 / Round 2 / HR */
  interviewType: InterviewType;
  round: InterviewRound;
  date: string;
  time: string;
  mode: InterviewMode;
  interviewer: string;
  /** Employee participant ids */
  participantIds: string[];
  participantNames: string[];
  meetingLink: string;
  location: string;
  resumeLink: string;
  sectionContent: string;
  notes: string;
  feedback: string;
  rating: number;
  recommendation: InterviewRecommendation | "";
  status: "scheduled" | "completed" | "cancelled" | "rescheduled";
  createdAt: string;
};

export type OfferTemplateKind =
  | "standard"
  | "with_benefits"
  | "internship"
  | "custom";

export type AtsOffer = {
  id: string;
  offerCode: string;
  candidateId: string;
  jobId: string;
  applicationId: string;
  department: string;
  location?: string;
  joiningDate: string;
  ctc: number;
  basicSalary?: number;
  variablePay?: number;
  reportingManager?: string;
  employmentType?: EmploymentType | string;
  notes?: string;
  expiryDate: string;
  templateKind?: OfferTemplateKind;
  offerLetterName: string;
  templateFileName: string;
  mergedPreview: string;
  status: OfferStatus;
  createdAt: string;
  updatedAt: string;
};

export const OFFER_TEMPLATE_OPTIONS: {
  id: OfferTemplateKind;
  label: string;
  description: string;
}[] = [
  {
    id: "standard",
    label: "Standard Offer Letter",
    description: "Default company offer letter with all standard clauses.",
  },
  {
    id: "with_benefits",
    label: "With Benefits",
    description: "Includes benefits, insurance and other perks.",
  },
  {
    id: "internship",
    label: "Internship Offer",
    description: "Template for internship positions.",
  },
  {
    id: "custom",
    label: "Custom Template",
    description: "Use a custom template.",
  },
];

export type AtsDocument = {
  id: string;
  candidateId: string;
  kind: DocKind;
  fileName: string;
  uploadedAt: string;
  status?: DocVerificationStatus;
  expiryDate?: string;
  url?: string;
};

export type AtsAuditEntry = {
  id: string;
  action: string;
  detail: string;
  actor: string;
  at: string;
  entityId?: string;
};

export type AtsFilters = {
  status: string;
  department: string;
  stage: string;
  source: string;
  query: string;
  location: string;
  employmentType: string;
  priority: string;
};

export function emptyAtsFilters(): AtsFilters {
  return {
    status: "all",
    department: "all",
    stage: "all",
    source: "all",
    query: "",
    location: "all",
    employmentType: "all",
    priority: "all",
  };
}

export type CreateJobInput = Omit<
  JobOpening,
  "id" | "jobCode" | "filled" | "createdAt" | "updatedAt" | "apiId"
>;

export type CreateCandidateInput = Omit<
  AtsCandidate,
  "id" | "candidateCode" | "createdAt" | "updatedAt" | "apiId"
>;
