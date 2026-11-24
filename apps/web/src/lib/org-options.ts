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
  /** Master employee company — required for cross-company Excel import. */
  companyId: string | null;
  /** Home branch when present. */
  branchId: string | null;
};

const DIRECTORY_PAGE_SIZE = 200;
const DIRECTORY_MAX_PAGES = 50;
const ASSET_EMPLOYEE_DIRECTORY_PATH = "/assets/asset-employees";
const ASSET_DEPARTMENT_DIRECTORY_PATH = "/assets/asset-departments";
const ASSET_DIRECTORY_LIMIT = 2000;

/** Asset picker statuses — mirrors backend DEFAULT_DIRECTORY_STATUSES. */
export const ASSET_EMPLOYEE_DIRECTORY_STATUSES = [
  "active",
  "probation",
  "on_leave",
] as const;

/** Asset department picker statuses — mirrors backend DEFAULT_DIRECTORY_STATUSES. */
export const ASSET_DEPARTMENT_DIRECTORY_STATUSES = ["active"] as const;

const EMPLOYEE_READ_PERM = "asset.asset:read";
const DEPARTMENT_READ_PERM = "asset.asset:read";

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

/** Index directory rows by raw + normalized employee codes for Excel/import matching. */
export function indexEmployeesByCode(
  employees: EmployeeDirectoryEntry[],
): Map<string, EmployeeDirectoryEntry> {
  const map = new Map<string, EmployeeDirectoryEntry>();
  for (const entry of employees) {
    if (!entry.employeeCode) continue;
    map.set(entry.employeeCode.toLowerCase(), entry);
    map.set(normalizeEmployeeCodeKey(entry.employeeCode), entry);
  }
  return map;
}

export function findEmployeeByCode(
  byCode: Map<string, EmployeeDirectoryEntry>,
  code: string,
): EmployeeDirectoryEntry | undefined {
  const trimmed = code.trim();
  if (!trimmed) return undefined;
  return byCode.get(trimmed.toLowerCase()) ?? byCode.get(normalizeEmployeeCodeKey(trimmed));
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
  const seenFirstIds = new Set<string>();
  for (let page = 1; page <= DIRECTORY_MAX_PAGES; page += 1) {
    const res = await resourceService.list(apiPath, {
      page,
      page_size: DIRECTORY_PAGE_SIZE,
    });
    const batch = asArray(res.data);
    const firstId = batch[0] ? String(batch[0].id ?? "") : "";
    // Some org endpoints ignore page and return the full list every time.
    if (page > 1 && firstId && seenFirstIds.has(firstId)) break;
    if (firstId) seenFirstIds.add(firstId);
    out.push(...batch);
    if (batch.length < DIRECTORY_PAGE_SIZE) break;
  }
  return out;
}

function mapEmployeeRows(rows: Record<string, unknown>[]): EmployeeDirectoryEntry[] {
  return rows.map((r) => {
    const displayName =
      trimOrNull(r.display_name) ||
      [r.first_name, r.last_name].filter(Boolean).join(" ").trim();
    const employeeCode = trimOrNull(r.employee_code);
    const codeSuffix = employeeCode ? ` (${employeeCode})` : "";
    const deptOrRole =
      trimOrNull(r.department_name) ||
      trimOrNull(r.designation) ||
      null;
    const suffix = deptOrRole ? ` · ${deptOrRole}` : "";
    const id = String(r.id);
    return {
      id,
      displayName: displayName || id,
      label: `${displayName || id}${codeSuffix}${suffix}`,
      employeeCode,
      mobile: trimOrNull(r.mobile),
      companyId: trimOrNull(r.company_id != null ? String(r.company_id) : null),
      branchId: trimOrNull(r.branch_id != null ? String(r.branch_id) : null),
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

/**
 * Asset employee directory from GET /assets/asset-employees.
 * Default backend filter: active, probation, on_leave only.
 */
export async function listEmployeeDirectory(
  options: ListEmployeeDirectoryOptions = {},
): Promise<EmployeeDirectoryEntry[]> {
  try {
    const res = await resourceService.list(
      `${ASSET_EMPLOYEE_DIRECTORY_PATH}?limit=${ASSET_DIRECTORY_LIMIT}`,
    );
    return mapEmployeeRows(asArray(res.data));
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

/**
 * Asset department directory from GET /assets/asset-departments
 * (organization.org_department — active by default).
 */
export async function listDepartmentOptions(
  options: { throwOnError?: boolean } = {},
): Promise<OrgOption[]> {
  try {
    const res = await resourceService.list(
      `${ASSET_DEPARTMENT_DIRECTORY_PATH}?limit=${ASSET_DIRECTORY_LIMIT}`,
    );
    return asArray(res.data).map((r) => ({
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
