/** HR offboarding (exit) — view models mapped from /hr/separation API */

export type SeparationType = "resignation" | "termination" | "retirement";

export type ClearanceChecklistItem = {
  key: string;
  label: string;
  done: boolean;
  notes: string | null;
};

export type ExitInterviewData = {
  answers: Record<string, string>;
  interviewerNotes: string | null;
  capturedAt?: string;
};

export type ExitDocument = {
  id: string;
  name: string;
  docType: string;
  notes: string | null;
  fileName: string | null;
  uploadedAt: string | null;
};

export type WorkflowApprovalEntry = {
  id: string;
  stage: string;
  remarks: string | null;
  fileName: string | null;
  fileDataUrl: string | null;
  at: string | null;
  by: string | null;
};

export type OffboardingCase = {
  id: string;
  documentNumber: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  separationType: SeparationType | string;
  requestedLwd: string;
  approvedLwd: string | null;
  status: string;
  fnfStatus: string;
  fnfPayrollRunId: string | null;
  reason: string | null;
  checklist: ClearanceChecklistItem[];
  exitInterview: ExitInterviewData | null;
  documents: ExitDocument[];
  approvals: WorkflowApprovalEntry[];
  fnfMeta: Record<string, unknown> | null;
};

export const SEPARATION_TYPE_LABELS: Record<string, string> = {
  resignation: "Resignation",
  termination: "Termination",
  retirement: "Retirement",
};

/** Primary approval + settlement strip */
export const WORKFLOW_STEPS = [
  { key: "submitted", label: "Submitted" },
  { key: "manager_approved", label: "Manager Approved" },
  { key: "it_approved", label: "IT Approved" },
  { key: "accounts_approved", label: "Accounts Approved" },
  { key: "hr_approved", label: "HR Approved" },
  { key: "fnf", label: "FNF Settlement" },
  { key: "completed", label: "Completed" },
] as const;

/** Post-HR secondary track */
export const POST_HR_STEPS = [
  { key: "exit_interview", label: "Exit Interview" },
  { key: "documents", label: "Upload Document" },
  { key: "fnf", label: "FNF" },
  { key: "docs_done", label: "Documents" },
] as const;

/**
 * Index of the *current pending* pipeline step (highlighted).
 * Completed stages are those before this index (green check).
 * e.g. manager_approved → Manager is done, IT is current.
 */
export function workflowStepIndex(status: string, fnfStatus: string): number {
  const s = status.toLowerCase();
  const f = fnfStatus.toLowerCase();
  // Past the last step → all checks green, none highlighted as pending
  if (s === "completed") return WORKFLOW_STEPS.length;
  if (s === "hr_approved") {
    // HR done → FNF is current until settled/waived, then Completed is current
    if (f === "settled" || f === "waived") return 6;
    return 5;
  }
  if (s === "accounts_approved") return 4; // → HR
  if (s === "it_approved") return 3; // → Accounts
  if (s === "manager_approved") return 2; // → IT
  if (s === "submitted") return 1; // → Manager
  if (s === "draft") return 0; // → Submit
  return 0;
}

export function postHrStepIndex(c: OffboardingCase): number {
  const s = c.status.toLowerCase();
  if (!["hr_approved", "completed"].includes(s)) return -1;
  const f = c.fnfStatus.toLowerCase();
  const hasInterview = Boolean(c.exitInterview);
  const hasDocs = (c.documents?.length ?? 0) > 0;
  if (s === "completed") return 3;
  if (f === "settled" || f === "waived") return hasDocs ? 3 : 2;
  if (f === "calculated" || f === "prepared") return 2;
  if (hasInterview && hasDocs) return 2;
  if (hasInterview) return 1;
  return 0;
}
