/** CR-004 shared operational status tokens (UI only). */

export const OPERATIONAL_STATUS_VALUES = [
  "READY_TO_MOVE",
  "ASSIGNED",
  "RETIRED",
  "PENDING_DISPOSAL",
  "DISPOSED",
] as const;

export type OperationalStatusValue = (typeof OPERATIONAL_STATUS_VALUES)[number];

export const OPERATIONAL_STATUS_LABELS: Record<OperationalStatusValue, string> = {
  READY_TO_MOVE: "Ready to Move",
  ASSIGNED: "Assigned",
  RETIRED: "Retired",
  PENDING_DISPOSAL: "Pending Disposal",
  DISPOSED: "Disposed",
};

export function isOperationalStatus(value: string): value is OperationalStatusValue {
  return (OPERATIONAL_STATUS_VALUES as readonly string[]).includes(value);
}

export const LIFECYCLE_STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  submitted: "Submitted",
  approved: "Approved",
  active: "Active",
  in_maintenance: "In Maintenance",
  transferred: "Transferred",
  disposed: "Disposed",
  written_off: "Written Off",
  cancelled: "Cancelled",
};

export function formatLifecycleStatusLabel(status: string): string {
  const key = status.trim().toLowerCase();
  if (LIFECYCLE_STATUS_LABELS[key]) return LIFECYCLE_STATUS_LABELS[key];
  return status
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

/** Assignment eligibility: operational READY_TO_MOVE + lifecycle active|in_maintenance. */
export function isAssignmentEligibleAsset(row: {
  operational_status?: string | null;
  status?: string | null;
}): boolean {
  const ops = String(row.operational_status ?? "").toUpperCase();
  const life = String(row.status ?? "").toLowerCase();
  return ops === "READY_TO_MOVE" && (life === "active" || life === "in_maintenance");
}

/** Phase 5D: Start Disposal is only valid for operational RETIRED. */
export function canStartDisposalFromOperationalStatus(
  operationalStatus: string | null | undefined,
): boolean {
  return String(operationalStatus ?? "").toUpperCase() === "RETIRED";
}

/** Phase 5E: Reinstate is only valid for operational PENDING_DISPOSAL. */
export function canReinstateFromOperationalStatus(
  operationalStatus: string | null | undefined,
): boolean {
  return String(operationalStatus ?? "").toUpperCase() === "PENDING_DISPOSAL";
}

/** Ops statuses that block assign / transfer / normal maintenance in UI. */
export function isOpsBlockedForNormalOperations(
  operationalStatus: string | null | undefined,
): boolean {
  const ops = String(operationalStatus ?? "").toUpperCase();
  return ops === "RETIRED" || ops === "PENDING_DISPOSAL" || ops === "DISPOSED";
}

/** Phase 5E: Transfer/Maintenance require no employee custody (not ASSIGNED). */
export function isOpsBlockedForTransferOrMaintenance(
  operationalStatus: string | null | undefined,
): boolean {
  const ops = String(operationalStatus ?? "").toUpperCase();
  return isOpsBlockedForNormalOperations(ops) || ops === "ASSIGNED";
}

export function operationalStatusHelpText(
  operationalStatus: string | null | undefined,
): string | null {
  const ops = String(operationalStatus ?? "").toUpperCase();
  if (ops === "RETIRED") {
    return "Retired — not available for assignment.";
  }
  if (ops === "PENDING_DISPOSAL") {
    return "Pending Disposal — disposal workflow in progress.";
  }
  if (ops === "DISPOSED") {
    return "Disposed — asset has completed the disposal workflow.";
  }
  return null;
}
