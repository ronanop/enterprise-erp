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

export async function listHrAdmins(): Promise<HrAdminRecord[]> {
  const res = await apiClient<HrAdminRecord[]>("/hr/superadmin/admins");
  return (res.data ?? []).map((row) => ({
    ...row,
    company_ids: Array.isArray(row.company_ids) ? row.company_ids.map(String) : [],
  }));
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
  return {
    ...res.data,
    company_ids: Array.isArray(res.data.company_ids) ? res.data.company_ids.map(String) : [],
  };
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
  return {
    ...res.data,
    company_ids: Array.isArray(res.data.company_ids) ? res.data.company_ids.map(String) : [],
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
