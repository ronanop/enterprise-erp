import { ApiClientError, resourceService } from "@/services/api-client";
import { loadEmployeeDirectory } from "@/services/employee-management-service";
import type { HrRow } from "@/services/hr-service";
import { loadOnboardingDirectory } from "@/services/onboarding-management-service";
import type {
  ClearanceChecklistItem,
  ExitDocument,
  ExitInterviewData,
  OffboardingCase,
  SeparationType,
  WorkflowApprovalEntry,
} from "@/types/offboarding";

const DEFAULT_CHECKLIST: ClearanceChecklistItem[] = [
  { key: "assets", label: "Asset return", done: false, notes: null },
  { key: "it", label: "IT access revocation", done: false, notes: null },
  { key: "finance", label: "Finance clearance", done: false, notes: null },
  { key: "hr", label: "HR clearance", done: false, notes: null },
  { key: "exit_interview", label: "Exit interview", done: false, notes: null },
];

function parseDone(raw: unknown): boolean {
  if (raw === true || raw === 1) return true;
  if (typeof raw === "string") return raw.toLowerCase() === "true" || raw === "1";
  return false;
}

function parseClearance(raw: unknown): {
  checklist: ClearanceChecklistItem[];
  exitInterview: ExitInterviewData | null;
  documents: ExitDocument[];
  approvals: WorkflowApprovalEntry[];
  fnfMeta: Record<string, unknown> | null;
} {
  const c = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const list = Array.isArray(c.checklist) ? c.checklist : DEFAULT_CHECKLIST;
  const checklist: ClearanceChecklistItem[] = list.map((item) => {
    const o = item as Record<string, unknown>;
    return {
      key: String(o.key ?? ""),
      label: String(o.label ?? o.key ?? "Item"),
      done: parseDone(o.done),
      notes: o.notes != null ? String(o.notes) : null,
    };
  });
  const ei = c.exit_interview as Record<string, unknown> | null | undefined;
  const exitInterview: ExitInterviewData | null = ei
    ? {
        answers: (ei.answers as Record<string, string>) ?? {},
        interviewerNotes: ei.interviewer_notes != null ? String(ei.interviewer_notes) : null,
        capturedAt:
          ei.captured_at != null
            ? String(ei.captured_at)
            : ei.completed_at != null
              ? String(ei.completed_at)
              : undefined,
      }
    : null;
  const docsRaw = Array.isArray(c.documents) ? c.documents : [];
  const documents = docsRaw.map((item) => {
    const o = item as Record<string, unknown>;
    return {
      id: String(o.id ?? ""),
      name: String(o.name ?? "Document"),
      docType: String(o.doc_type ?? "other"),
      notes: o.notes != null ? String(o.notes) : null,
      fileName: o.file_name != null ? String(o.file_name) : null,
      uploadedAt: o.uploaded_at != null ? String(o.uploaded_at) : null,
    };
  });
  const approvalsRaw = Array.isArray(c.approvals) ? c.approvals : [];
  const approvals: WorkflowApprovalEntry[] = approvalsRaw.map((item) => {
    const o = item as Record<string, unknown>;
    return {
      id: String(o.id ?? ""),
      stage: String(o.stage ?? ""),
      remarks: o.remarks != null ? String(o.remarks) : null,
      fileName: o.file_name != null ? String(o.file_name) : null,
      fileDataUrl: o.file_data_url != null ? String(o.file_data_url) : null,
      at: o.at != null ? String(o.at) : null,
      by: o.by != null ? String(o.by) : null,
    };
  });
  const fnfMeta = (c.fnf as Record<string, unknown>) ?? null;
  return { checklist, exitInterview, documents, approvals, fnfMeta };
}

const NO_ONBOARDING_LABEL = "No onboarding";

type EmployeeLookups = {
  names: Map<string, string>;
  codes: Map<string, string>;
  knownIds: Set<string>;
};

async function loadEmployeeLookups(): Promise<EmployeeLookups> {
  const names = new Map<string, string>();
  const codes = new Map<string, string>();
  const knownIds = new Set<string>();

  const [directory, onboarding] = await Promise.all([
    loadEmployeeDirectory().catch(() => null),
    loadOnboardingDirectory().catch(() => null),
  ]);

  if (directory) {
    for (const r of directory.records) {
      if (r.isDeleted) continue;
      const id = String(r.id);
      if (!id) continue;
      knownIds.add(id);
      if (r.displayName.trim()) names.set(id, r.displayName.trim());
      if (r.employeeCode.trim()) codes.set(id, r.employeeCode.trim());
    }
  }

  if (onboarding) {
    for (const c of onboarding.cases) {
      const id = String(c.employeeId ?? "").trim();
      if (!id) continue;
      knownIds.add(id);
      const nm = String(c.candidateName ?? "").trim();
      if (nm && !names.has(id)) names.set(id, nm);
      const code = String(c.assignedEmployeeCode ?? "").trim();
      if (code && !codes.has(id)) codes.set(id, code);
    }
  }

  return { names, codes, knownIds };
}

