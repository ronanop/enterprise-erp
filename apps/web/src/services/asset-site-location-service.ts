/** Client for IT Location → Building master APIs. */

import { apiClient } from "@/services/api-client";

export type SiteLocation = {
  id: string;
  name: string;
  is_head_office: boolean;
  org_location_id: string | null;
  company_id: string;
  version: number;
};

export type SiteBuilding = {
  id: string;
  location_id: string;
  name: string;
  company_id: string;
  version: number;
};

const LOC_BASE = "/assets/site-locations";
const BLD_BASE = "/assets/site-buildings";

export async function listSiteLocations(search?: string): Promise<SiteLocation[]> {
  const res = await apiClient<SiteLocation[]>(LOC_BASE, {
    query: search ? { search } : undefined,
  });
  return res.data ?? [];
}

export async function createSiteLocation(input: {
  name: string;
  is_head_office?: boolean;
  org_location_id?: string | null;
}): Promise<SiteLocation> {
  const res = await apiClient<SiteLocation>(LOC_BASE, {
    method: "POST",
    body: input,
  });
  if (!res.data) throw new Error("Failed to create location");
  return res.data;
}

export async function updateSiteLocation(
  id: string,
  input: {
    name?: string;
    is_head_office?: boolean;
    org_location_id?: string | null;
  },
): Promise<SiteLocation> {
  const res = await apiClient<SiteLocation>(`${LOC_BASE}/${id}`, {
    method: "PATCH",
    body: input,
  });
  if (!res.data) throw new Error("Failed to update location");
  return res.data;
}

export async function deactivateSiteLocation(id: string): Promise<void> {
  await apiClient<null>(`${LOC_BASE}/${id}/deactivate`, { method: "POST" });
}

export async function listSiteBuildings(locationId?: string): Promise<SiteBuilding[]> {
  const res = await apiClient<SiteBuilding[]>(BLD_BASE, {
    query: locationId ? { location_id: locationId } : undefined,
  });
  return res.data ?? [];
}

export async function createSiteBuilding(input: {
  location_id: string;
  name: string;
}): Promise<SiteBuilding> {
  const res = await apiClient<SiteBuilding>(BLD_BASE, {
    method: "POST",
    body: input,
  });
  if (!res.data) throw new Error("Failed to create building");
  return res.data;
}

export async function updateSiteBuilding(
  id: string,
  input: { name?: string },
): Promise<SiteBuilding> {
  const res = await apiClient<SiteBuilding>(`${BLD_BASE}/${id}`, {
    method: "PATCH",
    body: input,
  });
  if (!res.data) throw new Error("Failed to update building");
  return res.data;
}

export async function deactivateSiteBuilding(id: string): Promise<void> {
  await apiClient<null>(`${BLD_BASE}/${id}/deactivate`, { method: "POST" });
}
