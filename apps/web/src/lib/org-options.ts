import { resourceService } from "@/services/api-client";

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

export async function listBranchOptions(): Promise<OrgOption[]> {
  const res = await resourceService.list("/branches?page=1&page_size=100");
  return asArray(res.data).map((r) => ({
    id: String(r.id),
    label: String(r.branch_name ?? r.name ?? r.branch_code ?? r.id),
  }));
}

/** Full employee directory from GET /employees (id, code, name, mobile). */
export async function listEmployeeDirectory(): Promise<EmployeeDirectoryEntry[]> {
  try {
    const res = await resourceService.list("/employees?page=1&page_size=200");
    return asArray(res.data).map((r) => {
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
  } catch {
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

export async function listDepartmentOptions(): Promise<OrgOption[]> {
  try {
    const res = await resourceService.list("/departments?page=1&page_size=200");
    return asArray(res.data).map((r) => ({
      id: String(r.id),
      label: String(r.department_name ?? r.name ?? r.department_code ?? r.id),
    }));
  } catch {
    return [];
  }
}

/** Organization physical locations (Branch ≠ Location). */
export async function listLocationOptions(branchId?: string): Promise<OrgOption[]> {
  try {
    const path = branchId
      ? `/locations?branch_id=${encodeURIComponent(branchId)}`
      : "/locations";
    const res = await resourceService.list(path);
    return asArray(res.data).map((r) => ({
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
