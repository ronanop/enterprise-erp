import type { AssetCategoryRow } from "@/services/assets-service";
import type { AssetDashboardSummaryDto } from "@/services/assets-service";
import type { OrgOption } from "@/lib/org-options";

/**
 * Demo master data for Asset UI walkthroughs when the API is empty or the
 * session is guest (protected category/dashboard endpoints require auth).
 */
export const DEMO_ASSET_CATEGORIES: AssetCategoryRow[] = [
  {
    id: "a1111111-1111-4111-8111-111111111111",
    category_code: "IT",
    category_name: "IT Equipment",
    default_useful_life_months: 36,
    default_depreciation_method: "straight_line",
    status: "active",
    company_id: "demo-company",
    version: 1,
  },
  {
    id: "a2222222-2222-4222-8222-222222222222",
    category_code: "FURN",
    category_name: "Furniture & Fixtures",
    default_useful_life_months: 60,
    default_depreciation_method: "straight_line",
    status: "active",
    company_id: "demo-company",
    version: 1,
  },
  {
    id: "a3333333-3333-4333-8333-333333333333",
    category_code: "VEH",
    category_name: "Vehicles",
    default_useful_life_months: 48,
    default_depreciation_method: "straight_line",
    status: "active",
    company_id: "demo-company",
    version: 1,
  },
];

export const DEMO_ASSET_BRANCHES: OrgOption[] = [
  {
    id: "b1111111-1111-4111-8111-111111111111",
    label: "Demo HQ — Noida",
  },
  {
    id: "b2222222-2222-4222-8222-222222222222",
    label: "Demo Branch — Mumbai",
  },
];

/** Sample operations KPIs so the dashboard still renders for demos. */
export const DEMO_ASSET_DASHBOARD_SUMMARY: AssetDashboardSummaryDto = {
  company_id: "demo-company",
  total_assets: 12,
  ready_to_move: 4,
  assigned: 6,
  retired: 1,
  pending_disposal: 1,
  disposed: 0,
};

export function resolveDemoCategories(
  fromApi: AssetCategoryRow[],
): AssetCategoryRow[] {
  if (fromApi.length >= 3) return fromApi;
  if (fromApi.length === 0) return DEMO_ASSET_CATEGORIES;
  const known = new Set(fromApi.map((c) => c.category_code.toUpperCase()));
  const extras = DEMO_ASSET_CATEGORIES.filter(
    (c) => !known.has(c.category_code.toUpperCase()),
  );
  return [...fromApi, ...extras].slice(0, Math.max(3, fromApi.length));
}

export function resolveDemoBranches(fromApi: OrgOption[]): OrgOption[] {
  if (fromApi.length > 0) return fromApi;
  return DEMO_ASSET_BRANCHES;
}

/** Keep current selection when still valid; otherwise pick the first option. */
export function coerceOptionId(current: string, optionIds: string[]): string {
  if (current && optionIds.includes(current)) return current;
  return optionIds[0] ?? "";
}

export function isDemoBranchId(id: string): boolean {
  return DEMO_ASSET_BRANCHES.some((b) => b.id === id);
}

export function isDemoCategoryId(id: string): boolean {
  return DEMO_ASSET_CATEGORIES.some((c) => c.id === id);
}
