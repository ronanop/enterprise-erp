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

export type OffboardingCase = {
  id: string;
  documentNumber: string;
  employeeId: string;
  employeeName: string;
  separationType: SeparationType | string;
  requestedLwd: string;
  approvedLwd: string | null;
  status: string;
  fnfStatus: string;
  fnfPayrollRunId: string | null;
  reason: string | null;
  checklist: ClearanceChecklistItem[];
  exitInterview: ExitInterviewData | null;
  fnfMeta: Record<string, unknown> | null;
};

export const SEPARATION_TYPE_LABELS: Record<string, string> = {
  resignation: "Resignation",
  termination: "Termination",
  retirement: "Retirement",
};

export const WORKFLOW_STEPS = [
  { key: "draft", label: "Draft" },
  { key: "submitted", label: "Submitted" },
  { key: "manager_approved", label: "Manager approved" },
  { key: "hr_approved", label: "HR approved" },
  { key: "fnf", label: "FNF settlement" },
  { key: "completed", label: "Completed" },
] as const;

export function workflowStepIndex(status: string, fnfStatus: string): number {
  const s = status.toLowerCase();
  if (s === "completed") return 5;
  if (s === "hr_approved") {
    const f = fnfStatus.toLowerCase();
    if (f === "settled" || f === "waived" || f === "calculated") return 4;
    return 3;
  }
  if (s === "manager_approved") return 2;
  if (s === "submitted") return 1;
  return 0;
}
