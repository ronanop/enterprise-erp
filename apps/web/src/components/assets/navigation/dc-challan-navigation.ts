/** Path builders for DC challan workspace deep links. */

export function buildDcChallanHref(params?: {
  assetId?: string;
  assignmentId?: string;
  challanId?: string;
}): string {
  const query = new URLSearchParams();
  if (params?.challanId) query.set("challanId", params.challanId);
  if (params?.assetId) query.set("assetId", params.assetId);
  if (params?.assignmentId) query.set("assignmentId", params.assignmentId);
  const qs = query.toString();
  return qs ? `/assets/asset-dc-challans?${qs}` : "/assets/asset-dc-challans";
}

export function buildDcChallanDetailHref(challanId: string): string {
  return buildDcChallanHref({ challanId });
}

export function isEmployeeAllocation(allocationType: string | null | undefined): boolean {
  return String(allocationType ?? "").toLowerCase() === "employee";
}

/** Challans snapshotted from a MANUAL_ENTRY assignment (no directory employee_code). */
export function isManualEntryDcChallan(row: {
  deployed_to?: string | null;
}): boolean {
  return Boolean(String(row.deployed_to ?? "").trim());
}

/** Inventory Create DC: Case 2 on Ready to Move; Case 1 only for employee assignments. */
export function canCreateDcChallanFromInventory(row: {
  operationalStatus?: string | null;
  assignmentAllocationType?: string | null;
}): boolean {
  const ops = String(row.operationalStatus ?? "");
  if (ops === "READY_TO_MOVE") return true;
  if (ops === "ASSIGNED") return isEmployeeAllocation(row.assignmentAllocationType);
  return false;
}

const CLOSED_ASSIGNMENT_STATUSES = new Set(["returned", "cancelled"]);

const OPEN_DC_STATUSES = new Set([
  "PENDING",
  "SENT_TO_SCM",
  "DOCUMENT_RECEIVED",
  "SIGNED",
]);

/** Assignment list/detail Create DC: employee paperwork, not already closed. */
export function canLaunchDcFromAssignment(row: {
  allocation_type?: string | null;
  status?: string | null;
}): boolean {
  if (!isEmployeeAllocation(row.allocation_type)) return false;
  return !CLOSED_ASSIGNMENT_STATUSES.has(String(row.status ?? "").toLowerCase());
}

export function isOpenDcChallanStatus(status: string | null | undefined): boolean {
  return OPEN_DC_STATUSES.has(String(status ?? ""));
}
