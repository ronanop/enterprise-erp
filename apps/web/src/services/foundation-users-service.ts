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
};

export async function listFoundationUsers(): Promise<FoundationUser[]> {
  const res = await apiClient<FoundationUser[]>("/users");
  const data = res.data;
  return Array.isArray(data) ? data : [];
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
