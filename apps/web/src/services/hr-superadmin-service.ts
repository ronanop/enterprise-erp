import { apiClient } from "@/services/api-client";

export type HrAdminRecord = {
  employee_id: string;
  employee_code: string;
  display_name: string;
  email: string;
  designation: string;
  user_id: string;
  login_created: boolean;
  temporary_password: string | null;
  company_ids: string[];
  nav_keys: string[];
  nav_unrestricted: boolean;
};

export type HrNavAccessRecord = {
  unrestricted: boolean;
  nav_keys: string[];
};

export type HrAdminEntityOption = {
  id: string;
  company_code: string;
  company_name: string;
  legal_name: string;
  status: string;
};

export type HrAdminPasswordResponse = {
  employee_id: string;
  display_name: string;
  email: string;
  temporary_password: string;
};

export type HrActivityLogRecord = {
  id: string;
  occurred_at: string;
  kind: string;
  action: string;
  entity_name: string | null;
  actor_name: string | null;
  actor_email: string | null;
  summary: string;
};

function mapAdmin(row: HrAdminRecord): HrAdminRecord {
  return {
    ...row,
    company_ids: Array.isArray(row.company_ids) ? row.company_ids.map(String) : [],
    nav_keys: Array.isArray(row.nav_keys) ? row.nav_keys.map(String) : [],
    nav_unrestricted: Boolean(row.nav_unrestricted),
  };
}

export async function listHrAdmins(): Promise<HrAdminRecord[]> {
  const res = await apiClient<HrAdminRecord[]>("/hr/superadmin/admins");
  return (res.data ?? []).map(mapAdmin);
}

export async function listHrEntities(): Promise<HrAdminEntityOption[]> {
  const res = await apiClient<HrAdminEntityOption[]>("/hr/superadmin/entities");
  return res.data ?? [];
}

export async function assignHrAdmin(
  employeeId: string,
  companyIds: string[] = [],
): Promise<HrAdminRecord> {
  const res = await apiClient<HrAdminRecord>("/hr/superadmin/admins", {
    method: "POST",
    body: { employee_id: employeeId, company_ids: companyIds },
  });
  if (!res.data) throw new Error(res.message || "Assign failed");
  return mapAdmin(res.data);
}

export async function setHrAdminEntities(
  employeeId: string,
  companyIds: string[],
): Promise<HrAdminRecord> {
  const res = await apiClient<HrAdminRecord>(`/hr/superadmin/admins/${employeeId}/entities`, {
    method: "PATCH",
    body: { company_ids: companyIds },
  });
  if (!res.data) throw new Error(res.message || "Entity update failed");
  return mapAdmin(res.data);
}

export async function setHrAdminNav(employeeId: string, navKeys: string[]): Promise<HrAdminRecord> {
  const res = await apiClient<HrAdminRecord>(`/hr/superadmin/admins/${employeeId}/nav`, {
    method: "PATCH",
    body: { nav_keys: navKeys },
  });
  if (!res.data) throw new Error(res.message || "Menu update failed");
  return mapAdmin(res.data);
}

export async function getMyHrNavAccess(): Promise<HrNavAccessRecord> {
  const res = await apiClient<HrNavAccessRecord>("/hr/nav-access");
  return {
    unrestricted: Boolean(res.data?.unrestricted),
    nav_keys: Array.isArray(res.data?.nav_keys) ? res.data.nav_keys.map(String) : [],
  };
}

export async function revokeHrAdmin(employeeId: string): Promise<void> {
  await apiClient<null>(`/hr/superadmin/admins/${employeeId}`, { method: "DELETE" });
}

export async function resetHrAdminPassword(employeeId: string): Promise<HrAdminPasswordResponse> {
  const res = await apiClient<HrAdminPasswordResponse>(
    `/hr/superadmin/admins/${employeeId}/reset-password`,
    { method: "POST", body: {} },
  );
  if (!res.data) throw new Error(res.message || "Password reset failed");
  return res.data;
}

export async function listHrActivityLogs(limit = 200): Promise<HrActivityLogRecord[]> {
  const res = await apiClient<HrActivityLogRecord[]>("/hr/superadmin/activity-logs", {
    query: { limit },
  });
  return res.data ?? [];
}
