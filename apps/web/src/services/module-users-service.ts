import { apiClient } from "@/services/api-client";

export type ModuleUserOption = {
  user_id: string;
  display_name: string;
  email: string;
};

export type ModuleUserRecord = {
  user_id: string;
  display_name: string;
  email: string;
  role: "admin" | "member" | string;
  status: string;
};

export async function listModuleMembers(moduleKey: string): Promise<ModuleUserRecord[]> {
  const res = await apiClient<ModuleUserRecord[]>(`/modules/${moduleKey}/members`);
  return Array.isArray(res.data) ? res.data : [];
}

export async function listAssignableModuleUsers(moduleKey: string): Promise<ModuleUserOption[]> {
  const res = await apiClient<ModuleUserOption[]>(`/modules/${moduleKey}/assignable-users`);
  return Array.isArray(res.data) ? res.data : [];
}

export async function addModuleMember(
  moduleKey: string,
  userId: string,
): Promise<ModuleUserRecord> {
  const res = await apiClient<ModuleUserRecord>(`/modules/${moduleKey}/members`, {
    method: "POST",
    body: { user_id: userId },
  });
  if (!res.data) {
    throw new Error("Empty response");
  }
  return res.data;
}

export async function removeModuleMember(moduleKey: string, userId: string): Promise<void> {
  await apiClient(`/modules/${moduleKey}/members/${userId}`, { method: "DELETE" });
}
