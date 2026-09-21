/**
 * Display helpers for the Asset Assignment register list.
 * Pure mapping over existing assignment / org / location payloads — no new APIs.
 */

import {
  displayOrDash,
  formatDeliveryChallanSignatureStatus,
  formatDeliveryReferenceStatus,
  resolveAssigneeLabel,
  resolveEmployeeCode,
  type EmployeeLookup,
  type RegisterAssignmentLike,
} from "@/components/assets/inventory/register-parity";

export type AssignmentRegisterRow = RegisterAssignmentLike & {
  allocation_type?: string | null;
  department_id?: string | null;
  project_id?: string | null;
  employee_source?: string | null;
  status?: string | null;
  workflow_status?: string | null;
  document_number?: string | null;
};

export type AssetRegisterLookup = {
  asset_name?: string | null;
  asset_code?: string | null;
  department_id?: string | null;
  current_location_label?: string | null;
};

export type AssetLocationLookup = {
  location_label?: string | null;
  location_id?: string | null;
  building_id?: string | null;
};

const EMPTY = "—";

export type AssignmentRegisterDcInput = {
  delivery_reference_number?: string | null;
  delivery_reference_status?: string | null;
  delivery_challan_signature_status?: string | null;
  /** True when at least one DC challan row is linked to the assignment. */
  hasDcRecord: boolean;
  /** Linked DC challan workflow status when hasDcRecord. */
  dcChallanStatus?: string | null;
};

/**
 * DC Challan column for the assignment register.
 * Distinguishes "no DC record" (Not Created) from an existing DC's real status.
 */
export function formatAssignmentRegisterDcChallan(
  number: string | null | undefined,
  status: string | null | undefined,
  signature: string | null | undefined,
  options?: { hasDcRecord?: boolean; dcChallanStatus?: string | null },
): string {
  return formatAssignmentRegisterDcColumn({
    delivery_reference_number: number,
    delivery_reference_status: status,
    delivery_challan_signature_status: signature,
    hasDcRecord: options?.hasDcRecord ?? true,
    dcChallanStatus: options?.dcChallanStatus,
  });
}

export function formatAssignmentRegisterDcColumn(input: AssignmentRegisterDcInput): string {
  const st = (input.delivery_reference_status ?? "").trim().toLowerCase();
  const sigRaw = (input.delivery_challan_signature_status ?? "").trim().toLowerCase();
  const sig = sigRaw || "not_signed";

  if (st === "not_applicable") return "Not Applicable";

  // No DC challan document yet — assignment may still say delivery_reference=pending.
  if (!input.hasDcRecord) return "Not Created";

  const dcStatus = (input.dcChallanStatus ?? "").trim().toUpperCase();
  if (dcStatus === "SIGNED") return "Signed";
  if (dcStatus === "PENDING") {
    return `Pending · ${formatDeliveryChallanSignatureStatus(sig)}`;
  }
  if (dcStatus === "SENT_TO_SCM") return "Sent to SCM";
  if (dcStatus === "DOCUMENT_RECEIVED") return "Document received";
  if (dcStatus === "RECEIVED") return "Received";
  if (dcStatus === "CANCELLED") return "Cancelled";

  // Fallback: assignment delivery reference fields (legacy display).
  if (sig === "signed") return "Signed";

  let statusLabel: string;
  if (st === "issued") statusLabel = "Generated";
  else if (st === "pending") statusLabel = "Pending";
  else if (st === "received") statusLabel = "Received";
  else statusLabel = formatDeliveryReferenceStatus(input.delivery_reference_status);

  if (!statusLabel || statusLabel === EMPTY) {
    return formatDeliveryChallanSignatureStatus(sig);
  }
  return `${statusLabel} · ${formatDeliveryChallanSignatureStatus(sig)}`;
}

export function formatAssignmentDate(value: string | null | undefined): string {
  if (!value?.trim()) return EMPTY;
  const day = value.trim().slice(0, 10);
  return day || EMPTY;
}

/**
 * Assignment list STATUS column — lifecycle only.
 * Uses `status` (assignment business state). Never appends `workflow_status`
 * (e.g. never "active / approved").
 */
