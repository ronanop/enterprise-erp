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
  const detailed = await listEmployeeWizardOptions();
  return detailed.map((e) => ({ id: e.id, label: e.label }));
}

export type EmployeeWizardOption = OrgOption & {
  employeeCode?: string;
  name?: string;
  department?: string;
  departmentId?: string;
  designation?: string;
  branch?: string;
  phone?: string;
  email?: string;
  manager?: string;
  employmentStatus?: string;
};

/** Rich employee rows for Assignment Employee Information section (existing /employees API). */
export async function listEmployeeWizardOptions(): Promise<EmployeeWizardOption[]> {
  try {
    const [empRes, deptOpts, branchOpts] = await Promise.all([
      resourceService.list("/employees?page=1&page_size=200"),
      listDepartmentOptions().catch(() => [] as OrgOption[]),
      listBranchOptions().catch(() => [] as OrgOption[]),
    ]);
    const deptLabel = Object.fromEntries(deptOpts.map((d) => [d.id, d.label]));
    const branchLabel = Object.fromEntries(branchOpts.map((b) => [b.id, b.label]));
    const rows = asArray(empRes.data);

    const byId = new Map(
      rows.map((r) => {
        const name = [r.first_name, r.last_name].filter(Boolean).join(" ").trim() || String(r.id);
        return [String(r.id), name] as const;
      }),
    );

    return rows.map((r) => {
      const name = [r.first_name, r.last_name].filter(Boolean).join(" ").trim() || String(r.id);
      const code = r.employee_code ? String(r.employee_code) : "";
      const designation = typeof r.designation === "string" ? r.designation : "";
      const departmentId = r.department_id != null ? String(r.department_id) : "";
      const department =
        typeof r.department_name === "string"
          ? r.department_name
          : departmentId
            ? deptLabel[departmentId] ?? departmentId.slice(0, 8)
            : "";
      const branchId = r.branch_id != null ? String(r.branch_id) : "";
      const branch =
        typeof r.branch_name === "string"
          ? r.branch_name
          : branchId
            ? branchLabel[branchId] ?? branchId.slice(0, 8)
            : "";
      const phone =
        typeof r.mobile === "string"
          ? r.mobile
          : typeof r.phone === "string"
            ? r.phone
            : typeof r.phone_number === "string"
              ? r.phone_number
              : "";
      const email = typeof r.email === "string" ? r.email : "";
      const managerId = r.reporting_manager_id != null ? String(r.reporting_manager_id) : "";
      const manager = managerId ? byId.get(managerId) ?? managerId.slice(0, 8) : "";
      const employmentStatus = typeof r.status === "string" ? r.status : "";
      const label = `${name}${code ? ` (${code})` : ""}${designation ? ` · ${designation}` : ""}`;
      return {
        id: String(r.id),
        label,
        employeeCode: code,
        name,
        department,
        departmentId,
        designation,
        branch,
        phone,
        email,
        manager,
        employmentStatus,
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
