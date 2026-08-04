/**
 * Management groups API (Employment Types setup tab).
 */

import { apiClient, resourceService } from "@/services/api-client";

export type ManagementGroup = {
  id: string;
  company_id: string;
  group_code: string;
  group_name: string;
  description?: string | null;
  employment_type: string;
  status: string;
  default_shift_id: string;
  default_shift_rotation_id?: string | null;
  default_attendance_rule_id?: string | null;
  default_holiday_calendar_id?: string | null;
  default_weekly_off_policy_id?: string | null;
  feature_toggles_json: Record<string, boolean>;
  employee_count?: number;
  version: number;
};

export type FeatureCatalogSection = {
  id: string;
  title: string;
  features: { key: string; label: string; default: boolean; parent_key: string | null }[];
};

const API = "/hr/management-groups";

export async function loadManagementGroupCatalog(): Promise<FeatureCatalogSection[]> {
  const res = await apiClient<FeatureCatalogSection[]>(`${API}/feature-catalog`);
  return Array.isArray(res.data) ? res.data : [];
}

export async function listManagementGroups(): Promise<ManagementGroup[]> {
  const res = await resourceService.list(API, { page_size: 200 });
  return (Array.isArray(res.data) ? res.data : []) as ManagementGroup[];
}

export async function createManagementGroup(body: Record<string, unknown>): Promise<ManagementGroup> {
  const res = await resourceService.create(API, body);
  return res.data as ManagementGroup;
}

export async function updateManagementGroup(
  id: string,
  body: Record<string, unknown>,
): Promise<ManagementGroup> {
  const res = await resourceService.update(API, id, body);
  return res.data as ManagementGroup;
}

export async function deleteManagementGroup(id: string): Promise<void> {
  await resourceService.delete(API, id);
}

export async function loadEmployeeFeatureToggles(employeeId: string): Promise<Record<string, boolean>> {
  const res = await apiClient<{ feature_toggles: Record<string, boolean> }>(
    `${API}/employees/${employeeId}/features`,
  );
  return res.data?.feature_toggles ?? {};
}

export function isHrFeatureEnabled(
  toggles: Record<string, boolean> | undefined,
  key: string,
): boolean {
  if (!toggles) return true;
  return Boolean(toggles[key]);
}
