/**
 * CR-004 Phase 6 Sprint 1 — Excel register parity (read model only).
 * Derives display fields from existing assignment + asset payloads. No new APIs.
 */

import { isActiveAssignment } from "@/domain/asset-prd";
import { splitIssuedFromRemarks } from "@/components/assets/assignment-wizard/assignment-wizard-mapper";

export type RegisterAssignmentLike = {
  id?: string | null;
  asset_id?: string | null;
  document_number?: string | null;
  status?: string | null;
  employee_id?: string | null;
  assignee_label?: string | null;
  allocated_at?: string | null;
  returned_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  delivery_reference_number?: string | null;
  delivery_reference_status?: string | null;
  delivery_challan_signature_status?: string | null;
  assignment_remarks?: string | null;
  return_remarks?: string | null;
};

/** Optional employee master enrichment (from GET /employees). */
export type EmployeeLookupEntry = {
  label?: string;
  displayName?: string;
  employeeCode?: string | null;
  mobile?: string | null;
};

export type EmployeeLookup = Record<string, EmployeeLookupEntry | string>;

/** Excel Employee Asset Register columns → ERP ownership / source. */
export const REGISTER_PARITY_FIELDS = [
  {
    excel: "Employee ID",
    source: "active_assignment.employee_id → employee_code",
    derived: true,
    inventoryKey: "employeeId",
  },
  {
    excel: "Employee Name / Current Holder",
    source: "active_assignment.assignee_label | employeeLabels",
    derived: true,
    inventoryKey: "currentHolder",
  },
  {
    excel: "Laptop Name",
    source: "ast_asset.asset_name",
    derived: false,
    inventoryKey: "laptopName",
  },
  {
    excel: "Asset Tag",
    source: "ast_asset.asset_code",
    derived: false,
    inventoryKey: "assetTag",
  },
  {
    excel: "Brand",
    source: "ast_asset.make → discovery_profile_json.manufacturer",
    derived: true,
    inventoryKey: "manufacturer",
  },
  {
    excel: "Model",
    source: "ast_asset.model → discovery_profile_json.model",
    derived: true,
    inventoryKey: "model",
  },
  {
    excel: "Configuration",
    source: "ast_asset.configuration → discovery profile summary",
    derived: true,
    inventoryKey: "configuration",
  },
  {
    excel: "Issue Date",
    source: "assignment.allocated_at",
    derived: true,
    inventoryKey: "issueDate",
  },
  {
    excel: "Location / Branch",
    source: "ast_asset_location.location_label (current); branch is separate",
    derived: true,
    inventoryKey: "location",
  },
  {
    excel: "Earlier Used By",
    source: "prior returned assignment assignee",
    derived: true,
    inventoryKey: "expandable.earlierUsedBy",
  },
  {
    excel: "Delivery Challan / Reference",
    source: "assignment.delivery_reference_number + status",
    derived: false,
    inventoryKey: "expandable.deliveryChallan",
  },
  {
    excel: "Remarks (issue)",
    source: "assignment.assignment_remarks",
    derived: false,
    inventoryKey: "expandable.assignmentRemarks",
  },
  {
    excel: "Return Remarks",
    source: "latest returned assignment.return_remarks",
    derived: false,
    inventoryKey: "expandable.returnRemarks",
  },
  {
    excel: "Ready / Assigned / Retired / Not Working / Disposed",
    source: "ast_asset.operational_status",
    derived: false,
    inventoryKey: "operationalStatus",
  },
  {
    excel: "Department",
    source: "asset.department_id → org",
    derived: true,
    inventoryKey: "department",
  },
  {
    excel: "Phone Number",
    source: "employee master mobile",
    derived: true,
    inventoryKey: "expandable.phoneNumber",
  },
] as const;

export type RegisterParityField = (typeof REGISTER_PARITY_FIELDS)[number];

const EMPTY = "—";

