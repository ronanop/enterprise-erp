import { apiClient } from "@/services/api-client";

export type HrmsIntegrationSettings = {
  base_url: string;
  employees_path: string;
  page_size: number;
  has_api_key: boolean;
  api_key_masked: string;
  api_key: string;
};

export type HrmsIntegrationTestSample = {
  employee_code?: string | null;
  name?: string | null;
  email?: string | null;
  department?: string | null;
  status?: string | null;
};

export type HrmsIntegrationTestResult = {
  ok: boolean;
  status_code: number;
  total: number;
  sample_count: number;
  message: string;
  sample: HrmsIntegrationTestSample[];
};

export type HrmsIntegrationSyncResult = {
  fetched: number;
  employees_created: number;
  employees_updated: number;
  employees_skipped: number;
  employee_count: number;
  created: number;
  linked: number;
  updated: number;
  deactivated: number;
  skipped: number;
};

export async function getHrmsIntegrationSettings(): Promise<HrmsIntegrationSettings> {
  const res = await apiClient<HrmsIntegrationSettings>("/users/hrms-integration");
  if (!res.data) throw new Error(res.message || "Failed to load HRMS API settings");
  return res.data;
}

export async function saveHrmsIntegrationSettings(body: {
  base_url: string;
  employees_path: string;
  page_size: number;
  api_key?: string | null;
}): Promise<HrmsIntegrationSettings> {
  const res = await apiClient<HrmsIntegrationSettings>("/users/hrms-integration", {
    method: "PUT",
    body,
  });
  if (!res.data) throw new Error(res.message || "Failed to save HRMS API settings");
  return res.data;
}

export async function testHrmsIntegration(): Promise<HrmsIntegrationTestResult> {
  const res = await apiClient<HrmsIntegrationTestResult>("/users/hrms-integration/test", {
    method: "POST",
  });
  if (!res.data) throw new Error(res.message || "HRMS API test failed");
  return res.data;
}

export async function syncHrmsIntegration(): Promise<HrmsIntegrationSyncResult> {
  const res = await apiClient<HrmsIntegrationSyncResult>("/users/hrms-integration/sync", {
    method: "POST",
  });
  if (!res.data) throw new Error(res.message || "HRMS API sync failed");
  return res.data;
}

export type HrmsLeaveBalanceItem = {
  leave_type_code: string;
  leave_type_name: string;
  opening_balance: number;
  accrued: number;
  used: number;
  closing_balance: number;
  year: number | null;
};

export type HrmsUserProfile = {
  user_id: string;
  employee_id: string | null;
  employee_code: string;
  display_name: string;
  first_name: string;
  last_name: string;
  email: string;
  mobile: string;
  designation: string;
  department: string;
  manager: string;
  manager_code: string;
  branch: string;
  company: string;
  status: string;
  date_of_joining: string | null;
  date_of_leaving: string | null;
  gender: string | null;
  date_of_birth: string | null;
  employment_type: string | null;
  work_location: string | null;
  is_manager: boolean;
  leave_balances: HrmsLeaveBalanceItem[];
  leave_balance_total: number;
  leave_used_total: number;
  profile_fetched_at: string | null;
  leave_fetched_at: string | null;
  leave_refreshed: boolean;
};

export async function getHrmsUserProfile(userId: string): Promise<HrmsUserProfile> {
  const res = await apiClient<HrmsUserProfile>(`/users/${userId}/hrms-profile`);
  if (!res.data) throw new Error(res.message || "Failed to load user profile");
  return res.data;
}

export async function refreshHrmsUserProfile(userId: string): Promise<HrmsUserProfile> {
  const res = await apiClient<HrmsUserProfile>(`/users/${userId}/hrms-profile/refresh`, {
    method: "POST",
  });
  if (!res.data) throw new Error(res.message || "Failed to refresh user profile");
  return res.data;
}
