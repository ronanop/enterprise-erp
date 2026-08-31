/**
 * HR Setup data layer — API resources + local configuration store.
 */

import { ApiClientError, resourceService } from "@/services/api-client";
import { buildReportingManagerOptions } from "@/lib/hr/reporting-managers";
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
    section: "identity",
    mandatory: true,
    expiry_required: false,
    formats: "JPG,PNG",
    max_size_mb: 0.3,
    status: "active",
  },
  {
    id: "doc-type-resume",
    code: "DOC-RESUME",
    name: "Resume",
    kind: "resume",
    section: "previous_employment",
    mandatory: true,
    expiry_required: false,
    formats: "PDF,DOC,DOCX",
    max_size_mb: 2,
    status: "active",
  },
  {
    id: "doc-type-10th",
    code: "DOC-10TH",
    name: "10th Marksheet",
    kind: "education",
    section: "education",
    mandatory: true,
    expiry_required: false,
    formats: "PDF,JPG,PNG",
    max_size_mb: 2,
    status: "active",
  },
  {
    id: "doc-type-12th",
    code: "DOC-12TH",
    name: "12th Marksheet",
    kind: "education",
    section: "education",
    mandatory: true,
    expiry_required: false,
    formats: "PDF,JPG,PNG",
    max_size_mb: 2,
    status: "active",
  },
  {
    id: "doc-type-grad",
    code: "DOC-GRAD",
    name: "Graduation",
    kind: "education",
    section: "education",
    mandatory: true,
    expiry_required: false,
    formats: "PDF,JPG,PNG",
    max_size_mb: 2,
    status: "active",
  },
  {
    id: "doc-type-pg-diploma",
    code: "DOC-PGDIP",
    name: "Post Graduate / Diploma",
    kind: "education",
    section: "education",
    mandatory: false,
    expiry_required: false,
    formats: "PDF,JPG,PNG",
    max_size_mb: 2,
    status: "active",
  },
  {
    id: "doc-type-any-cert",
    code: "DOC-CERT",
    name: "Any Certificates",
    kind: "other",
    section: "other",
    mandatory: false,
    expiry_required: false,
    formats: "PDF,JPG,PNG,DOC,DOCX",
    max_size_mb: 2,
    multiple: true,
    status: "active",
  },
  {
    id: "doc-type-cheque",
    code: "DOC-CHEQUE",
    name: "Cancelled Cheque / Passbook",
    kind: "cancelled_cheque",
    section: "identity",
    mandatory: true,
    expiry_required: false,
    formats: "PDF,JPG,PNG",
    max_size_mb: 2,
    status: "active",
  },
  {
    id: "doc-type-relieving",
    code: "DOC-REL",
    name: "Previous / Latest 3 Offer & Appointment Letters",
    kind: "appointment_letter",
    section: "previous_employment",
    mandatory: false,
    expiry_required: false,
    formats: "PDF,JPG,PNG",
    max_size_mb: 2,
    max_files: 3,
    multiple: true,
    status: "active",
  },
  {
    id: "doc-type-relieving-letter",
    code: "DOC-RLV",
    name: "Previous / Latest 3 Relieving Letter",
    kind: "relieving_letter",
    section: "previous_employment",
    mandatory: false,
    expiry_required: false,
    formats: "PDF,JPG,PNG",
    max_size_mb: 2,
    max_files: 3,
    multiple: true,
    status: "active",
  },
  {
    id: "doc-type-slips",
    code: "DOC-SLIPS",
    name: "Last 3 Month Salary Slip",
    kind: "salary_slips",
    section: "previous_employment",
    mandatory: false,
    expiry_required: false,
    formats: "PDF,JPG,PNG",
    max_size_mb: 2,
    max_files: 3,
    multiple: true,
    status: "active",
  },
];

const DEFAULT_EMPLOYMENT_TYPES: SetupRow[] = [
  {
    id: "et-permanent",
    code: "ET-001",
    name: "Permanent",
    value: "permanent",
    status: "active",
  },
  {
    id: "et-contract",
    code: "ET-002",
    name: "Contractual",
    value: "contract",
    status: "active",
  },
  {
    id: "et-intern",
    code: "ET-003",
    name: "Intern",
    value: "intern",
    status: "active",
  },
  {
    id: "et-trainee",
    code: "ET-004",
    name: "Trainee",
    value: "trainee",
    status: "active",
  },
];

