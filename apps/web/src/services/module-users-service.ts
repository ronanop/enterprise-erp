import { apiClient } from "@/services/api-client";

export type ServiceJobRole = "service_engineer" | "field_engineer";

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
  service_job_role?: ServiceJobRole | null;
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
  serviceJobRole?: ServiceJobRole,
): Promise<ModuleUserRecord> {
  const res = await apiClient<ModuleUserRecord>(`/modules/${moduleKey}/members`, {
    method: "POST",
    body: {
      user_id: userId,
      ...(serviceJobRole ? { service_job_role: serviceJobRole } : {}),
    },
  });
  if (!res.data) {
    throw new Error("Empty response");
  }
  return res.data;
}

export async function updateModuleMemberServiceRole(
  moduleKey: string,
  userId: string,
  serviceJobRole: ServiceJobRole,
): Promise<ModuleUserRecord> {
  const res = await apiClient<ModuleUserRecord>(
    `/modules/${moduleKey}/members/${userId}/service-role`,
    {
      method: "PATCH",
      body: { service_job_role: serviceJobRole },
    },
  );
  if (!res.data) {
    throw new Error("Empty response");
  }
  return res.data;
}

export async function removeModuleMember(moduleKey: string, userId: string): Promise<void> {
  await apiClient(`/modules/${moduleKey}/members/${userId}`, { method: "DELETE" });
}
