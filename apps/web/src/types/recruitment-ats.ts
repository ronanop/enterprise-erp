/** Enterprise ATS — Recruitment types */

export type JobStatus = "open" | "closed" | "on_hold";
export type JobPriority = "low" | "medium" | "high" | "critical";
export type EmploymentType = "full_time" | "contract" | "intern" | "part_time";

export type PipelineStage =
  | "applied"
  | "resume_screening"
  | "hr_screening"
  | "technical_interview"
  | "manager_interview"
  | "final_interview"
  | "offer"
  | "hired"
  | "rejected";

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

export type InterviewType = "hr" | "technical" | "manager" | "final";
export type InterviewMode = "online" | "offline";
export type InterviewRecommendation = "selected" | "hold" | "rejected";

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

export const PIPELINE_STAGES: { id: PipelineStage; label: string }[] = [
  { id: "applied", label: "Applied" },
  { id: "resume_screening", label: "Resume Screening" },
  { id: "hr_screening", label: "HR Screening" },
  { id: "technical_interview", label: "Technical Interview" },
  { id: "manager_interview", label: "Manager Interview" },
  { id: "final_interview", label: "Final Interview" },
  { id: "offer", label: "Offer" },
  { id: "hired", label: "Hired" },
  { id: "rejected", label: "Rejected" },
];

export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  open: "Open",
  closed: "Closed",
  on_hold: "On Hold",
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
  location: string;
  resumeName: string;
  portfolioUrl: string;
  linkedinUrl: string;
  source: CandidateSource;
  recruiter: string;
  createdAt: string;
  updatedAt: string;
  apiId?: string;
};

export type PipelineApplication = {
  id: string;
  applicationCode: string;
  candidateId: string;
  jobId: string;
  stage: PipelineStage;
  appliedAt: string;
  notes: string;
  updatedAt: string;
};

export type AtsInterview = {
  id: string;
  interviewCode: string;
  candidateId: string;
  jobId: string;
  applicationId: string;
  interviewType: InterviewType;
  date: string;
  time: string;
  mode: InterviewMode;
  interviewer: string;
  meetingLink: string;
  location: string;
  notes: string;
  feedback: string;
  rating: number;
  recommendation: InterviewRecommendation | "";
  status: "scheduled" | "completed" | "cancelled";
  createdAt: string;
};

export type AtsOffer = {
  id: string;
  offerCode: string;
  candidateId: string;
  jobId: string;
  applicationId: string;
  department: string;
  joiningDate: string;
  ctc: number;
  expiryDate: string;
  offerLetterName: string;
  status: OfferStatus;
  createdAt: string;
  updatedAt: string;
};

export type AtsDocument = {
  id: string;
  candidateId: string;
  kind: DocKind;
  fileName: string;
  uploadedAt: string;
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
};

export function emptyAtsFilters(): AtsFilters {
  return { status: "all", department: "all", stage: "all", source: "all", query: "" };
}

export type CreateJobInput = Omit<
  JobOpening,
  "id" | "jobCode" | "filled" | "createdAt" | "updatedAt" | "apiId"
>;

export type CreateCandidateInput = Omit<
  AtsCandidate,
  "id" | "candidateCode" | "createdAt" | "updatedAt" | "apiId"
>;
