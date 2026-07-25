/**
 * HR Setup data layer — API resources + local configuration store.
 */

import { ApiClientError, resourceService } from "@/services/api-client";
import { nextCode, type HrSetupTabId } from "@/config/hr-setup";

export type SetupRow = Record<string, unknown> & {
  id: string;
  status?: string;
  __source?: "api" | "local" | "derived";
};

const LOCAL_KEY = "erp_hr_setup_local_v1";

type LocalStore = Record<string, SetupRow[]>;

function readLocal(): LocalStore {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(LOCAL_KEY);
    return raw ? (JSON.parse(raw) as LocalStore) : {};
  } catch {
    return {};
  }
}

function writeLocal(store: LocalStore) {
  window.localStorage.setItem(LOCAL_KEY, JSON.stringify(store));
}

function normalizeRows(data: unknown): SetupRow[] {
  if (Array.isArray(data)) {
    return data
      .filter((r): r is Record<string, unknown> => !!r && typeof r === "object")
      .map((r) => ({ ...r, id: String(r.id) }));
  }
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    for (const key of ["items", "results", "records", "rows", "data"]) {
      if (Array.isArray(obj[key])) return normalizeRows(obj[key]);
    }
  }
  return [];
}

const DEFAULT_LOCAL: Partial<Record<HrSetupTabId, SetupRow[]>> = {
  "job-levels": [
    { id: "lvl-1", code: "LVL-001", name: "Junior", status: "active", sort_order: 1 },
    { id: "lvl-2", code: "LVL-002", name: "Mid", status: "active", sort_order: 2 },
    { id: "lvl-3", code: "LVL-003", name: "Senior", status: "active", sort_order: 3 },
    { id: "lvl-4", code: "LVL-004", name: "Lead", status: "active", sort_order: 4 },
    { id: "lvl-5", code: "LVL-005", name: "Manager", status: "active", sort_order: 5 },
    { id: "lvl-6", code: "LVL-006", name: "Director", status: "active", sort_order: 6 },
    { id: "lvl-7", code: "LVL-007", name: "VP", status: "active", sort_order: 7 },
    { id: "lvl-8", code: "LVL-008", name: "CXO", status: "active", sort_order: 8 },
  ],
  grades: [
    {
      id: "grd-1",
      code: "GRD-001",
      name: "L1",
      min_salary: 300000,
      max_salary: 600000,
      status: "active",
      description: "Entry grade",
    },
    {
      id: "grd-2",
      code: "GRD-002",
      name: "L2",
      min_salary: 600000,
      max_salary: 1200000,
      status: "active",
      description: "Mid grade",
    },
    {
      id: "grd-3",
      code: "GRD-003",
      name: "L3",
      min_salary: 1200000,
      max_salary: 2500000,
      status: "active",
      description: "Senior grade",
    },
  ],
  "employment-types": [
    { id: "et-1", code: "EMP-001", name: "Permanent", status: "active", description: "Full-time permanent" },
    { id: "et-2", code: "EMP-002", name: "Contract", status: "active", description: "Fixed-term contract" },
    { id: "et-3", code: "EMP-003", name: "Intern", status: "active", description: "Internship" },
    { id: "et-4", code: "EMP-004", name: "Consultant", status: "active", description: "External consultant" },
    { id: "et-5", code: "EMP-005", name: "Temporary", status: "active", description: "Temporary staff" },
    { id: "et-6", code: "EMP-006", name: "Part Time", status: "active", description: "Part-time employment" },
  ],
  "document-types": [
    { id: "dt-1", code: "DOC-001", name: "Aadhaar", mandatory: true, expiry_required: false, formats: "PDF,JPG", max_size_mb: 5, status: "active" },
    { id: "dt-2", code: "DOC-002", name: "PAN", mandatory: true, expiry_required: false, formats: "PDF,JPG", max_size_mb: 5, status: "active" },
    { id: "dt-3", code: "DOC-003", name: "Passport", mandatory: false, expiry_required: true, formats: "PDF,JPG", max_size_mb: 5, status: "active" },
    { id: "dt-4", code: "DOC-004", name: "Offer Letter", mandatory: true, expiry_required: false, formats: "PDF", max_size_mb: 10, status: "active" },
    { id: "dt-5", code: "DOC-005", name: "Resume", mandatory: false, expiry_required: false, formats: "PDF,DOCX", max_size_mb: 5, status: "active" },
  ],
  "leave-policies": [
    {
      id: "lp-1",
      code: "LP-001",
      name: "Standard Annual Leave",
      leave_type: "Annual Leave",
      leave_days: 18,
      carry_forward: true,
      max_carry: 5,
      negative_balance: false,
      half_day: true,
      requires_approval: true,
      approval_flow: "Manager → HR",
      status: "active",
      effective_from: "2026-01-01",
    },
  ],
  "shift-rotation": [],
  "attendance-rules": [
    {
      id: "ar-1",
      code: "AR-001",
      name: "Default grace rule",
      grace_minutes: 15,
      late_mark_after: 30,
      half_day_hours: 4,
      full_day_hours: 8,
      overtime_allowed: true,
      status: "active",
    },
  ],
  "bank-master": [
    { id: "bnk-1", code: "BNK-001", name: "HDFC Bank", bank_code: "HDFC", ifsc_prefix: "HDFC0", status: "active" },
    { id: "bnk-2", code: "BNK-002", name: "ICICI Bank", bank_code: "ICIC", ifsc_prefix: "ICIC0", status: "active" },
    { id: "bnk-3", code: "BNK-003", name: "State Bank of India", bank_code: "SBIN", ifsc_prefix: "SBIN0", status: "active" },
  ],
  "notification-settings": [
    { id: "ntf-1", code: "NTF-001", name: "Email channel", channel: "email", enabled: true, status: "active" },
    { id: "ntf-2", code: "NTF-002", name: "SMS channel", channel: "sms", enabled: false, status: "inactive" },
    { id: "ntf-3", code: "NTF-003", name: "WhatsApp channel", channel: "whatsapp", enabled: false, status: "inactive" },
    { id: "ntf-4", code: "NTF-004", name: "Push notifications", channel: "push", enabled: true, status: "active" },
  ],
};

