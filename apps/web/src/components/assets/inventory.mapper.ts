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
  formatIssuedDate,
  groupAssignmentsByAssetId,
  mapAssignmentHistoryEntries,
  resolveAssigneeLabel,
  resolveEmployeeCode,
  type AssignmentHistoryEntryView,
  type EmployeeLookup,
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
  /** Active accessories keyed by asset id (batch-loaded). */
  accessoriesByAssetId?: Map<string, InventoryAccessoryLine[]>;
  /**
   * Employee enrichment from GET /employees.
   * Accepts legacy id→label map or rich { label, employeeCode, mobile }.
   */
  employeeLabels?: Record<string, string>;
  employeeLookup?: EmployeeLookup;
};

export type InventoryAccessoryLine = {
  typeLabel: string;
  serialDisplay: string;
  componentName?: string;
  status?: string;
};

export type InventoryExpandableFields = {
  earlierUsedBy: string;
  deliveryChallan: string;
  deliveryReferenceStatus: string;
  deliverySignature?: string;
  deliveryChallanSummary?: string;
  phoneNumber: string;
  /** @deprecated Prefer assignmentRemarks — kept for Excel “Remarks” label. */
  remarks: string;
  assignmentRemarks: string;
  returnRemarks: string;
  accessories?: InventoryAccessoryLine[];
};

