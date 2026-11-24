import {
  isActiveAssignment,
  parseDiscoveryProfile,
} from "@/domain/asset-prd";
import { formatCompactConfigurationDisplay } from "@/config/asset-hardware-options";
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

/**
 * All Assets Location column: city/site name only (drop building after · or newline).
 */
export function formatInventoryLocationColumn(raw: string | null | undefined): string {
  if (!raw?.trim() || raw.trim() === "—") return "—";
  const primary = raw
    .trim()
    .split(/\r?\n/)[0]!
    .split(/\s*·\s*/)[0]!
    .trim();
  return primary || "—";
}

/**
 * All Assets Configuration column: compact IT style (`i5 10th GEN 16/512GB`).
 * Drops Charger; never invents missing hardware values.
 */
export function formatConfigurationColumn(raw: string | null | undefined): string {
  return formatCompactConfigurationDisplay(raw);
}

function isBlankChargerPlaceholder(code: string): boolean {
  const lower = code.trim().toLowerCase();
  return (
    !lower ||
    lower === "—" ||
    lower === "-" ||
    lower === "n/a" ||
    lower === "na" ||
    lower === "no"
  );
}

/** Auto-allocated accessory codes (`CHARGER-0001`) — prefer Excel serial when both exist. */
const AUTO_COMPONENT_CODE_RE = /^[A-Z][A-Z0-9_]*-\d+$/i;

export function resolveAccessorySerialDisplay(
  componentCode?: string | null,
  serialNumber?: string | null,
): string {
  const code = (componentCode ?? "").trim();
  const serial = (serialNumber ?? "").trim();
  if (code && serial && code !== serial && AUTO_COMPONENT_CODE_RE.test(code)) {
    return serial;
  }
  return code || serial || "—";
}

/**
 * Charger column: prefer active CHARGER accessory code; fall back to labeled
 * `Charger: …` in stored configuration. Returns "" (blank cell) — never "—"/No/N/A.
 */
export function resolveInventoryChargerCode(
  accessories: InventoryAccessoryLine[] | undefined | null,
  configuration?: string | null,
): string {
  if (accessories?.length) {
    const charger = accessories.find((a) => {
      const label = (a.typeLabel ?? "").trim().toLowerCase();
      return label === "charger" || label.startsWith("charger ·") || label.startsWith("charger ");
    });
    if (charger) {
      const code = (charger.serialDisplay ?? "").trim();
      if (!isBlankChargerPlaceholder(code)) return code;
    }
  }

  const fromConfig = configuration?.match(/Charger\s*:\s*([^;\n]+)/i)?.[1]?.trim() ?? "";
  if (!isBlankChargerPlaceholder(fromConfig)) return fromConfig;
  return "";
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
    chargerCode: resolveInventoryChargerCode(accessories, it.configuration),
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
    location: formatInventoryLocationColumn(ctx.locationLabels[id]),
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