export const DELIVERY_REFERENCE_STATUS_LABELS: Record<string, string> = {
  not_applicable: "Not applicable",
  pending: "Pending",
  issued: "Issued",
  received: "Received",
};

export const DELIVERY_CHALLAN_SIGNATURE_STATUS_LABELS: Record<string, string> = {
  not_signed: "Not Signed",
  signed: "Signed",
};

export function displayOrDash(value: unknown): string {
  if (value === null || value === undefined) return EMPTY;
  const s = String(value).trim();
  return s || EMPTY;
}

function asEmployeeLookup(
  lookup: Record<string, string> | EmployeeLookup = {},
): EmployeeLookup {
  const out: EmployeeLookup = {};
  for (const [id, value] of Object.entries(lookup)) {
    out[id] = value;
  }
  return out;
}

function normalizeEmployeeLookup(lookup: EmployeeLookup = {}): Record<string, EmployeeLookupEntry> {
  const out: Record<string, EmployeeLookupEntry> = {};
  for (const [id, value] of Object.entries(lookup)) {
    if (typeof value === "string") {
      out[id] = { label: value };
    } else if (value && typeof value === "object") {
      out[id] = value;
    }
  }
  return out;
}

/** Labels map for resolveAssigneeLabel (string id → display label). */
export function employeeLabelsFromLookup(lookup: EmployeeLookup = {}): Record<string, string> {
  const normalized = normalizeEmployeeLookup(lookup);
  const labels: Record<string, string> = {};
  for (const [id, entry] of Object.entries(normalized)) {
    const label = entry.label?.trim() || entry.displayName?.trim();
    if (label) labels[id] = label;
  }
  return labels;
}

export function resolveEmployeeMobile(
  employeeId: string | null | undefined,
  lookup: Record<string, string> | EmployeeLookup = {},
): string {
  if (!employeeId) return EMPTY;
  const entry = normalizeEmployeeLookup(asEmployeeLookup(lookup))[String(employeeId)];
  if (!entry) return EMPTY;
  return displayOrDash(entry.mobile);
}

export function resolveEmployeeCode(
  employeeId: string | null | undefined,
  lookup: Record<string, string> | EmployeeLookup = {},
): string {
  if (!employeeId) return EMPTY;
  const id = String(employeeId);
  const entry = normalizeEmployeeLookup(asEmployeeLookup(lookup))[id];
  if (entry?.employeeCode?.trim()) return entry.employeeCode.trim();
  return EMPTY;
}

export function formatDeliveryReferenceStatus(status: string | null | undefined): string {
  if (!status?.trim()) return EMPTY;
  const key = status.trim().toLowerCase();
  return DELIVERY_REFERENCE_STATUS_LABELS[key] ?? status.trim();
}

export function formatDeliveryChallanSignatureStatus(
  status: string | null | undefined,
): string {
  if (!status?.trim()) return DELIVERY_CHALLAN_SIGNATURE_STATUS_LABELS.not_signed;
  const key = status.trim().toLowerCase();
  return DELIVERY_CHALLAN_SIGNATURE_STATUS_LABELS[key] ?? status.trim();
}

/** Compact DC line for expandable / history: "DC-001 · Issued · Signed" */
export function formatDeliveryChallanSummary(
  number: string | null | undefined,
  status: string | null | undefined,
  signature: string | null | undefined,
): string {
  const num = number?.trim() || "—";
  const st = formatDeliveryReferenceStatus(status);
  const sig = formatDeliveryChallanSignatureStatus(signature);
  if (st === EMPTY && (!signature || !String(signature).trim())) {
    return num;
  }
  return `${num} · ${st === EMPTY ? "—" : st} · ${sig}`;
}

/** Excel-facing delivery challan cell: number, or status when N/A. */
export function formatDeliveryChallanDisplay(
  number: string | null | undefined,
  status: string | null | undefined,
): string {
  const num = number?.trim();
  if (num) return num;
  const st = status?.trim().toLowerCase();
  if (st === "not_applicable") return "N/A";
  if (st) return formatDeliveryReferenceStatus(st);
  return EMPTY;
}

