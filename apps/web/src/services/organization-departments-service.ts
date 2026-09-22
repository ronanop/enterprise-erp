import { apiClient, resourceService } from "@/services/api-client";

export type OrgDepartment = {
  id: string;
  tenant_id: string;
  company_id: string;
  branch_id: string;
  department_code: string;
  department_name: string;
  status: string;
  parent_department_id?: string | null;
  head_employee_id?: string | null;
  version?: number;
  created_at?: string | null;
  updated_at?: string | null;
  module_keys: string[];
};

export type OrgCompanyOption = { id: string; label: string };
export type OrgBranchOption = { id: string; label: string; company_id: string };

function asRows(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) return data as Record<string, unknown>[];
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    for (const key of ["items", "results", "data", "rows"]) {
      if (Array.isArray(obj[key])) return obj[key] as Record<string, unknown>[];
    }
  }
  return [];
}

export async function listDepartments(): Promise<OrgDepartment[]> {
  const res = await apiClient<OrgDepartment[]>("/departments");
  const rows = Array.isArray(res.data) ? res.data : [];
  return rows.map((row) => ({
    ...row,
    module_keys: Array.isArray(row.module_keys) ? row.module_keys : [],
  }));
}

export async function createDepartment(input: {
  company_id: string;
  branch_id: string;
  department_code: string;
  department_name: string;
  module_keys?: string[];
}): Promise<OrgDepartment> {
  const res = await apiClient<OrgDepartment>("/departments", {
    method: "POST",
    body: {
      company_id: input.company_id,
      branch_id: input.branch_id,
      department_code: input.department_code.trim().toUpperCase(),
      department_name: input.department_name.trim(),
      module_keys: input.module_keys ?? [],
    },
  });
  if (!res.data) {
    throw new Error(res.message || "Failed to create department");
  }
  return {
    ...res.data,
    module_keys: Array.isArray(res.data.module_keys) ? res.data.module_keys : [],
  };
}

export async function updateDepartmentModules(
  departmentId: string,
  moduleKeys: string[],
): Promise<OrgDepartment> {
  const res = await apiClient<OrgDepartment>(`/departments/${departmentId}/modules`, {
    method: "PUT",
    body: { module_keys: moduleKeys },
  });
  if (!res.data) {
    throw new Error(res.message || "Failed to update department modules");
  }
  return {
    ...res.data,
    module_keys: Array.isArray(res.data.module_keys) ? res.data.module_keys : [],
  };
}

export async function listCompanyOptions(): Promise<OrgCompanyOption[]> {
  try {
    const res = await resourceService.list("/companies");
    return asRows(res.data).map((r) => ({
      id: String(r.id),
      label: String(r.company_name ?? r.name ?? r.company_code ?? r.id),
    }));
  } catch {
    return [];
  }
}

export async function listBranchOptions(companyId?: string): Promise<OrgBranchOption[]> {
  try {
    const res = await resourceService.list(
      "/branches",
      companyId ? { company_id: companyId } : undefined,
    );
    return asRows(res.data).map((r) => ({
      id: String(r.id),
      company_id: String(r.company_id ?? ""),
      label: String(r.branch_name ?? r.name ?? r.branch_code ?? r.id),
    }));
  } catch {
    return [];
  }
}