function ensureLocal(tabId: HrSetupTabId): SetupRow[] {
  const store = readLocal();
  if (!store[tabId]) {
    store[tabId] = (DEFAULT_LOCAL[tabId] ?? []).map((r) => ({
      ...r,
      __source: "local",
      created_at: r.created_at ?? new Date().toISOString(),
      updated_at: r.updated_at ?? new Date().toISOString(),
      created_by: r.created_by ?? "system",
      updated_by: r.updated_by ?? "system",
    }));
    writeLocal(store);
  }
  return store[tabId] ?? [];
}

export async function listSetupApi(apiPath: string): Promise<SetupRow[]> {
  const res = await resourceService.list(apiPath);
  return normalizeRows(res.data).map((r) => ({ ...r, __source: "api" }));
}

/** Shared org lookups for setup forms (company / branch / department dropdowns). */
export async function loadSetupOrgLookups(): Promise<{
  companies: { value: string; label: string }[];
  branches: { value: string; label: string; companyId?: string }[];
  departments: { value: string; label: string }[];
  employees: { value: string; label: string }[];
  shifts: { value: string; label: string }[];
}> {
  const [companies, branches, departments, employees, shifts] = await Promise.all([
    resourceService.list("/companies").catch(() => ({ data: [] })),
    resourceService.list("/branches").catch(() => ({ data: [] })),
    resourceService.list("/departments").catch(() => ({ data: [] })),
    resourceService.list("/employees").catch(() => ({ data: [] })),
    resourceService.list("/hr/shifts").catch(() => ({ data: [] })),
  ]);

  const companyRows = normalizeRows(companies.data);
  const branchRows = normalizeRows(branches.data);
  const deptRows = normalizeRows(departments.data);
  const employeeRows = normalizeRows(employees.data);
  const shiftRows = normalizeRows(shifts.data);

  return {
    companies: companyRows.map((r) => ({
      value: String(r.id),
      label: String(r.company_name ?? r.name ?? r.company_code ?? r.id),
    })),
    branches: branchRows.map((r) => ({
      value: String(r.id),
      label: String(r.branch_name ?? r.name ?? r.branch_code ?? r.id),
      companyId: r.company_id != null ? String(r.company_id) : undefined,
    })),
    departments: deptRows.map((r) => ({
      value: String(r.id),
      label: String(r.department_name ?? r.name ?? r.department_code ?? r.id),
    })),
    employees: employeeRows.map((r) => {
      const name = [r.first_name, r.last_name].filter(Boolean).join(" ").trim();
      const code = String(r.employee_code ?? "");
      return {
        value: String(r.id),
        label: name ? `${name}${code ? ` · ${code}` : ""}` : code || String(r.id),
      };
    }),
    shifts: shiftRows.map((r) => ({
      value: String(r.id),
      label: String(r.shift_name ?? r.shift_code ?? r.name ?? r.id),
    })),
  };
}

