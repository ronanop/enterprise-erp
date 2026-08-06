import {
  isActiveAssignment,
  parseDiscoveryProfile,
} from "@/domain/asset-prd";
import type { AssetsRow } from "@/services/assets-service";
import type { InventoryFilterValues } from "@/components/assets/shared";
import { BRANCH_ALL_VALUE } from "@/components/assets/shared";
import type { InventoryPresetId } from "@/components/assets/inventory.types";
import { PRESET_OPERATIONAL_STATUS } from "@/components/assets/inventory.types";
import {
  buildRegisterParityExpandable,
  groupAssignmentsByAssetId,
  mapAssignmentHistoryEntries,
  resolveAssigneeLabel,
  type AssignmentHistoryEntryView,
  type RegisterAssignmentLike,
} from "@/components/assets/inventory/register-parity";

export type InventoryLookupContext = {
  branchLabels: Record<string, string>;
  departmentLabels: Record<string, string>;
  categoryLabels: Record<string, string>;
  locationLabels: Record<string, string>;
  /** Active assignment per asset (custody). */
  assignmentsByAssetId: Map<string, AssetsRow>;
  /** Full assignment history per asset (Earlier Used By, remarks, delivery). */
  assignmentHistoryByAssetId?: Map<string, RegisterAssignmentLike[]>;
  /** Optional employee id → display label (existing /employees list). */
  employeeLabels?: Record<string, string>;
};

export type InventoryExpandableFields = {
  earlierUsedBy: string;
  deliveryChallan: string;
  deliveryReferenceStatus: string;
  phoneNumber: string;
  /** @deprecated Prefer assignmentRemarks — kept for Excel “Remarks” label. */
  remarks: string;
  assignmentRemarks: string;
  returnRemarks: string;
};

export type InventoryRowViewModel = {
  id: string;
  assetTag: string;
  laptopName: string;
  manufacturer: string;
  model: string;
  configuration: string;
  currentHolder: string;
  employeeId: string;
  department: string;
  branch: string;
  operationalStatus: string;
  lifecycleStatus: string;
  issueDate: string;
  location: string;
  expandable: InventoryExpandableFields;
  assignmentHistory: AssignmentHistoryEntryView[];
};

export function resolveOperationalStatusForQuery(
  preset: InventoryPresetId,
  filters: InventoryFilterValues,
): string | undefined {
  if (filters.operationalStatus) return filters.operationalStatus;
  return PRESET_OPERATIONAL_STATUS[preset];
}

export function buildInventoryListQuery(input: {
  preset: InventoryPresetId;
  filters: InventoryFilterValues;
  headerBranchId: string;
  page: number;
  pageSize: number;
}): {
  page: number;
  page_size: number;
  q?: string;
  branch_id?: string;
  operational_status?: string;
  status?: string;
  asset_category_id?: string;
} {
  const branchId =
    input.headerBranchId !== BRANCH_ALL_VALUE
      ? input.headerBranchId
      : input.filters.branchId !== BRANCH_ALL_VALUE
        ? input.filters.branchId
        : undefined;

  const operational = resolveOperationalStatusForQuery(input.preset, input.filters);

  return {
    page: input.page,
    page_size: input.pageSize,
    q: input.filters.search.trim() || undefined,
    branch_id: branchId,
    operational_status: operational,
    status: input.filters.lifecycleStatus || undefined,
    asset_category_id: input.filters.categoryId || undefined,
  };
}

export function indexActiveAssignments(assignments: AssetsRow[]): Map<string, AssetsRow> {
  const map = new Map<string, AssetsRow>();
  for (const row of assignments) {
    const assetId = String(row.asset_id ?? "");
    if (!assetId) continue;
    if (!isActiveAssignment(row)) continue;
    if (!map.has(assetId)) map.set(assetId, row);
  }
  return map;
}

export { groupAssignmentsByAssetId };

