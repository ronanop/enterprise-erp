import { apiClient } from "@/services/api-client";

export type FoundationUser = {
  id: string;
  tenant_id: string;
  email: string;
  display_name: string;
  employee_id: string | null;
  user_type: string;
  status: string;
  mfa_enabled: boolean;
  role_ids: string[];
  assigned_module_keys: string[];
  admin_module_keys: string[];
  must_change_password?: boolean;
  /** HRMS employee code of the linked employee, when any. */
  employee_code?: string | null;
  /** True when linked to an onboarded HRMS employee with a valid employee id. */
  hrms_valid?: boolean;
  department_id?: string | null;
  company_ids?: string[];
};

export type HrmsUserSyncResult = {
  employee_count: number;
  created: number;
  linked: number;
  updated: number;
  deactivated: number;
  skipped: number;
};

export type ModuleAccessRole = "admin" | "member";

export type TemporaryPassword = {
  user_id: string;
  email: string;
  display_name: string;
  temporary_password: string;
};

export type AssignmentOption = { id: string; label: string };

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

export async function listFoundationUsers(): Promise<FoundationUser[]> {
  const res = await apiClient<FoundationUser[]>("/users");
  const data = res.data;
  return Array.isArray(data) ? data : [];
}

/** ERP admin: create / link logins for HRMS onboarded employees. */
export async function syncHrmsUsers(): Promise<HrmsUserSyncResult> {
  const res = await apiClient<HrmsUserSyncResult>("/users/sync-hrms", { method: "POST" });
  if (!res.data) {
    throw new Error(res.message || "HRMS sync returned an empty response");
  }
  return res.data;
}

/** ERP admin: give a user Admin or User access to one or more modules (one email). */
export async function grantModuleAccess(
  userId: string,
  moduleKeys: string | string[],
  role: ModuleAccessRole,
  serviceJobRole?: string,
): Promise<FoundationUser> {
  const keys = (Array.isArray(moduleKeys) ? moduleKeys : [moduleKeys])
    .map((k) => k.trim())
    .filter(Boolean);
  const res = await apiClient<FoundationUser>(`/users/${userId}/module-access`, {
    method: "POST",
    body: {
      module_keys: keys,
      ...(keys.length === 1 ? { module_key: keys[0] } : {}),
      role,
      ...(serviceJobRole ? { service_job_role: serviceJobRole } : {}),
    },
  });
  if (!res.data) throw new Error(res.message || "Failed to update module access");
  return res.data;
}

/** ERP admin: remove a user's Admin or User access to one module. */
export async function revokeModuleAccess(userId: string, moduleKey: string): Promise<FoundationUser> {
  const res = await apiClient<FoundationUser>(
    `/users/${userId}/module-access/${encodeURIComponent(moduleKey)}`,
    { method: "DELETE" },
  );
  if (!res.data) throw new Error(res.message || "Failed to remove module access");
  return res.data;
}

/** ERP admin: one-time password the user must change after signing in. */
export async function issueTemporaryPassword(userId: string): Promise<TemporaryPassword> {
  const res = await apiClient<TemporaryPassword>(`/users/${userId}/temporary-password`, {
    method: "POST",
  });
  if (!res.data) throw new Error(res.message || "Failed to issue temporary password");
  return res.data;
}

export async function updateUserModules(
  userId: string,
  moduleKeys: string[],
): Promise<FoundationUser> {
  const res = await apiClient<FoundationUser>(`/users/${userId}/modules`, {
    method: "PUT",
    body: { module_keys: moduleKeys },
  });
  if (!res.data) {
    throw new Error("Empty response");
  }
  return res.data;
}

export async function replaceUserRoles(
  userId: string,
  roleIds: string[],
): Promise<FoundationUser> {
  const res = await apiClient<FoundationUser>(`/users/${userId}/roles`, {
    method: "PUT",
    body: { role_ids: roleIds },
  });
  if (!res.data) {
    throw new Error(res.message || "Failed to update roles");
  }
  return res.data;
}

export async function replaceUserCompanyScopes(
  userId: string,
  companyIds: string[],
): Promise<FoundationUser> {
  const res = await apiClient<FoundationUser>(`/users/${userId}/org-scopes`, {
    method: "PUT",
    body: { company_ids: companyIds },
  });
  if (!res.data) {
    throw new Error(res.message || "Failed to update hierarchy");
  }
  return res.data;
}

export async function updateUserDepartment(
  userId: string,
  departmentId: string | null,
): Promise<FoundationUser> {
  const res = await apiClient<FoundationUser>(`/users/${userId}/department`, {
    method: "PUT",
    body: { department_id: departmentId },
  });
  if (!res.data) {
    throw new Error(res.message || "Failed to update department");
  }
  return res.data;
}

export async function listRoleOptions(): Promise<AssignmentOption[]> {
  try {
    const res = await apiClient<unknown>("/roles");
    return asRows(res.data).map((r) => ({
      id: String(r.id),
      label: String(r.role_name ?? r.role_code ?? r.id),
    }));
  } catch {
    return [];
  }
}

export async function listDepartmentAssignmentOptions(): Promise<AssignmentOption[]> {
  try {
    const res = await apiClient<unknown>("/departments?page=1&page_size=200");
    return asRows(res.data).map((r) => ({
      id: String(r.id),
      label: String(r.department_name ?? r.name ?? r.department_code ?? r.id),
    }));
  } catch {
    return [];
  }
}

export async function listCompanyAssignmentOptions(): Promise<AssignmentOption[]> {
  try {
    const res = await apiClient<unknown>("/companies?page=1&page_size=200");
    return asRows(res.data).map((r) => ({
      id: String(r.id),
      label: String(r.company_name ?? r.name ?? r.company_code ?? r.id),
    }));
  } catch {
    return [];
  }
}