export type InventoryRowViewModel = {
  id: string;
  assetTag: string;
  laptopName: string;
  serialNumber: string;
  manufacturer: string;
  model: string;
  configuration: string;
  /** Charger component code only; empty string when absent (no placeholder). */
  chargerCode: string;
  currentHolder: string;
  employeeId: string;
  department: string;
  branch: string;
  /** Raw branch UUID for APIs that require branch_id (e.g. dispose). */
  branchId: string;
  operationalStatus: string;
  lifecycleStatus: string;
  issueDate: string;
  location: string;
  expandable: InventoryExpandableFields;
  assignmentHistory: AssignmentHistoryEntryView[];
  /** Active assignment id when present (deep-link Case 1). */
  activeAssignmentId?: string | null;
  /** Active assignment allocation_type — DC create is employee-only this phase. */
  assignmentAllocationType?: string | null;
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
  headerLocationId: string;
  page: number;
  pageSize: number;
}): {
  page: number;
  page_size: number;
  q?: string;
  operational_status?: string;
  location_id?: string;
} {
  const operational = resolveOperationalStatusForQuery(input.preset, input.filters);
  const locationId =
    input.headerLocationId !== BRANCH_ALL_VALUE ? input.headerLocationId : undefined;

  return {
    page: input.page,
    page_size: input.pageSize,
    q: input.filters.search.trim() || undefined,
    operational_status: operational,
    location_id: locationId,
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

export function persistedOrDiscovery(
  persisted: unknown,
  discoveryFallback: string,
): string {
  if (typeof persisted === "string" && persisted.trim()) return persisted.trim();
  return discoveryFallback;
}

/** Shared IT registration display: persisted make/model/config with discovery fallback. */
export function resolveItRegistrationFields(asset: AssetsRow): {
  make: string;
  model: string;
  configuration: string;
} {
  return {
    make: persistedOrDiscovery(asset.make, discoveryManufacturer(asset)),
    model: persistedOrDiscovery(asset.model, discoveryModel(asset)),
    configuration: configurationSummary(asset),
  };
}

export function configurationSummary(asset: AssetsRow): string {
  if (typeof asset.configuration === "string" && asset.configuration.trim()) {
    return asset.configuration.trim();
  }
  const profile = parseDiscoveryProfile(asset);
  if (!profile) return "—";
  const parts = [profile.cpu, profile.ram, profile.os_name].filter(Boolean);
  return parts.length ? parts.join(" · ") : "—";
}

const CONFIG_COLUMN_LABELS = ["Processor", "RAM", "Storage"] as const;

/**
 * All Assets Configuration column: Processor / RAM / Storage only.
 * Excludes Generation, Charger, and other labels. Does not invent values.
 */
export function formatConfigurationColumn(raw: string | null | undefined): string {
  if (!raw?.trim() || raw.trim() === "—") return "—";
  const text = raw.trim();
  const parts = text
    .split(";")
    .map((p) => p.trim())
    .filter(Boolean);

  const byLabel = new Map<string, string>();
  let sawLabeled = false;
  for (const part of parts) {
    const m = /^(Processor|Generation|RAM|Storage|Charger)\s*:\s*(.+)$/i.exec(part);
    if (!m) continue;
    sawLabeled = true;
    const key = m[1]!.toLowerCase();
    const value = m[2]!.trim();
    if (!value) continue;
    if (key === "processor") byLabel.set("Processor", value);
    else if (key === "ram") byLabel.set("RAM", value);
    else if (key === "storage") byLabel.set("Storage", value);
    // Generation / Charger intentionally omitted
  }

  if (sawLabeled) {
    const lines = CONFIG_COLUMN_LABELS.filter((label) => byLabel.has(label)).map(
      (label) => `${label}: ${byLabel.get(label)}`,
    );
    return lines.length > 0 ? lines.join("\n") : "—";
  }

  // Legacy unlabelled strings (e.g. discovery "i7 · 16GB") — show as-is, never inject Charger.
  return text;
}

/**
 * Charger column: code only when a charger accessory exists with a real code.
 * Returns "" (blank cell) — never "—", "No", or "N/A".
 */
export function resolveInventoryChargerCode(
  accessories: InventoryAccessoryLine[] | undefined | null,
): string {
  if (!accessories?.length) return "";
  const charger = accessories.find((a) => {
    const label = (a.typeLabel ?? "").trim().toLowerCase();
    return label === "charger" || label.startsWith("charger ·") || label.startsWith("charger ");
  });
  if (!charger) return "";
  const code = (charger.serialDisplay ?? "").trim();
  if (!code) return "";
  const lower = code.toLowerCase();
  if (lower === "—" || lower === "-" || lower === "n/a" || lower === "na" || lower === "no") {
    return "";
  }
  return code;
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
  const employeeLookup: EmployeeLookup = ctx.employeeLookup ?? ctx.employeeLabels ?? {};
  const accessories = ctx.accessoriesByAssetId?.get(id) ?? [];
  const expandable = {
    ...buildRegisterParityExpandable(history, employeeLookup),
    accessories,
  };
  const branchKey = String(asset.branch_id ?? "");
  // Prefer active assignment department (custody); fall back to asset home dept.
  const assignmentDept =
    assignment && assignment.department_id != null
      ? String(assignment.department_id)
      : "";
  const deptKey = assignmentDept || String(asset.department_id ?? "");

  const operational =
    typeof asset.operational_status === "string" && asset.operational_status
      ? asset.operational_status
      : "—";
  const lifecycle = typeof asset.status === "string" ? asset.status : "—";

  const holderLabel = assignment
    ? resolveAssigneeLabel(assignment as RegisterAssignmentLike, employeeLookup)
    : "—";
  const employeeIdRaw = assignment?.employee_id ? String(assignment.employee_id) : "";
  const employeeCode = employeeIdRaw
    ? resolveEmployeeCode(employeeIdRaw, employeeLookup)
    : "—";

  const it = resolveItRegistrationFields(asset);

  return {
    id,
    assetTag: String(asset.asset_code ?? asset.document_number ?? "—"),
    laptopName: String(asset.asset_name ?? "—"),
    serialNumber:
      typeof asset.serial_number === "string" && asset.serial_number.trim()
        ? asset.serial_number.trim()
        : "—",
    manufacturer: it.make,
    model: it.model,
    configuration: formatConfigurationColumn(it.configuration),
    chargerCode: resolveInventoryChargerCode(accessories),
    currentHolder: holderLabel,
    // Prefer employee_code; do not show raw UUID when code is unavailable.
    employeeId: employeeCode,
    department: ctx.departmentLabels[deptKey] ?? (deptKey ? deptKey.slice(0, 8) : "—"),
    branch: ctx.branchLabels[branchKey] ?? (branchKey ? branchKey.slice(0, 8) : "—"),
    branchId: branchKey,
    operationalStatus: operational,
    lifecycleStatus: lifecycle,
    // Issued Date = allocated_at only (system set on activation).
    issueDate: assignment
      ? formatIssuedDate(
          typeof assignment.allocated_at === "string" ? assignment.allocated_at : null,
        )
      : "—",
    // Prefer current ast_asset_location keyed by asset id — never fake with branch.
    location: ctx.locationLabels[id] ?? "—",
    expandable,
    assignmentHistory: mapAssignmentHistoryEntries(history, employeeLookup),
    activeAssignmentId: assignment?.id ? String(assignment.id) : null,
    assignmentAllocationType: assignment?.allocation_type
      ? String(assignment.allocation_type)
      : null,
  };
}

export function mapAssetsToInventoryRows(
  assets: AssetsRow[],
  ctx: InventoryLookupContext,
): InventoryRowViewModel[] {
  return assets.map((asset) => mapAssetToInventoryRow(asset, ctx));
}

/**
 * Phase 5F: client-side inventory filtering is retired.
 * Filters are applied by GET /assets; this returns rows unchanged for call-site compatibility.
 */
export function applyClientInventoryFilters(
  rows: InventoryRowViewModel[],
  _filters: InventoryFilterValues,
  _rawAssets: AssetsRow[],
): InventoryRowViewModel[] {
  return rows;
}

export function branchLookupFromOrgOptions(
  branches: Array<{ id: string; label: string }>,
): Record<string, string> {
  return Object.fromEntries(branches.map((b) => [b.id, b.label]));
}