function discoveryManufacturer(asset: AssetsRow): string {
  const profile = parseDiscoveryProfile(asset);
  return profile?.manufacturer?.trim() || "—";
}

function discoveryModel(asset: AssetsRow): string {
  const profile = parseDiscoveryProfile(asset);
  return profile?.model?.trim() || "—";
}

export function configurationSummary(asset: AssetsRow): string {
  const profile = parseDiscoveryProfile(asset);
  if (!profile) return "—";
  const parts = [profile.cpu, profile.ram, profile.os_name].filter(Boolean);
  return parts.length ? parts.join(" · ") : "—";
}

function formatDate(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(d);
}

export function mapAssetToInventoryRow(
  asset: AssetsRow,
  ctx: InventoryLookupContext,
): InventoryRowViewModel {
  const id = String(asset.id ?? "");
  const assignment = ctx.assignmentsByAssetId.get(id);
  const history =
    ctx.assignmentHistoryByAssetId?.get(id) ??
    (assignment ? [assignment as RegisterAssignmentLike] : []);
  const employeeLabels = ctx.employeeLabels ?? {};
  const expandable = buildRegisterParityExpandable(history, employeeLabels);
  const branchKey = String(asset.branch_id ?? "");
  const deptKey = String(asset.department_id ?? "");

  const operational =
    typeof asset.operational_status === "string" && asset.operational_status
      ? asset.operational_status
      : "—";
  const lifecycle = typeof asset.status === "string" ? asset.status : "—";

  const holderLabel = assignment
    ? resolveAssigneeLabel(assignment as RegisterAssignmentLike, employeeLabels)
    : "—";

  return {
    id,
    assetTag: String(asset.asset_code ?? asset.document_number ?? "—"),
    laptopName: String(asset.asset_name ?? "—"),
    manufacturer: discoveryManufacturer(asset),
    model: discoveryModel(asset),
    configuration: configurationSummary(asset),
    currentHolder: holderLabel === "—" && assignment ? "Assigned" : holderLabel,
    employeeId: assignment?.employee_id ? String(assignment.employee_id) : "—",
    department: ctx.departmentLabels[deptKey] ?? (deptKey ? deptKey.slice(0, 8) : "—"),
    branch: ctx.branchLabels[branchKey] ?? (branchKey ? branchKey.slice(0, 8) : "—"),
    operationalStatus: operational,
    lifecycleStatus: lifecycle,
    issueDate: formatDate(assignment?.allocated_at ?? assignment?.created_at),
    location: ctx.locationLabels[branchKey] ?? ctx.branchLabels[branchKey] ?? "—",
    expandable,
    assignmentHistory: mapAssignmentHistoryEntries(history, employeeLabels),
  };
}

export function mapAssetsToInventoryRows(
  assets: AssetsRow[],
  ctx: InventoryLookupContext,
): InventoryRowViewModel[] {
  return assets.map((asset) => mapAssetToInventoryRow(asset, ctx));
}

export function applyClientInventoryFilters(
  rows: InventoryRowViewModel[],
  filters: InventoryFilterValues,
  rawAssets: AssetsRow[],
): InventoryRowViewModel[] {
  const assetById = new Map(rawAssets.map((a) => [String(a.id), a]));
  return rows.filter((row) => {
    const raw = assetById.get(row.id);
    if (!raw) return true;
    if (filters.departmentId && String(raw.department_id ?? "") !== filters.departmentId) {
      return false;
    }
    if (filters.assetType && String(raw.asset_type ?? "") !== filters.assetType) {
      return false;
    }
    if (filters.locationId && filters.locationId !== BRANCH_ALL_VALUE) {
      if (String(raw.branch_id ?? "") !== filters.locationId) return false;
    }
    return true;
  });
}

export function branchLookupFromOrgOptions(
  branches: Array<{ id: string; label: string }>,
): Record<string, string> {
  return Object.fromEntries(branches.map((b) => [b.id, b.label]));
}
