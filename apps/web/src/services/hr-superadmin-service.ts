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
  return res.data ?? [];
}

export async function assignHrAdmin(employeeId: string): Promise<HrAdminRecord> {
  const res = await apiClient<HrAdminRecord>("/hr/superadmin/admins", {
    method: "POST",
    body: { employee_id: employeeId },
  });
  if (!res.data) throw new Error(res.message || "Assign failed");
  return res.data;
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