export function mapOffboardingRow(
  row: HrRow,
  lookups: EmployeeLookups,
): OffboardingCase {
  const { checklist, exitInterview, documents, approvals, fnfMeta } = parseClearance(row.clearance_json);
  const employeeId = String(row.employee_id ?? "");
  const known = Boolean(employeeId) && lookups.knownIds.has(employeeId);
  return {
    id: String(row.id),
    documentNumber: String(row.document_number ?? row.id),
    employeeId,
    employeeName: known ? lookups.names.get(employeeId) || "—" : NO_ONBOARDING_LABEL,
    employeeCode: known ? lookups.codes.get(employeeId) || "—" : "—",
    hasEmployeeRecord: known,
    separationType: String(row.separation_type ?? "resignation"),
    requestedLwd: String(row.requested_last_working_date ?? ""),
    approvedLwd: row.approved_last_working_date
      ? String(row.approved_last_working_date)
      : null,
    resignationDate: row.resignation_date ? String(row.resignation_date) : null,
    noticePeriodDays:
      row.notice_period_days != null && row.notice_period_days !== ""
        ? Number(row.notice_period_days)
        : null,
    noticeStartDate: row.notice_start_date ? String(row.notice_start_date) : null,
    expectedExitDate: row.expected_exit_date ? String(row.expected_exit_date) : null,
    noticeStatus: String(row.notice_status ?? "pending"),
    initiatedBy: String(row.initiated_by ?? "hr"),
    status: String(row.status ?? "draft"),
    fnfStatus: String(row.fnf_status ?? "pending"),
    fnfPayrollRunId: row.fnf_payroll_run_id ? String(row.fnf_payroll_run_id) : null,
    reason: row.reason != null ? String(row.reason) : null,
    checklist,
    exitInterview,
    documents,
    approvals,
    fnfMeta,
  };
}

export async function loadOffboardingCases(): Promise<OffboardingCase[]> {
  const [sepRes, lookups] = await Promise.all([
    resourceService.list<HrRow>("/hr/separation", { page_size: 200 }).catch(() => ({ data: [] })),
    loadEmployeeLookups(),
  ]);
  const rows = Array.isArray(sepRes.data) ? sepRes.data : [];
  return rows.map((r) => mapOffboardingRow(r as HrRow, lookups));
}

export async function createOffboardingCase(input: {
  branchId: string;
  employeeId: string;
  separationType: SeparationType;
  requestedLastWorkingDate: string;
  reason?: string;
  resignationDate?: string;
  noticePeriodDays?: number | null;
  expectedExitDate?: string;
  serveNotice?: boolean;
}): Promise<OffboardingCase> {
  const res = await resourceService.create<HrRow>("/hr/separation", {
    branch_id: input.branchId,
    employee_id: input.employeeId,
    separation_type: input.separationType,
    requested_last_working_date: input.requestedLastWorkingDate,
    reason: input.reason ?? null,
    resignation_date: input.resignationDate ?? null,
    notice_period_days: input.noticePeriodDays ?? null,
    expected_exit_date: input.expectedExitDate ?? null,
    serve_notice: input.serveNotice ?? null,
    initiated_by: "hr",
  });
  const lookups = await loadEmployeeLookups();
  return mapOffboardingRow(res.data as HrRow, lookups);
}

export function patchOffboardingCaseFromRow(c: OffboardingCase, row: HrRow): OffboardingCase {
  const { checklist, exitInterview, documents, approvals, fnfMeta } = parseClearance(row.clearance_json);
  return {
    ...c,
    status: String(row.status ?? c.status),
    fnfStatus: String(row.fnf_status ?? c.fnfStatus),
    fnfPayrollRunId: row.fnf_payroll_run_id
      ? String(row.fnf_payroll_run_id)
      : c.fnfPayrollRunId,
    noticeStatus: row.notice_status != null ? String(row.notice_status) : c.noticeStatus,
    noticeStartDate: row.notice_start_date ? String(row.notice_start_date) : c.noticeStartDate,
    expectedExitDate: row.expected_exit_date ? String(row.expected_exit_date) : c.expectedExitDate,
    noticePeriodDays:
      row.notice_period_days != null && row.notice_period_days !== ""
        ? Number(row.notice_period_days)
        : c.noticePeriodDays,
    approvedLwd: row.approved_last_working_date
      ? String(row.approved_last_working_date)
      : c.approvedLwd,
    checklist,
    exitInterview,
    documents,
    approvals,
    fnfMeta,
  };
}

export async function deleteOffboardingCase(caseId: string): Promise<void> {
  await resourceService.delete("/hr/separation", caseId);
}

export async function offboardingAction(
  caseId: string,
  action: string,
  body?: Record<string, unknown>,
): Promise<HrRow> {
  const res = await resourceService.action<HrRow>("/hr/separation", caseId, action, body ?? {});
  return (res.data ?? {}) as HrRow;
}

export function isApiError(e: unknown): string {
  return e instanceof ApiClientError ? e.message : e instanceof Error ? e.message : "Request failed";
}
