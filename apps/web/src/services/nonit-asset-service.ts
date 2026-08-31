/** Client for Non-IT asset register APIs (`/assets/non-it/*`). */

import { apiClient } from "@/services/api-client";

export type NonItAssignmentMode = "EMPLOYEE" | "LOCATION" | "BOTH";
export type NonItAssetStatus = "IN_STOCK" | "ASSIGNED" | "MAINTENANCE" | "DISPOSED";

export type NonItAssetTypeCategory =
  | "FURNITURE"
  | "APPLIANCE"
  | "ELECTRONICS"
  | "FIXTURE"
  | "EQUIPMENT"
  | "STORAGE"
  | "OTHER";

export type NonItAssetType = {
  id: string;
  name: string;
  prefix: string;
  active: boolean;
  assignment_mode: NonItAssignmentMode;
  category: NonItAssetTypeCategory;
  description: string | null;
  metadata: Record<string, unknown> | null;
  company_id: string;
  version: number;
};

export type NonItLocation = {
  id: string;
  name: string;
  location_kind: NonItLocationKind;
  code: string | null;
  building: string | null;
  floor: string | null;
  remarks: string | null;
  active: boolean;
  company_id: string;
  branch_id: string;
  version: number;
};

export type NonItLocationKind =
  | "CONFERENCE_ROOM"
  | "MEETING_ROOM"
  | "DEPARTMENT"
  | "FLOOR"
  | "CABIN"
  | "LOBBY"
  | "CAFETERIA"
  | "COMMON_AREA"
  | "WAREHOUSE"
  | "PARKING"
  | "OTHER";

export type NonItTimelineEvent = {
  id: string;
  event_type: string;
  event_data: Record<string, unknown> | null;
  occurred_at: string;
  actor_user_id: string | null;
  remarks: string | null;
  summary: string;
};

export type NonItAsset = {
  id: string;
  asset_code: string;
  asset_type_id: string;
  asset_type_name: string | null;
  asset_type_prefix: string | null;
  assignment_mode?: NonItAssignmentMode | null;
  status: NonItAssetStatus;
  serial_number: string | null;
  condition: string | null;
  current_employee_id: string | null;
  current_employee_name: string | null;
  current_location_id: string | null;
  current_location_name: string | null;
  assignment_display: string | null;
  purchase_date: string | null;
  remarks: string | null;
  maintenance_reason?: string | null;
  maintenance_notes?: string | null;
  maintenance_started_at?: string | null;
  maintenance_provider?: string | null;
  maintenance_cost?: number | string | null;
  disposal_reason?: string | null;
  disposal_date?: string | null;
  prior_holder_available?: boolean;
  prior_holder_label?: string | null;
  company_id: string;
  branch_id: string | null;
  version: number;
  created_at: string | null;
  timeline?: NonItTimelineEvent[] | null;
};

export type NonItAssetListResult = {
  items: NonItAsset[];
  total: number;
  page: number;
  page_size: number;
};

export type NonItImportRow = {
  asset_type: string;
  quantity: number;
};

export type NonItImportLineSummary = {
  asset_type: string;
  requested: number;
  created: number;
};

export type NonItImportSummary = {
  lines: NonItImportLineSummary[];
  total_created: number;
};

export type NonItDashboardSummary = {
  company_id: string;
  total_assets: number;
  in_stock: number;
  assigned: number;
  in_maintenance: number;
  disposed: number;
  by_status: { status: string; count: number; pct_of_total: number }[];
  by_type: {
    asset_type_id: string;
    name: string;
    prefix: string;
    count: number;
  }[];
  by_location: { location_id: string; name: string; count: number }[];
};

export type NonItAssetCreateInput = {
  asset_type_id: string;
  status?: "IN_STOCK" | "ASSIGNED";
  purchase_date?: string | null;
  remarks?: string | null;
  current_employee_id?: string | null;
  current_location_id?: string | null;
};

const BASE = "/assets/non-it";