export function formatAssignmentStatus(
  status: string | null | undefined,
  _workflowStatus?: string | null,
): string {
  void _workflowStatus; // intentionally ignored — workflow is not shown in the register
  const raw = status?.trim();
  if (!raw) return EMPTY;

  const key = raw.toLowerCase().replace(/-/g, "_");

  if (key === "active") return "Active";
  if (key === "returned") return "Returned";
  if (key === "cancelled") return "Cancelled";

  // Do not surface internal workflow-style lifecycle labels in the register.
  if (
    key === "draft" ||
    key === "submitted" ||
    key === "approved" ||
    key === "rejected" ||
    key === "in_progress" ||
    key === "pending"
  ) {
    return EMPTY;
  }

  // Unknown value: title-case without inventing a workflow composite.
  return key
    .split("_")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * Assignee for the register.
 * Directory employee → real name; manual entry → manual_employee_name.
 * Never returns "Assigned" or a raw UUID.
 */
export function resolveRegisterAssignee(
  row: AssignmentRegisterRow | null | undefined,
  employeeLookup: EmployeeLookup = {},
  departmentLabels: Record<string, string> = {},
  projectLabels: Record<string, string> = {},
): string {
  if (!row) return EMPTY;

  if (row.allocation_type === "employee" || !row.allocation_type) {
    const name = resolveAssigneeLabel(row, employeeLookup);
    if (name !== EMPTY) return name;
  }

  if (row.allocation_type === "department" && row.department_id) {
    return displayOrDash(departmentLabels[String(row.department_id)]);
  }
  if (row.allocation_type === "project" && row.project_id) {
    return displayOrDash(projectLabels[String(row.project_id)]);
  }

  const fallback = resolveAssigneeLabel(row, employeeLookup);
  if (fallback !== EMPTY) return fallback;
  return EMPTY;
}

export function resolveRegisterEmployeeId(
  row: AssignmentRegisterRow | null | undefined,
  employeeLookup: EmployeeLookup = {},
): string {
  if (!row?.employee_id) return EMPTY;
  return resolveEmployeeCode(row.employee_id, employeeLookup);
}

export function resolveRegisterDepartment(
  row: AssignmentRegisterRow | null | undefined,
  asset: AssetRegisterLookup | null | undefined,
  employeeDepartmentId: string | null | undefined,
  departmentLabels: Record<string, string> = {},
): string {
  const deptId =
    row?.department_id ||
    employeeDepartmentId ||
    asset?.department_id ||
    null;
  if (!deptId) return EMPTY;
  return displayOrDash(departmentLabels[String(deptId)]);
}

export function resolveRegisterLocation(
  asset: AssetRegisterLookup | null | undefined,
  location: AssetLocationLookup | null | undefined,
  siteLocationLabels: Record<string, string> = {},
): string {
  const label = location?.location_label?.trim() || asset?.current_location_label?.trim();
  if (label) return label;
  const locId = location?.location_id ? String(location.location_id) : "";
  if (locId && siteLocationLabels[locId]) return siteLocationLabels[locId]!;
  return EMPTY;
}

export function resolveRegisterBuilding(
  location: AssetLocationLookup | null | undefined,
  buildingLabels: Record<string, string> = {},
): string {
  const buildingId = location?.building_id ? String(location.building_id) : "";
  if (!buildingId) return EMPTY;
  return displayOrDash(buildingLabels[buildingId]);
}

export function resolveRegisterAssetName(
  asset: AssetRegisterLookup | null | undefined,
  assetId: string | null | undefined,
): string {
  const name = asset?.asset_name?.trim();
  if (name) return name;
  return EMPTY;
}

export function resolveRegisterAssetCode(
  asset: AssetRegisterLookup | null | undefined,
): string {
  const code = asset?.asset_code?.trim();
  if (code) return code;
  return EMPTY;
}

/** True when the assignment row represents a returned / inactive allocation. */
export function isReturnedAssignment(row: AssignmentRegisterRow | null | undefined): boolean {
  const st = (row?.status ?? "").trim().toLowerCase();
  return st === "returned" || st === "cancelled" || Boolean(row?.returned_at);
}
