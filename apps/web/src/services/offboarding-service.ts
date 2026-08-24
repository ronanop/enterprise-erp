import { ApiClientError, resourceService } from "@/services/api-client";
import { listHrEmployeeOptions } from "@/services/hr-service";
import type { HrRow } from "@/services/hr-service";
import type {
  ClearanceChecklistItem,
  ExitDocument,
  ExitInterviewData,
  OffboardingCase,
  SeparationType,
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
  const fnfMeta = (c.fnf as Record<string, unknown>) ?? null;
  return { checklist, exitInterview, documents, fnfMeta };
}

function parseEmployeeLabel(label: string): { name: string; code: string } {
  const m = label.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
  if (m) return { name: m[1].trim(), code: m[2].trim() };
  return { name: label.trim(), code: "" };
}

export function mapOffboardingRow(
  row: HrRow,
  employeeNames: Map<string, string>,
  employeeCodes: Map<string, string>,
): OffboardingCase {
  const { checklist, exitInterview, documents, fnfMeta } = parseClearance(row.clearance_json);
  const employeeId = String(row.employee_id ?? "");
  const fallbackCode = employeeId ? employeeId.slice(0, 8) : "—";
  return {
    id: String(row.id),
    documentNumber: String(row.document_number ?? row.id),
    employeeId,
    employeeName: employeeNames.get(employeeId) ?? "Unknown employee",
    employeeCode: employeeCodes.get(employeeId) || fallbackCode,
    separationType: String(row.separation_type ?? "resignation"),
    requestedLwd: String(row.requested_last_working_date ?? ""),
    approvedLwd: row.approved_last_working_date
      ? String(row.approved_last_working_date)
      : null,
    status: String(row.status ?? "draft"),
    fnfStatus: String(row.fnf_status ?? "pending"),
    fnfPayrollRunId: row.fnf_payroll_run_id ? String(row.fnf_payroll_run_id) : null,
    reason: row.reason != null ? String(row.reason) : null,
    checklist,
    exitInterview,
    documents,
    fnfMeta,
  };
}

export async function loadOffboardingCases(): Promise<OffboardingCase[]> {
  const [sepRes, employees, profilesRes] = await Promise.all([
    resourceService.list<HrRow>("/hr/separation", { page_size: 200 }).catch(() => ({ data: [] })),
    listHrEmployeeOptions(),
    resourceService.list<HrRow>("/hr/employee-profiles", { page_size: 500 }).catch(() => ({ data: [] })),
  ]);
  const nameMap = new Map<string, string>();
  const codeMap = new Map<string, string>();
  for (const e of employees) {
    const { name, code } = parseEmployeeLabel(e.label);
    nameMap.set(e.id, name || e.label);
    if (code) codeMap.set(e.id, code);
  }
  const profileRows = Array.isArray(profilesRes.data) ? profilesRes.data : [];
  for (const p of profileRows) {
    const id = String(p.employee_id ?? p.id ?? "");
    if (!id) continue;
    const first = String(p.first_name ?? "").trim();
    const last = String(p.last_name ?? "").trim();
    const full = [first, last].filter(Boolean).join(" ");
    if (full) nameMap.set(id, full);
    const code = String(p.employee_code ?? "").trim();
    if (code) codeMap.set(id, code);
  }
  const rows = Array.isArray(sepRes.data) ? sepRes.data : [];
  return rows.map((r) => mapOffboardingRow(r as HrRow, nameMap, codeMap));
}

export async function createOffboardingCase(input: {
  branchId: string;
  employeeId: string;
  separationType: SeparationType;
  requestedLastWorkingDate: string;
  reason?: string;
}): Promise<OffboardingCase> {
  const res = await resourceService.create<HrRow>("/hr/separation", {
    branch_id: input.branchId,
    employee_id: input.employeeId,
    separation_type: input.separationType,
    requested_last_working_date: input.requestedLastWorkingDate,
    reason: input.reason ?? null,
  });
  const employees = await listHrEmployeeOptions();
  const nameMap = new Map<string, string>();
  const codeMap = new Map<string, string>();
  for (const e of employees) {
    const { name, code } = parseEmployeeLabel(e.label);
    nameMap.set(e.id, name || e.label);
    if (code) codeMap.set(e.id, code);
  }
  return mapOffboardingRow(res.data as HrRow, nameMap, codeMap);
}

export function patchOffboardingCaseFromRow(c: OffboardingCase, row: HrRow): OffboardingCase {
  const { checklist, exitInterview, documents, fnfMeta } = parseClearance(row.clearance_json);
  return {
    ...c,
    status: String(row.status ?? c.status),
    fnfStatus: String(row.fnf_status ?? c.fnfStatus),
    fnfPayrollRunId: row.fnf_payroll_run_id
      ? String(row.fnf_payroll_run_id)
      : c.fnfPayrollRunId,
    checklist,
    exitInterview,
    documents,
    fnfMeta,
  };
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
