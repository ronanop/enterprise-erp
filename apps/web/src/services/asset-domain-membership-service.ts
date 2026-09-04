/** Client for asset.ast_domain_membership APIs. */

import { apiClient } from "@/services/api-client";

export type AssetDomain = "IT" | "NON_IT";
export type DomainMembershipRole = "admin" | "member";

export type DomainMembershipRecord = {
  id: string;
  user_id: string;
  display_name: string | null;
  email: string | null;
  domain: AssetDomain;
  role: DomainMembershipRole;
  assigned_at: string;
  assigned_by: string | null;
  company_id: string;
  version: number;
};

export type DomainMembershipUserOption = {
  user_id: string;
  display_name: string;
  email: string;
};

export type DomainMembershipMe = {
  is_module_admin: boolean;
  domains: string[];
  admin_domains: string[];
  memberships: { id: string; domain: string; role: string }[];
};

const BASE = "/assets/asset-domain-memberships";

export async function fetchMyDomainAccess(): Promise<DomainMembershipMe> {
  const res = await apiClient<DomainMembershipMe>(`${BASE}/me`);
  return (
    res.data ?? {
      is_module_admin: false,
      domains: [],
      admin_domains: [],
      memberships: [],
    }
  );
}

export async function listDomainMemberships(
  domain?: AssetDomain,
): Promise<DomainMembershipRecord[]> {
  const res = await apiClient<{ items: DomainMembershipRecord[]; total: number }>(BASE, {
    query: domain ? { domain } : undefined,
  });
  return res.data?.items ?? [];
}

export async function listAssignableDomainUsers(): Promise<DomainMembershipUserOption[]> {
  const res = await apiClient<DomainMembershipUserOption[]>(`${BASE}/assignable-users`);
  console.debug("[asset-domain] assignable-users", res.data?.length ?? 0, res.data);
  return res.data ?? [];
}

export async function createDomainMembership(input: {
  user_id: string;
  domain: AssetDomain;
  role?: DomainMembershipRole;
}): Promise<DomainMembershipRecord> {
  const res = await apiClient<DomainMembershipRecord>(BASE, {
    method: "POST",
    body: { ...input, role: input.role ?? "member" },
  });
  if (!res.data) throw new Error("Failed to assign domain membership");
  return res.data;
}

export async function updateDomainMembershipRole(
  id: string,
  role: DomainMembershipRole,
): Promise<DomainMembershipRecord> {
  const res = await apiClient<DomainMembershipRecord>(`${BASE}/${id}`, {
    method: "PATCH",
    body: { role },
  });
  if (!res.data) throw new Error("Failed to update role");
  return res.data;
}

export async function deactivateDomainMembership(id: string): Promise<void> {
  await apiClient<null>(`${BASE}/${id}/deactivate`, { method: "POST" });
}