export async function listLocalSetup(tabId: HrSetupTabId): Promise<SetupRow[]> {
  return ensureLocal(tabId).filter((r) => r.status !== "deleted");
}

export async function listReportingManagers(): Promise<SetupRow[]> {
  try {
    const [employees, roles] = await Promise.all([
      resourceService.list("/employees"),
      resourceService.list("/roles").catch(() => ({ data: [] })),
    ]);
    const empRows = normalizeRows(employees.data);
    // Prefer employees with manager-like designations / titles when roles list is sparse
    const managers = empRows.filter((e) => {
      const title = String(e.designation ?? e.job_title ?? e.display_name ?? "").toLowerCase();
      const code = String(e.employee_code ?? "");
      return (
        title.includes("manager") ||
        title.includes("lead") ||
        title.includes("head") ||
        title.includes("director") ||
        code.endsWith("1") ||
        code.endsWith("2")
      );
    });
    const rows = (managers.length ? managers : empRows.slice(0, 8)).map((e) => ({
      ...e,
      id: String(e.id),
      name: `${[e.first_name, e.last_name].filter(Boolean).join(" ")}`.trim() || String(e.employee_code ?? e.id),
      role: "Manager",
      status: String(e.status ?? "active"),
      __source: "derived" as const,
    }));
    void roles;
    return rows;
  } catch (err) {
    if (err instanceof ApiClientError) throw err;
    return [];
  }
}

export async function createLocalSetup(
  tabId: HrSetupTabId,
  prefix: string,
  body: Record<string, unknown>,
): Promise<SetupRow> {
  const rows = ensureLocal(tabId);
  const codes = rows.map((r) => String(r.code ?? ""));
  const now = new Date().toISOString();
  const row: SetupRow = {
    ...body,
    id: crypto.randomUUID(),
    code: String(body.code ?? nextCode(prefix, codes)),
    status: String(body.status ?? "active"),
    created_at: now,
    updated_at: now,
    created_by: "current.user",
    updated_by: "current.user",
    __source: "local",
  };
  rows.unshift(row);
  const store = readLocal();
  store[tabId] = rows;
  writeLocal(store);
  return row;
}

export async function updateLocalSetup(
  tabId: HrSetupTabId,
  id: string,
  body: Record<string, unknown>,
): Promise<SetupRow> {
  const rows = ensureLocal(tabId);
  const idx = rows.findIndex((r) => r.id === id);
  if (idx < 0) throw new Error("Record not found");
  const next = {
    ...rows[idx],
    ...body,
    id,
    updated_at: new Date().toISOString(),
    updated_by: "current.user",
  };
  rows[idx] = next;
  const store = readLocal();
  store[tabId] = rows;
  writeLocal(store);
  return next;
}

export async function softDeleteLocal(tabId: HrSetupTabId, ids: string[]) {
  const rows = ensureLocal(tabId);
  for (const row of rows) {
    if (ids.includes(row.id)) {
      row.status = "deleted";
      row.updated_at = new Date().toISOString();
    }
  }
  const store = readLocal();
  store[tabId] = rows;
  writeLocal(store);
}

export async function archiveLocal(tabId: HrSetupTabId, ids: string[], archived = true) {
  const rows = ensureLocal(tabId);
  for (const row of rows) {
    if (ids.includes(row.id)) {
      row.status = archived ? "archived" : "active";
      row.updated_at = new Date().toISOString();
    }
  }
  const store = readLocal();
  store[tabId] = rows;
  writeLocal(store);
}

export async function duplicateLocal(tabId: HrSetupTabId, id: string, prefix: string) {
  const rows = ensureLocal(tabId);
  const src = rows.find((r) => r.id === id);
  if (!src) throw new Error("Record not found");
  return createLocalSetup(tabId, prefix, {
    ...src,
    name: `${String(src.name ?? "Copy")} (Copy)`,
    code: undefined,
  });
}

export function exportRowsCsv(filename: string, rows: SetupRow[], columns: string[]) {
  const header = columns.join(",");
  const lines = rows.map((row) =>
    columns
      .map((c) => {
        const v = row[c];
        const s = v == null ? "" : String(v);
        return `"${s.replaceAll('"', '""')}"`;
      })
      .join(","),
  );
  const blob = new Blob([[header, ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function cell(row: SetupRow, ...keys: string[]): string {
  for (const k of keys) {
    const v = row[k];
    if (v != null && String(v).trim() !== "") return String(v);
  }
  return "—";
}