export async function listNonItAssetTypes(params?: {
  active?: boolean;
  q?: string;
  category?: NonItAssetTypeCategory;
}): Promise<NonItAssetType[]> {
  const res = await apiClient<{ items: NonItAssetType[]; total: number }>(
    `${BASE}/asset-types`,
    {
      query: {
        active: params?.active,
        q: params?.q,
        category: params?.category,
      },
    },
  );
  return res.data?.items ?? [];
}

export async function createNonItAssetType(input: {
  name: string;
  prefix: string;
  assignment_mode: NonItAssignmentMode;
  category?: NonItAssetTypeCategory;
  description?: string | null;
  active?: boolean;
}): Promise<NonItAssetType> {
  const res = await apiClient<NonItAssetType>(`${BASE}/asset-types`, {
    method: "POST",
    body: input,
  });
  if (!res.data) throw new Error("Failed to create asset type");
  return res.data;
}

export async function peekNonItNextCode(
  assetTypeId: string,
): Promise<{ asset_type_id: string; provisional_code: string }> {
  const res = await apiClient<{ asset_type_id: string; provisional_code: string }>(
    `${BASE}/asset-types/${assetTypeId}/next-code-preview`,
  );
  if (!res.data?.provisional_code) {
    throw new Error("Failed to preview next asset code");
  }
  return res.data;
}

export async function updateNonItAssetType(
  id: string,
  input: {
    name?: string;
    prefix?: string;
    assignment_mode?: NonItAssignmentMode;
    category?: NonItAssetTypeCategory;
    description?: string | null;
    active?: boolean;
    version?: number;
  },
): Promise<NonItAssetType> {
  const res = await apiClient<NonItAssetType>(`${BASE}/asset-types/${id}`, {
    method: "PATCH",
    body: input,
  });
  if (!res.data) throw new Error("Failed to update asset type");
  return res.data;
}

export async function listNonItLocations(params?: {
  active?: boolean;
  q?: string;
  location_kind?: NonItLocationKind;
}): Promise<NonItLocation[]> {
  const res = await apiClient<{ items: NonItLocation[]; total: number }>(
    `${BASE}/locations`,
    {
      query: {
        active: params?.active,
        q: params?.q,
        location_kind: params?.location_kind,
      },
    },
  );
  return res.data?.items ?? [];
}

export async function createNonItLocation(input: {
  name: string;
  location_kind?: NonItLocationKind;
  code?: string | null;
  building?: string | null;
  floor?: string | null;
  remarks?: string | null;
  active?: boolean;
}): Promise<NonItLocation> {
  const res = await apiClient<NonItLocation>(`${BASE}/locations`, {
    method: "POST",
    body: input,
  });
  if (!res.data) throw new Error("Failed to create location");
  return res.data;
}

export async function updateNonItLocation(
  id: string,
  input: {
    name?: string;
    location_kind?: NonItLocationKind;
    code?: string | null;
    building?: string | null;
    floor?: string | null;
    remarks?: string | null;
    active?: boolean;
    version?: number;
  },
): Promise<NonItLocation> {
  const res = await apiClient<NonItLocation>(`${BASE}/locations/${id}`, {
    method: "PATCH",
    body: input,
  });
  if (!res.data) throw new Error("Failed to update location");
  return res.data;
}

export async function listNonItAssets(params?: {
  page?: number;
  page_size?: number;
  asset_type_id?: string;
  location_id?: string;
  status?: string;
  assignment?: string;
  q?: string;
}): Promise<NonItAssetListResult> {
  const res = await apiClient<NonItAssetListResult>(`${BASE}/assets`, {
    query: {
      page: params?.page,
      page_size: params?.page_size,
      asset_type_id: params?.asset_type_id,
      location_id: params?.location_id,
      status: params?.status,
      assignment: params?.assignment,
      q: params?.q,
    },
  });
  return (
    res.data ?? {
      items: [],
      total: 0,
      page: params?.page ?? 1,
      page_size: params?.page_size ?? 25,
    }
  );
}

