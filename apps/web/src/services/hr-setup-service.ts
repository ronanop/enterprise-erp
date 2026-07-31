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

const LOCAL_KEY = "erp_hr_setup_local_v2";

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

/** KYC / HR document catalog — drives onboarding Upload Documents step. */
export const DEFAULT_DOCUMENT_TYPES: SetupRow[] = [
  {
    id: "doc-type-photo",
    code: "DOC-PHOTO",
    name: "Photo",
    kind: "photo",
    mandatory: true,
    expiry_required: false,
    formats: "JPG,PNG",
    max_size_mb: 5,
    status: "active",
  },
  {
    id: "doc-type-pan",
    code: "DOC-PAN",
    name: "PAN",
    kind: "pan",
    mandatory: true,
    expiry_required: false,
    formats: "PDF,JPG,PNG",
    max_size_mb: 5,
    status: "active",
  },
  {
    id: "doc-type-aadhaar",
    code: "DOC-AADHAAR",
    name: "Aadhaar",
    kind: "aadhaar",
    mandatory: true,
    expiry_required: false,
    formats: "PDF,JPG,PNG",
    max_size_mb: 5,
    status: "active",
  },
  {
    id: "doc-type-bank",
    code: "DOC-BANK",
    name: "Bank Details / Passbook",
    kind: "bank_details",
    mandatory: true,
    expiry_required: false,
    formats: "PDF,JPG,PNG",
    max_size_mb: 5,
    status: "active",
  },
  {
    id: "doc-type-cheque",
    code: "DOC-CHEQUE",
    name: "Cancelled Cheque",
    kind: "cancelled_cheque",
    mandatory: true,
    expiry_required: false,
    formats: "PDF,JPG,PNG",
    max_size_mb: 5,
    status: "active",
  },
  {
    id: "doc-type-graduation",
    code: "DOC-GRAD",
    name: "Graduation Certificate",
    kind: "education",
    mandatory: true,
    expiry_required: false,
    formats: "PDF,JPG,PNG",
    max_size_mb: 10,
    status: "active",
  },
  {
    id: "doc-type-appointment",
    code: "DOC-APPT",
    name: "Latest Appointment Letter",
    kind: "appointment_letter",
    mandatory: true,
    expiry_required: false,
    formats: "PDF",
    max_size_mb: 5,
    status: "active",
  },
  {
    id: "doc-type-relieving",
    code: "DOC-REL",
    name: "Latest Relieving Letter",
    kind: "relieving_letter",
    mandatory: true,
    expiry_required: false,
    formats: "PDF",
    max_size_mb: 5,
    status: "active",
  },
  {
    id: "doc-type-salary-slips",
    code: "DOC-SLIPS",
    name: "Last 3 Salary Slips",
    kind: "salary_slips",
    mandatory: true,
    expiry_required: false,
    formats: "PDF,JPG,PNG",
    max_size_mb: 15,
    status: "active",
  },
  {
    id: "doc-type-prev-employer",
    code: "DOC-PREV-EMP",
    name: "Previous Employer Certificate",
    kind: "previous_employer",
    mandatory: false,
    expiry_required: false,
    formats: "PDF,JPG,PNG",
    max_size_mb: 10,
    status: "active",
  },
  {
    id: "doc-type-experience",
    code: "DOC-EXP",
    name: "Work Experience Certificate",
    kind: "experience",
    mandatory: false,
    expiry_required: false,
    formats: "PDF,JPG,PNG",
    max_size_mb: 10,
    status: "active",
  },
  {
    id: "doc-type-signature",
    code: "DOC-SIGN",
    name: "Signature",
    kind: "signature",
    mandatory: true,
    expiry_required: false,
    formats: "JPG,PNG,PDF",
    max_size_mb: 2,
    status: "active",
  },
  {
    id: "doc-type-resume",
    code: "DOC-RESUME",
    name: "Resume",
    kind: "resume",
    mandatory: false,
    expiry_required: false,
    formats: "PDF,DOC,DOCX",
    max_size_mb: 10,
    status: "active",
  },
  {
    id: "doc-type-passport",
    code: "DOC-PASSPORT",
    name: "Passport",
    kind: "passport",
    mandatory: false,
    expiry_required: true,
    formats: "PDF,JPG,PNG",
    max_size_mb: 5,
    status: "active",
  },
];

const DEFAULT_LOCAL: Partial<Record<HrSetupTabId, SetupRow[]>> = {
  // Empty defaults — no seeded demo rows; API is SoR where available.
  "job-levels": [],
  grades: [],
  "employment-types": [],
  "document-types": DEFAULT_DOCUMENT_TYPES,
  "leave-policies": [],
  "shift-rotation": [],
  "attendance-rules": [],
  "bank-master": [],
  "notification-settings": [],
};