export function formatAssignmentRemarksDisplay(remarks: string | null | undefined): string {
  const { assignmentRemarks } = splitIssuedFromRemarks(remarks);
  return displayOrDash(assignmentRemarks || remarks);
}

function assignmentTimestamp(row: RegisterAssignmentLike): number {
  const raw = row.returned_at ?? row.allocated_at ?? row.updated_at ?? row.created_at ?? "";
  if (typeof raw !== "string" || !raw.trim()) return 0;
  const t = Date.parse(raw);
  return Number.isNaN(t) ? 0 : t;
}

export function groupAssignmentsByAssetId(
  assignments: RegisterAssignmentLike[],
): Map<string, RegisterAssignmentLike[]> {
  const map = new Map<string, RegisterAssignmentLike[]>();
  for (const row of assignments) {
    const assetId = String(row.asset_id ?? "");
    if (!assetId) continue;
    const list = map.get(assetId) ?? [];
    list.push(row);
    map.set(assetId, list);
  }
  return map;
}

export function resolveAssigneeLabel(
  row: RegisterAssignmentLike | null | undefined,
  employeeLabels: Record<string, string> | EmployeeLookup = {},
): string {
  if (!row) return EMPTY;
  const fromApi = row.assignee_label?.trim();
  if (fromApi) return fromApi;
  const employeeId = row.employee_id ? String(row.employee_id) : "";
  const labels = employeeLabelsFromLookup(asEmployeeLookup(employeeLabels));
  if (employeeId && labels[employeeId]) return labels[employeeId];
  if (employeeId) return employeeId;
  return EMPTY;
}

/**
 * Earlier Used By = most recent *returned* assignee that is not the active holder.
 */
export function deriveEarlierUsedBy(
  history: RegisterAssignmentLike[],
  employeeLabels: Record<string, string> | EmployeeLookup = {},
): string {
  const returned = history
    .filter((a) => String(a.status ?? "").toLowerCase() === "returned")
    .sort((a, b) => assignmentTimestamp(b) - assignmentTimestamp(a));

  const active = history.find((a) => isActiveAssignment(a));
  const activeId = active ? String(active.id ?? "") : "";

  for (const row of returned) {
    if (activeId && String(row.id ?? "") === activeId) continue;
    const label = resolveAssigneeLabel(row, employeeLabels);
    if (label !== EMPTY) return label;
  }
  return EMPTY;
}

/** Prefer active assignment; else latest non-cancelled by timestamp. */
export function pickRegisterAssignment(
  history: RegisterAssignmentLike[],
): RegisterAssignmentLike | undefined {
  const active = history.find((a) => isActiveAssignment(a));
  if (active) return active;

  const eligible = history.filter((a) => {
    const s = String(a.status ?? "").toLowerCase();
    return s !== "cancelled" && s !== "draft";
  });
  if (eligible.length === 0) return undefined;
  return [...eligible].sort((a, b) => assignmentTimestamp(b) - assignmentTimestamp(a))[0];
}

export function pickLatestReturnedAssignment(
  history: RegisterAssignmentLike[],
): RegisterAssignmentLike | undefined {
  const returned = history
    .filter((a) => String(a.status ?? "").toLowerCase() === "returned")
    .sort((a, b) => assignmentTimestamp(b) - assignmentTimestamp(a));
  return returned[0];
}

export type RegisterParityExpandable = {
  earlierUsedBy: string;
  deliveryChallan: string;
  deliveryReferenceStatus: string;
  deliverySignature: string;
  deliveryChallanSummary: string;
  phoneNumber: string;
  /** @deprecated Prefer assignmentRemarks — kept for Excel “Remarks” label. */
  remarks: string;
  assignmentRemarks: string;
  returnRemarks: string;
};

