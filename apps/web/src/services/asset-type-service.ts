/** Client for IT Asset Type master API. */

import { apiClient } from "@/services/api-client";

export type ItAssetType = {
  id: string;
  name: string;
  active: boolean;
  requires_hardware_config: boolean;
  eligible_as_component: boolean;
  description: string | null;
  company_id: string;
  version: number;
};

const BASE = "/assets/asset-types";

export async function listItAssetTypes(params?: {
  active?: boolean;
  search?: string;
}): Promise<ItAssetType[]> {
  const query: Record<string, string | number | boolean> = {};
  if (params?.active != null) query.active = params.active;
  if (params?.search) query.search = params.search;
  const res = await apiClient<ItAssetType[]>(BASE, {
    query: Object.keys(query).length ? query : undefined,
  });
  return res.data ?? [];
}

export async function createItAssetType(input: {
  name: string;
  requires_hardware_config?: boolean;
  eligible_as_component?: boolean;
  description?: string | null;
  active?: boolean;
}): Promise<ItAssetType> {
  const res = await apiClient<ItAssetType>(BASE, {
    method: "POST",
    body: input,
  });
  if (!res.data) throw new Error("Failed to create asset type");
  return res.data;
}

export async function updateItAssetType(
  id: string,
  input: {
    name?: string;
    requires_hardware_config?: boolean;
    eligible_as_component?: boolean;
    description?: string | null;
    active?: boolean;
    version?: number;
  },
): Promise<ItAssetType> {
  const res = await apiClient<ItAssetType>(`${BASE}/${id}`, {
    method: "PATCH",
    body: input,
  });
  if (!res.data) throw new Error("Failed to update asset type");
  return res.data;
}

export async function deactivateItAssetType(id: string): Promise<ItAssetType> {
  const res = await apiClient<ItAssetType>(`${BASE}/${id}/deactivate`, {
    method: "POST",
  });
  if (!res.data) throw new Error("Failed to deactivate asset type");
  return res.data;
}

export async function reactivateItAssetType(id: string): Promise<ItAssetType> {
  const res = await apiClient<ItAssetType>(`${BASE}/${id}/reactivate`, {
    method: "POST",
  });
  if (!res.data) throw new Error("Failed to reactivate asset type");
  return res.data;
}
