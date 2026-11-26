import { ApiClientError, resourceService } from "@/services/api-client";

export type OrgOption = { id: string; label: string };

/** Org named option (department / location) before label collision handling. */
export type DepartmentOptionSeed = {
  id: string;
  label: string;
  companyId?: string;
  companyName?: string;
  branchId?: string;
  headEmployeeId?: string;
};

/** Alias — same shape/rules as departments. */
export type LocationOptionSeed = DepartmentOptionSeed;

/**
 * Tenant-wide org masters: one option per name (case-insensitive).
 * Prefer the first id seen after id-dedupe — labels are not qualified by entity.
 */
export function uniqueDepartmentOptions<T extends DepartmentOptionSeed>(rows: T[]): T[] {
  const byId = new Map<string, T>();
  for (const row of rows) {
    const id = String(row.id || "").trim();
    if (!id) continue;
    if (!byId.has(id)) byId.set(id, row);
  }
  const byName = new Map<string, T>();
  for (const row of byId.values()) {
    const key = row.label.trim().toLowerCase();
    if (!key) continue;
    if (!byName.has(key)) byName.set(key, row);
  }
  return Array.from(byName.values()).sort((a, b) =>
    a.label.localeCompare(b.label, undefined, { sensitivity: "base" }),
  );
}

/** Same as uniqueDepartmentOptions — for work locations shared across entities. */
export const uniqueLocationOptions = uniqueDepartmentOptions;

/** Same as uniqueDepartmentOptions — for designations shared across entities. */
export const uniqueDesignationOptions = uniqueDepartmentOptions;

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
  const msg = `${err.rawMessage || err.message || ""}`.toLowerCase();
  return msg.includes(permissionCode.toLowerCase());
}

export function employeeDirectoryPermissionMessage(err?: unknown): string {
  if (err instanceof ApiClientError && err.status === 403) {
    return "You don't have access to the employee list. Ask an admin to grant employee read access.";
  }
  if (err instanceof ApiClientError && err.message?.trim()) {
    return err.message;
  }
  return "You don't have access to the employee list. Ask an admin to grant employee read access.";
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
    const [deptRows, companyRows] = await Promise.all([
      listAllResourcePages("/departments"),
      listAllResourcePages("/companies").catch(() => [] as Record<string, unknown>[]),
    ]);
    const companyNameById = new Map(
      companyRows.map((c) => [
        String(c.id),
        String(c.company_name ?? c.name ?? c.company_code ?? "").trim(),
      ]),
    );
    return uniqueDepartmentOptions(
      deptRows.map((r) => {
        const companyId = String(r.company_id ?? "");
        return {
          id: String(r.id),
          label: String(r.department_name ?? r.name ?? r.department_code ?? r.id),
          companyId,
          companyName: companyNameById.get(companyId) || "",
        };
      }),
    ).map(({ id, label }) => ({ id, label }));
  } catch (err) {
    if (options.throwOnError) {
      if (isMissingPermissionError(err, DEPARTMENT_READ_PERM)) {
        throw new ApiClientError(
          "You don't have access to departments. Ask an admin to grant department read access.",
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
    const [rows, companyRows] = await Promise.all([
      listAllResourcePages(path),
      listAllResourcePages("/companies").catch(() => [] as Record<string, unknown>[]),
    ]);
    const companyNameById = new Map(
      companyRows.map((c) => [
        String(c.id),
        String(c.company_name ?? c.name ?? c.company_code ?? "").trim(),
      ]),
    );
    return uniqueLocationOptions(
      rows.map((r) => {
        const companyId = String(r.company_id ?? "");
        return {
          id: String(r.id),
          label: String(r.location_name ?? r.name ?? r.location_code ?? r.id),
          companyId,
          companyName: companyNameById.get(companyId) || "",
        };
      }),
    ).map(({ id, label }) => ({ id, label }));
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