export type AssignmentHistoryEntryView = {
  id: string;
  documentNumber: string;
  status: string;
  assigneeLabel: string;
  allocatedAt: string;
  returnedAt: string;
  deliveryReferenceNumber: string;
  deliveryReferenceStatus: string;
  deliverySignature: string;
  deliveryChallanSummary: string;
  assignmentRemarks: string;
  returnRemarks: string;
};

function formatShortDate(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) return EMPTY;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(d);
}

export function formatIssuedDate(allocatedAt: string | null | undefined): string {
  return formatShortDate(allocatedAt);
}

export function buildRegisterParityExpandable(
  history: RegisterAssignmentLike[],
  employeeLookup: Record<string, string> | EmployeeLookup = {},
): RegisterParityExpandable {
  const current = pickRegisterAssignment(history);
  const active = history.find((a) => isActiveAssignment(a));
  const latestReturned = pickLatestReturnedAssignment(history);
  const assignmentRemarks = formatAssignmentRemarksDisplay(current?.assignment_remarks);
  const returnRemarks = displayOrDash(latestReturned?.return_remarks);
  const lookup = asEmployeeLookup(employeeLookup);
  const labels = employeeLabelsFromLookup(lookup);

  return {
    earlierUsedBy: deriveEarlierUsedBy(history, labels),
    deliveryChallan: formatDeliveryChallanDisplay(
      current?.delivery_reference_number,
      current?.delivery_reference_status,
    ),
    deliveryReferenceStatus: formatDeliveryReferenceStatus(current?.delivery_reference_status),
    deliverySignature: formatDeliveryChallanSignatureStatus(
      current?.delivery_challan_signature_status,
    ),
    deliveryChallanSummary: formatDeliveryChallanSummary(
      current?.delivery_reference_number,
      current?.delivery_reference_status,
      current?.delivery_challan_signature_status,
    ),
    // Phone only for current active/approved assignee — never from returned fallback.
    phoneNumber: resolveEmployeeMobile(
      active?.employee_id ? String(active.employee_id) : null,
      lookup,
    ),
    remarks: assignmentRemarks,
    assignmentRemarks,
    returnRemarks,
  };
}

export function mapAssignmentHistoryEntries(
  history: RegisterAssignmentLike[],
  employeeLabels: Record<string, string> | EmployeeLookup = {},
): AssignmentHistoryEntryView[] {
  return [...history]
    .sort((a, b) => assignmentTimestamp(b) - assignmentTimestamp(a))
    .map((row) => ({
      id: String(row.id ?? ""),
      documentNumber: displayOrDash(row.document_number),
      status: displayOrDash(row.status),
      assigneeLabel: resolveAssigneeLabel(row, employeeLabels),
      allocatedAt: formatShortDate(row.allocated_at),
      returnedAt: formatShortDate(row.returned_at),
      deliveryReferenceNumber: displayOrDash(row.delivery_reference_number),
      deliveryReferenceStatus: formatDeliveryReferenceStatus(row.delivery_reference_status),
      deliverySignature: formatDeliveryChallanSignatureStatus(
        row.delivery_challan_signature_status,
      ),
      deliveryChallanSummary: formatDeliveryChallanSummary(
        row.delivery_reference_number,
        row.delivery_reference_status,
        row.delivery_challan_signature_status,
      ),
      assignmentRemarks: formatAssignmentRemarksDisplay(row.assignment_remarks),
      returnRemarks: displayOrDash(row.return_remarks),
    }));
}

export function assertRegisterParityCoverage(
  presentKeys: Set<string>,
): { missing: string[]; covered: string[] } {
  const covered: string[] = [];
  const missing: string[] = [];
  for (const field of REGISTER_PARITY_FIELDS) {
    if (presentKeys.has(field.inventoryKey)) covered.push(field.excel);
    else missing.push(field.excel);
  }
  return { covered, missing };
}