const DEFAULT_LOCAL: Partial<Record<HrSetupTabId, SetupRow[]>> = {
  // Empty defaults — no seeded demo rows; API is SoR where available.
  "job-levels": [],
  grades: [],
  "employment-types": [],
  "employment-type": DEFAULT_EMPLOYMENT_TYPES,
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

export type PortalDocumentSection =
  | "identity"
  | "education"
  | "previous_employment"
  | "other";

export type PortalDocumentType = {
  id: string;
  code: string;
  name: string;
  kind: string;
  section: PortalDocumentSection;
  mandatory: boolean;
  accept: string;
  maxSizeMb: number | null;
  /** When true, candidate may upload several files for this type. */
  multiple?: boolean;
  /** Cap for multi-file types (e.g. last 3 salary slips). */
  maxFiles?: number;
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
  if (blob.includes("education") || blob.includes("degree") || blob.includes("marksheet") || blob.includes("grad")) {
    return "education";
  }
  if (blob.includes("experience")) return "experience";
  if (blob.includes("cheque") || blob.includes("check")) return "cancelled_cheque";
  if (blob.includes("bank") || blob.includes("passbook")) return "bank_details";
  if (blob.includes("appointment")) return "appointment_letter";
  if (blob.includes("relieving")) return "relieving_letter";
  if (blob.includes("salary") || blob.includes("payslip")) return "salary_slips";
  if (blob.includes("previous") && blob.includes("employer")) return "previous_employer";
  if (blob.includes("signature") || blob.includes("sign")) return "signature";
  return "other";
}

function resolveDocSection(code: string, kind: string, explicit?: unknown): PortalDocumentSection {
  const s = String(explicit ?? "").toLowerCase();
  if (s === "identity" || s === "education" || s === "previous_employment" || s === "other") {
    return s;
  }
  if (code.startsWith("DOC-10") || code.startsWith("DOC-12") || code.includes("GRAD") || kind === "education") {
    return "education";
  }
  if (
    code.includes("APPT") ||
    code.includes("REL") ||
    code.includes("SLIPS") ||
    kind === "appointment_letter" ||
    kind === "relieving_letter" ||
    kind === "salary_slips" ||
    kind === "previous_employer" ||
    kind === "experience"
  ) {
    return "previous_employment";
  }
  if (["photo", "pan", "aadhaar", "bank_details", "cancelled_cheque"].includes(kind)) {
    return "identity";
  }
  return "other";
}

/** Active document types for candidate onboarding uploads (signature is on Policies step). */
export async function listPortalDocumentTypes(): Promise<PortalDocumentType[]> {
  const rows = await listLocalSetup("document-types");
  const byCode = new Map(
    rows
      .filter((r) => String(r.status ?? "active").toLowerCase() === "active")
      .map((r) => [String(r.code ?? ""), r]),
  );

  // Always prefer the current default catalog for known onboarding codes
  for (const def of DEFAULT_DOCUMENT_TYPES) {
    const code = String(def.code ?? "");
    if (!code) continue;
    byCode.set(code, def);
  }

  // Drop legacy appointment / signature / duplicate education rows from the portal list
  const legacyDrop = new Set([
    "DOC-APPT",
    "DOC-SIGN",
    "DOC-PREV-EMP",
    "DOC-EXP",
  ]);

  const allowedKinds = new Set([
    "education",
    "resume",
    "cancelled_cheque",
    "appointment_letter",
    "relieving_letter",
    "salary_slips",
    "other",
  ]);

  return [...byCode.values()]
    .filter((r) => {
      const code = String(r.code ?? "");
      const name = String(r.name ?? "");
      const kind = normalizeDocKind(r.kind, code, name);
      if (kind === "signature" || kind === "photo") return false;
      if (legacyDrop.has(code)) return false;
      // Keep canonical graduation / PG slots; drop leftover duplicate education rows
      if (kind === "education" && !["DOC-10TH", "DOC-12TH", "DOC-GRAD", "DOC-PGDIP"].includes(code)) {
        return false;
      }
      if (/education\s*certificates?/i.test(name)) return false;
      // Collapse duplicate relieving / slip / cheque rows from old local setup into one portal type
      if (kind === "relieving_letter" && code !== "DOC-RLV") return false;
      if (kind === "appointment_letter" && code !== "DOC-REL") return false;
      if (kind === "salary_slips" && code !== "DOC-SLIPS") return false;
      if (kind === "cancelled_cheque" && code !== "DOC-CHEQUE") return false;
      if (/previous\s*relieving/i.test(name) && code !== "DOC-RLV") return false;
      if (/^cancelled\s*cheque$/i.test(name) && code !== "DOC-CHEQUE") return false;
      if (code === "DOC-CERT") return true;
      if (kind === "other") return false;
      return allowedKinds.has(kind);
    })
    .map((r) => {
      const code = String(r.code ?? "");
      const name = String(r.name ?? r.code ?? "Document");
      const kind =
        code === "DOC-CERT"
          ? "other"
          : code === "DOC-CHEQUE"
            ? "cancelled_cheque"
            : code === "DOC-REL"
              ? "appointment_letter"
              : code === "DOC-RLV"
                ? "relieving_letter"
                : code === "DOC-SLIPS"
                ? "salary_slips"
                : normalizeDocKind(r.kind, code, name);
      const section =
        code === "DOC-CERT"
          ? "other"
          : code === "DOC-CHEQUE"
            ? "identity"
            : resolveDocSection(code, kind, r.section);
      return {
        id: String(r.id),
        code,
        name:
          code === "DOC-CERT"
            ? "Any Certificates"
            : code === "DOC-CHEQUE"
              ? "Cancelled Cheque / Passbook"
              : code === "DOC-GRAD"
                ? "Graduation"
                : code === "DOC-PGDIP"
                  ? "Post Graduate / Diploma"
                  : code === "DOC-REL"
                    ? "Previous / Latest 3 Offer & Appointment Letters"
                    : code === "DOC-RLV"
                      ? "Previous / Latest 3 Relieving Letter"
                      : code === "DOC-SLIPS"
                      ? "Last 3 Month Salary Slip"
                      : name,
        kind,
        section,
        mandatory: ["DOC-CERT", "DOC-REL", "DOC-RLV", "DOC-SLIPS", "DOC-PGDIP"].includes(code)
          ? false
          : code === "DOC-CHEQUE"
            ? true
            : Boolean(r.mandatory),
        accept: formatsToAccept(r.formats),
        maxSizeMb:
          r.max_size_mb == null || r.max_size_mb === ""
            ? null
            : Number(r.max_size_mb),
        multiple: Boolean(r.multiple) || ["DOC-CERT", "DOC-REL", "DOC-RLV", "DOC-SLIPS"].includes(code),
        maxFiles:
          r.max_files == null || r.max_files === ""
            ? ["DOC-REL", "DOC-RLV", "DOC-SLIPS"].includes(code)
              ? 3
              : undefined
            : Number(r.max_files),
      };
    })
    .sort((a, b) => {
      const order: PortalDocumentSection[] = [
        "education",
        "identity",
        "previous_employment",
        "other",
      ];
      const sectionDiff = order.indexOf(a.section) - order.indexOf(b.section);
      if (sectionDiff !== 0) return sectionDiff;
      const codeOrder = [
        "DOC-10TH",
        "DOC-12TH",
        "DOC-GRAD",
        "DOC-PGDIP",
        "DOC-CHEQUE",
        "DOC-RESUME",
        "DOC-REL",
        "DOC-RLV",
        "DOC-SLIPS",
        "DOC-CERT",
      ];
      return (
        (codeOrder.indexOf(a.code) === -1 ? 99 : codeOrder.indexOf(a.code)) -
          (codeOrder.indexOf(b.code) === -1 ? 99 : codeOrder.indexOf(b.code)) ||
        a.name.localeCompare(b.name)
      );
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

  const existing = store[tabId] ?? [];
  if (tabId === "document-types") {
    const { rows, changed } = syncDocumentTypeCatalog(existing, defaults);
    if (changed) {
      store[tabId] = rows;
      writeLocal(store);
    }
    return store[tabId] ?? rows;
  }

  // Merge any newly added default rows (by code) without wiping user edits.
  const codes = new Set(existing.map((r) => String(r.code ?? "")));
  const missing = defaults.filter((d) => d.code && !codes.has(String(d.code)));
  if (missing.length) {
    store[tabId] = [...existing, ...missing];
    writeLocal(store);
  }
  return store[tabId] ?? [];
}

const DOCUMENT_TYPE_SYNC_KEYS = [
  "name",
  "kind",
  "section",
  "mandatory",
  "expiry_required",
  "formats",
  "max_size_mb",
  "max_files",
  "multiple",
] as const;

function syncDocumentTypeCatalog(
  existing: SetupRow[],
  defaults: SetupRow[],
): { rows: SetupRow[]; changed: boolean } {
  const defByCode = new Map(defaults.map((d) => [String(d.code ?? ""), d]));
  let changed = false;
  const rows = existing.map((row) => {
    const def = defByCode.get(String(row.code ?? ""));
    if (!def) return row;
    let rowChanged = false;
    const next: SetupRow = { ...row };
    for (const key of DOCUMENT_TYPE_SYNC_KEYS) {
      if (def[key] !== undefined && row[key] !== def[key]) {
        next[key] = def[key];
        rowChanged = true;
      }
    }
    if (!rowChanged) return row;
    changed = true;
    return { ...next, updated_at: new Date().toISOString() };
  });
  const codes = new Set(rows.map((r) => String(r.code ?? "")));
  for (const def of defaults) {
    if (def.code && !codes.has(String(def.code))) {
      rows.push(def);
      changed = true;
    }
  }
  return { rows, changed };
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
  const res = await resourceService.list(apiPath, { page_size: 200, page: 1 });
  return normalizeRows(res.data).map((r) => ({ ...r, __source: "api" }));
}

async function listAllNormalized(apiPath: string): Promise<SetupRow[]> {
  const all: SetupRow[] = [];
  for (let page = 1; page <= 20; page += 1) {
    try {
      const res = await resourceService.list(apiPath, { page_size: 200, page });
      const chunk = normalizeRows(res.data);
      all.push(...chunk);
      if (chunk.length < 200) break;
    } catch {
      break;
    }
  }
  return all;
}

/** Shared org lookups for setup forms (company / branch / department dropdowns). */
export async function loadSetupOrgLookups(): Promise<{
  companies: { value: string; label: string }[];
  branches: { value: string; label: string; companyId?: string }[];
  departments: { value: string; label: string }[];
  employees: { value: string; label: string }[];
  shifts: { value: string; label: string }[];
}> {
  const [companyRows, branchRows, deptRows, employeeRows, shiftRows] = await Promise.all([
    listAllNormalized("/companies"),
    listAllNormalized("/branches"),
    listAllNormalized("/departments"),
    listAllNormalized("/employees"),
    listAllNormalized("/hr/shifts"),
  ]);

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
    const rows = buildReportingManagerOptions(empRows).map((o) => {
      const e = empRows.find((r) => String(r.id) === o.id);
      return {
        ...(e ?? {}),
        id: o.id,
        name: o.label.split(" (")[0]?.trim() || o.label,
        employee_code: e?.employee_code ?? "",
        role: "Reporting manager",
        status: String(e?.status ?? "active"),
        __source: "derived" as const,
      };
    });
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
  let actor = "current.user";
  try {
    const raw = localStorage.getItem("erp_user_profile");
    if (raw) {
      const p = JSON.parse(raw) as { full_name?: string; email?: string; id?: string };
      actor = p.full_name || p.email || p.id || actor;
    }
  } catch {
    /* ignore */
  }
  const row: SetupRow = {
    ...body,
    id: crypto.randomUUID(),
    code: String(body.code ?? nextCode(prefix, codes)),
    status: String(body.status ?? "active"),
    created_at: now,
    updated_at: now,
    created_by: actor,
    updated_by: actor,
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
  let actor = "current.user";
  try {
    const raw = localStorage.getItem("erp_user_profile");
    if (raw) {
      const p = JSON.parse(raw) as { full_name?: string; email?: string; id?: string };
      actor = p.full_name || p.email || p.id || actor;
    }
  } catch {
    /* ignore */
  }
  const next = {
    ...rows[idx],
    ...body,
    id,
    updated_at: new Date().toISOString(),
    updated_by: actor,
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

export type SetupMasterOption = { value: string; label: string };

/** Legal entities from organization.org_company (same source as Assign HR). */
export async function listEntityOptions(): Promise<SetupMasterOption[]> {
  const rows = await listAllNormalized("/hr/legal-entities");
  return rows
    .filter((r) => String(r.status ?? "active").toLowerCase() === "active")
    .map((r) => ({
      value: String(r.id),
      label: String(r.company_name ?? r.name ?? r.legal_name ?? r.company_code ?? "Entity"),
    }));
}

/** Employment types (Permanent, Contract, etc.) from HR Setup → Employment Type. */
export async function listEmploymentTypeOptions(): Promise<SetupMasterOption[]> {
  const rows = await listLocalSetup("employment-type");
  const active = rows.filter((r) => String(r.status ?? "active").toLowerCase() === "active");
  if (!active.length) {
    return [
      { value: "permanent", label: "Permanent" },
      { value: "intern", label: "Intern" },
      { value: "trainee", label: "Trainee" },
      { value: "contract", label: "Contractual" },
    ];
  }
  return active.map((r) => ({
    value: String(r.value ?? r.code ?? r.id).toLowerCase(),
    label: String(r.name ?? r.code ?? "Type"),
  }));
}