export async function getNonItDashboardSummary(): Promise<NonItDashboardSummary> {
  const res = await apiClient<NonItDashboardSummary>(`${BASE}/dashboard-summary`);
  if (!res.data) {
    return {
      company_id: "",
      total_assets: 0,
      in_stock: 0,
      assigned: 0,
      in_maintenance: 0,
      disposed: 0,
      by_status: [],
      by_type: [],
      by_location: [],
    };
  }
  return res.data;
}

export async function getNonItAsset(
  id: string,
  opts?: { include_timeline?: boolean },
): Promise<NonItAsset> {
  const res = await apiClient<NonItAsset>(`${BASE}/assets/${id}`, {
    query: { include_timeline: opts?.include_timeline ?? true },
  });
  if (!res.data) throw new Error("Non-IT asset not found");
  return res.data;
}

export async function createNonItAsset(input: NonItAssetCreateInput): Promise<NonItAsset> {
  const res = await apiClient<NonItAsset>(`${BASE}/assets`, {
    method: "POST",
    body: input,
  });
  if (!res.data) throw new Error("Failed to create asset");
  return res.data;
}

export async function assignNonItAsset(
  id: string,
  input: {
    employee_id?: string | null;
    location_id?: string | null;
    version?: number;
    remarks?: string;
  },
): Promise<NonItAsset> {
  const res = await apiClient<NonItAsset>(`${BASE}/assets/${id}/assign`, {
    method: "POST",
    body: input,
  });
  if (!res.data) throw new Error("Failed to assign asset");
  return res.data;
}

export async function unassignNonItAsset(
  id: string,
  input?: { version?: number; remarks?: string },
): Promise<NonItAsset> {
  const res = await apiClient<NonItAsset>(`${BASE}/assets/${id}/unassign`, {
    method: "POST",
    body: input ?? {},
  });
  if (!res.data) throw new Error("Failed to unassign asset");
  return res.data;
}

export async function startNonItMaintenance(
  id: string,
  input: {
    maintenance_reason: string;
    maintenance_notes?: string | null;
    maintenance_provider?: string | null;
    maintenance_cost?: number | null;
    version?: number;
  },
): Promise<NonItAsset> {
  const res = await apiClient<NonItAsset>(`${BASE}/assets/${id}/maintenance/start`, {
    method: "POST",
    body: input,
  });
  if (!res.data) throw new Error("Failed to start maintenance");
  return res.data;
}

export async function completeNonItMaintenance(
  id: string,
  input: {
    completion_notes?: string | null;
    completion_date?: string | null;
    restore_prior_holder?: boolean;
    version?: number;
  },
): Promise<NonItAsset> {
  const res = await apiClient<NonItAsset>(`${BASE}/assets/${id}/maintenance/complete`, {
    method: "POST",
    body: input,
  });
  if (!res.data) throw new Error("Failed to complete maintenance");
  return res.data;
}

export async function disposeNonItAsset(
  id: string,
  input: {
    disposal_reason: string;
    disposal_date?: string | null;
    remarks?: string | null;
    version?: number;
  },
): Promise<NonItAsset> {
  const res = await apiClient<NonItAsset>(`${BASE}/assets/${id}/dispose`, {
    method: "POST",
    body: input,
  });
  if (!res.data) throw new Error("Failed to dispose asset");
  return res.data;
}

export function buildNonItAssetDetailUrl(assetId: string, origin?: string): string {
  const base =
    origin ?? (typeof window !== "undefined" ? window.location.origin : "");
  return `${base.replace(/\/$/, "")}/assets/non-it/${assetId}`;
}

export async function importNonItAssets(
  rows: NonItImportRow[],
): Promise<NonItImportSummary> {
  const res = await apiClient<NonItImportSummary>(`${BASE}/assets/import`, {
    method: "POST",
    body: { rows },
  });
  if (!res.data) throw new Error("Import failed");
  return res.data;
}
