import { apiClient } from "@/services/api-client";

/** Organization Microsoft 365 email domain (matches API MICROSOFT_USER_EMAIL_DOMAIN). */
export const ORG_EMAIL_DOMAIN = "cachedigitech.com";

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
  department_id?: string | null;
  company_ids?: string[];
};

export type M365UserSyncResult = {
  domain: string;
  directory_count: number;
  created: number;
  updated: number;
};

export type AssignmentOption = { id: string; label: string };

export function isOrganizationDomainEmail(email: string, domain = ORG_EMAIL_DOMAIN): boolean {
  const normalized = email.trim().toLowerCase();
  const d = domain.trim().toLowerCase().replace(/^@/, "");
  return Boolean(d) && normalized.endsWith(`@${d}`);
}

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

export async function syncM365OrganizationUsers(): Promise<M365UserSyncResult> {
  const res = await apiClient<M365UserSyncResult>("/users/sync-m365", { method: "POST" });
  if (!res.data) {
    throw new Error(res.message || "M365 sync returned an empty response");
  }
  return res.data;
}

export async function createOrganizationMember(input: {
  email: string;
  display_name: string;
}): Promise<FoundationUser> {
  const res = await apiClient<FoundationUser>("/users/organization-members", {
    method: "POST",
    body: {
      email: input.email.trim().toLowerCase(),
      display_name: input.display_name.trim(),
    },
  });
  if (!res.data) {
    throw new Error(res.message || "Failed to create organization member");
  }
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
