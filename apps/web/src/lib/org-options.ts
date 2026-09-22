import { ApiClientError, resourceService } from "@/services/api-client";

export type OrgOption = { id: string; label: string };

/** Employee directory entry for Asset Inventory / Detail enrichment (read-only). */
export type EmployeeDirectoryEntry = {
  id: string;
  /** Display label (name + optional code). */
  label: string;
  /** Given + family name without code suffix. */
  displayName: string;
  employeeCode: string | null;
  mobile: string | null;
};

const DIRECTORY_PAGE_SIZE = 200;
const DIRECTORY_MAX_PAGES = 50;

const EMPLOYEE_READ_PERM = "master.employee:read";
const DEPARTMENT_READ_PERM = "organization.department:read";

function asArray(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) return data as Record<string, unknown>[];
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    for (const key of ["items", "results", "data", "rows"]) {
      if (Array.isArray(obj[key])) return obj[key] as Record<string, unknown>[];
    }
  }
  return [];
}

function trimOrNull(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim();
  return t || null;
}

/** Collapse separators so CT-5337 / CT 5337 match CT5337. */
export function normalizeEmployeeCodeKey(value: string): string {
  return value.trim().toLowerCase().replace(/[\s\-_./]/g, "");
}

export function isMissingPermissionError(
  err: unknown,
  permissionCode?: string,
): boolean {
  if (!(err instanceof ApiClientError) || err.status !== 403) return false;
  if (!permissionCode) return true;
  const msg = (err.message || "").toLowerCase();
  return msg.includes("missing permission") && msg.includes(permissionCode.toLowerCase());
}

export function employeeDirectoryPermissionMessage(err?: unknown): string {
  if (err instanceof ApiClientError && err.message?.trim()) {
    if (isMissingPermissionError(err, EMPLOYEE_READ_PERM)) {
      return (
        `Missing permission to load employees (${EMPLOYEE_READ_PERM}). ` +
        "Ask an admin to grant this on your Asset role."
      );
    }
    return err.message;
  }
  return (
    `Missing permission to load employees (${EMPLOYEE_READ_PERM}). ` +
    "Ask an admin to grant this on your Asset role."
  );
}

async function listAllResourcePages(apiPath: string): Promise<Record<string, unknown>[]> {
  const out: Record<string, unknown>[] = [];
  const base = apiPath.includes("?") ? `${apiPath}&` : `${apiPath}?`;
  for (let page = 1; page <= DIRECTORY_MAX_PAGES; page += 1) {
    const res = await resourceService.list(
      `${base}page=${page}&page_size=${DIRECTORY_PAGE_SIZE}`,
    );
    const batch = asArray(res.data);
    out.push(...batch);
    if (batch.length < DIRECTORY_PAGE_SIZE) break;
  }
  return out;
}

function mapEmployeeRows(rows: Record<string, unknown>[]): EmployeeDirectoryEntry[] {
  return rows.map((r) => {
    const displayName = [r.first_name, r.last_name].filter(Boolean).join(" ").trim();
    const employeeCode = trimOrNull(r.employee_code);
    const codeSuffix = employeeCode ? ` (${employeeCode})` : "";
    const dept =
      typeof r.designation === "string" && r.designation.trim()
        ? ` · ${r.designation}`
        : "";
    const id = String(r.id);
    return {
      id,
      displayName: displayName || id,
      label: `${displayName || id}${codeSuffix}${dept}`,
      employeeCode,
      mobile: trimOrNull(r.mobile),
    };
  });
}

export async function listBranchOptions(): Promise<OrgOption[]> {
  try {
    const rows = await listAllResourcePages("/branches");
    return rows.map((r) => ({
      id: String(r.id),
      label: String(r.branch_name ?? r.name ?? r.branch_code ?? r.id),
    }));
  } catch {
    return [];
  }
}

export type ListEmployeeDirectoryOptions = {
  /** When true, 403 / API errors propagate instead of returning []. */
  throwOnError?: boolean;
};

/** Full employee directory from GET /employees (id, code, name, mobile). */
export async function listEmployeeDirectory(
  options: ListEmployeeDirectoryOptions = {},
): Promise<EmployeeDirectoryEntry[]> {
  try {
    const rows = await listAllResourcePages("/employees");
    return mapEmployeeRows(rows);
  } catch (err) {
    if (options.throwOnError) throw err;
    return [];
  }
}

export function employeeLabelsFromDirectory(
  entries: EmployeeDirectoryEntry[],
): Record<string, string> {
  return Object.fromEntries(entries.map((e) => [e.id, e.label]));
}

export function employeeDirectoryById(
  entries: EmployeeDirectoryEntry[],
): Record<string, EmployeeDirectoryEntry> {
  return Object.fromEntries(entries.map((e) => [e.id, e]));
}

export async function listEmployeeOptions(): Promise<OrgOption[]> {
  const directory = await listEmployeeDirectory();
  return directory.map((e) => ({ id: e.id, label: e.label }));
}

export async function listDepartmentOptions(
  options: { throwOnError?: boolean } = {},
): Promise<OrgOption[]> {
  try {
    const rows = await listAllResourcePages("/departments");
    return rows.map((r) => ({
      id: String(r.id),
      label: String(r.department_name ?? r.name ?? r.department_code ?? r.id),
    }));
  } catch (err) {
    if (options.throwOnError) {
      if (isMissingPermissionError(err, DEPARTMENT_READ_PERM)) {
        throw new ApiClientError(
          `Missing permission to load departments (${DEPARTMENT_READ_PERM}). Ask an admin.`,
          403,
        );
      }
      throw err;
    }
    return [];
  }
}

/** Organization physical locations (Branch ≠ Location). */
export async function listLocationOptions(branchId?: string): Promise<OrgOption[]> {
  try {
    const path = branchId
      ? `/locations?branch_id=${encodeURIComponent(branchId)}`
      : "/locations";
    const rows = await listAllResourcePages(path);
    return rows.map((r) => ({
      id: String(r.id),
      label: String(r.location_name ?? r.name ?? r.location_code ?? r.id),
    }));
  } catch {
    return [];
  }
}

/** Labels shown when Master Data employees are not loaded yet (seed_demo_modules creates EMP-001…008). */
export const DEMO_EMPLOYEE_ROSTER_LABELS = [
  "Asha Nair (EMP-001)",
  "Rohan Mehta (EMP-002)",
  "Neha Kapoor (EMP-003)",
  "Priya Sharma (EMP-004)",
  "Arjun Patel (EMP-005)",
  "Meera Iyer (EMP-006)",
  "Kabir Singh (EMP-007)",
  "Sana Qureshi (EMP-008)",
] as const;