const DOCUMENT_KINDS = new Set([
  "photo",
  "resume",
  "pan",
  "aadhaar",
  "passport",
  "education",
  "experience",
  "cancelled_cheque",
  "bank_details",
  "appointment_letter",
  "relieving_letter",
  "salary_slips",
  "previous_employer",
  "signature",
  "other",
]);

export type PortalDocumentType = {
  id: string;
  code: string;
  name: string;
  kind: string;
  mandatory: boolean;
  accept: string;
  maxSizeMb: number | null;
};

/** Map setup "PDF,JPG" → HTML accept string. */
export function formatsToAccept(formats: unknown): string {
  const raw = String(formats ?? "").trim();
  if (!raw) return ".pdf,image/*";
  const parts = raw
    .split(/[,;/|\s]+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .flatMap((f) => {
      const u = f.replace(/^\./, "").toUpperCase();
      if (u === "PDF") return [".pdf", "application/pdf"];
      if (u === "JPG" || u === "JPEG") return [".jpg", ".jpeg", "image/jpeg"];
      if (u === "PNG") return [".png", "image/png"];
      if (u === "DOC") return [".doc"];
      if (u === "DOCX") return [".docx"];
      if (u === "IMAGE" || u === "IMAGES") return ["image/*"];
      return [`.${u.toLowerCase()}`];
    });
  return [...new Set(parts)].join(",") || ".pdf,image/*";
}

function normalizeDocKind(value: unknown, code: string, name: string): string {
  const direct = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
  if (DOCUMENT_KINDS.has(direct)) return direct;
  const blob = `${code} ${name}`.toLowerCase();
  if (blob.includes("aadhaar") || blob.includes("aadhar")) return "aadhaar";
  if (blob.includes("pan")) return "pan";
  if (blob.includes("passport")) return "passport";
  if (blob.includes("resume") || blob.includes("cv")) return "resume";
  if (blob.includes("photo") || blob.includes("photograph")) return "photo";
  if (blob.includes("education") || blob.includes("degree")) return "education";
  if (blob.includes("experience") || blob.includes("relieving")) return "experience";
  if (blob.includes("cheque") || blob.includes("check")) return "cancelled_cheque";
  if (blob.includes("bank") || blob.includes("passbook")) return "bank_details";
  if (blob.includes("appointment")) return "appointment_letter";
  if (blob.includes("relieving")) return "relieving_letter";
  if (blob.includes("salary") || blob.includes("payslip")) return "salary_slips";
  if (blob.includes("previous") && blob.includes("employer")) return "previous_employer";
  if (blob.includes("signature") || blob.includes("sign")) return "signature";
  return "other";
}

/** Active document types for candidate onboarding uploads. */
export async function listPortalDocumentTypes(): Promise<PortalDocumentType[]> {
  const rows = await listLocalSetup("document-types");
  return rows
    .filter((r) => String(r.status ?? "active").toLowerCase() === "active")
    .map((r) => {
      const code = String(r.code ?? "");
      const name = String(r.name ?? r.code ?? "Document");
      return {
        id: String(r.id),
        code,
        name,
        kind: normalizeDocKind(r.kind, code, name),
        mandatory: Boolean(r.mandatory),
        accept: formatsToAccept(r.formats),
        maxSizeMb:
          r.max_size_mb == null || r.max_size_mb === ""
            ? null
            : Number(r.max_size_mb),
      };
    });
}

function stampDefaults(rows: SetupRow[]): SetupRow[] {
  return rows.map((r) => ({
    ...r,
    __source: "local" as const,
    created_at: r.created_at ?? new Date().toISOString(),
    updated_at: r.updated_at ?? new Date().toISOString(),
    created_by: r.created_by ?? "system",
    updated_by: r.updated_by ?? "system",
  }));
}

function ensureLocal(tabId: HrSetupTabId): SetupRow[] {
  const store = readLocal();
  const defaults = stampDefaults(DEFAULT_LOCAL[tabId] ?? []);
  if (!store[tabId]) {
    store[tabId] = defaults;
    writeLocal(store);
    return store[tabId] ?? [];
  }

  // Merge any newly added default rows (by code) without wiping user edits.
  const existing = store[tabId] ?? [];
  const codes = new Set(existing.map((r) => String(r.code ?? "")));
  const missing = defaults.filter((d) => d.code && !codes.has(String(d.code)));
  if (missing.length) {
    store[tabId] = [...existing, ...missing];
    writeLocal(store);
  }
  return store[tabId] ?? [];
}

/** Coerce checkbox/number form strings into typed local values. */
export function coerceLocalForm(
  fields: { key: string; type?: string }[],
  form: Record<string, string>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...form };
  for (const f of fields) {
    const raw = form[f.key];
    if (f.type === "checkbox") {
      out[f.key] = raw === "true" || raw === "1" || raw === "yes";
    } else if (f.type === "number") {
      out[f.key] = raw === "" || raw == null ? null : Number(raw);
    }
  }
  return out;
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
