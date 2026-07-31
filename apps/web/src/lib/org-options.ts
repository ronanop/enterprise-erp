import { resourceService } from "@/services/api-client";

export type OrgOption = { id: string; label: string };

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

export async function listBranchOptions(): Promise<OrgOption[]> {
  const res = await resourceService.list("/branches?page=1&page_size=100");
  return asArray(res.data).map((r) => ({
    id: String(r.id),
    label: String(r.branch_name ?? r.name ?? r.branch_code ?? r.id),
  }));
}

export async function listEmployeeOptions(): Promise<OrgOption[]> {
  try {
    const res = await resourceService.list("/employees?page=1&page_size=200");
    return asArray(res.data).map((r) => {
      const name = [r.first_name, r.last_name].filter(Boolean).join(" ").trim();
      const code = r.employee_code ? ` (${String(r.employee_code)})` : "";
      const dept =
        typeof r.designation === "string" && r.designation.trim()
          ? ` · ${r.designation}`
          : "";
      return {
        id: String(r.id),
        label: `${name || String(r.id)}${code}${dept}`,
      };
    });
  } catch {
    return [];
  }
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
