/** CR-004 shared operational status tokens (UI only). */

export const OPERATIONAL_STATUS_VALUES = [
  "READY_TO_MOVE",
  "ASSIGNED",
  "IN_MAINTENANCE",
  "RETIRED",
  "PENDING_DISPOSAL",
  "DISPOSED",
  "IN_USE_AS_COMPONENT",
] as const;

export type OperationalStatusValue = (typeof OPERATIONAL_STATUS_VALUES)[number];

export const OPERATIONAL_STATUS_LABELS: Record<OperationalStatusValue, string> = {
  READY_TO_MOVE: "Ready to Move",
  ASSIGNED: "Assigned",
  IN_MAINTENANCE: "In Maintenance",
  RETIRED: "Retired",
  PENDING_DISPOSAL: "Pending Disposal",
  DISPOSED: "Disposed",
  IN_USE_AS_COMPONENT: "In Use as Component",
};

export const NON_IT_ASSET_STATUS_VALUES = [
  "IN_STOCK",
  "ASSIGNED",
  "MAINTENANCE",
  "DISPOSED",
] as const;

export type NonItAssetStatusValue = (typeof NON_IT_ASSET_STATUS_VALUES)[number];

export const NON_IT_ASSET_STATUS_LABELS: Record<NonItAssetStatusValue, string> = {
  IN_STOCK: "In Stock",
  ASSIGNED: "Assigned",
  MAINTENANCE: "In Maintenance",
  DISPOSED: "Disposed",
};

export function isNonItAssetStatus(value: string): value is NonItAssetStatusValue {
  return (NON_IT_ASSET_STATUS_VALUES as readonly string[]).includes(value);
}

/**
 * Distinct badge/pill colors for operational + lifecycle states.
 * Reuse everywhere in Asset Management — do not invent per-screen palettes.
 */
export const statusColorMap = {
  operational: {
    READY_TO_MOVE:
      "border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-800 dark:bg-sky-950/50 dark:text-sky-200",
    ASSIGNED:
      "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200",
    IN_MAINTENANCE:
      "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200",
    RETIRED:
      "border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200",
    PENDING_DISPOSAL:
      "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200",
    DISPOSED:
      "border-zinc-400 bg-zinc-200 text-zinc-800 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200",
    IN_USE_AS_COMPONENT:
      "border-indigo-200 bg-indigo-50 text-indigo-950 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-200",
  } satisfies Record<OperationalStatusValue, string>,
  lifecycle: {
    active:
      "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200",
    draft:
      "border-slate-200 bg-slate-100 text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200",
    submitted:
      "border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-800 dark:bg-sky-950/50 dark:text-sky-200",
    approved:
      "border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-800 dark:bg-sky-950/50 dark:text-sky-200",
    in_maintenance:
      "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200",
    transferred:
      "border-slate-200 bg-slate-50 text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200",
    disposed:
      "border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200",
    written_off:
      "border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200",
    cancelled:
      "border-zinc-300 bg-zinc-100 text-zinc-700 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
  } satisfies Record<string, string>,
  dcChallan: {
    PENDING:
      "border-slate-200 bg-slate-100 text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200",
    SENT_TO_SCM:
      "border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-800 dark:bg-sky-950/50 dark:text-sky-200",
    DOCUMENT_RECEIVED:
      "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200",
    SIGNED:
      "border-teal-200 bg-teal-50 text-teal-900 dark:border-teal-800 dark:bg-teal-950/40 dark:text-teal-200",
    RECEIVED:
      "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200",
    CANCELLED:
      "border-zinc-300 bg-zinc-100 text-zinc-700 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
  } satisfies Record<string, string>,
  /** Non-IT register status (IN_STOCK | ASSIGNED | MAINTENANCE | DISPOSED). */
  nonIt: {
    IN_STOCK:
      "border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-800 dark:bg-sky-950/50 dark:text-sky-200",
    ASSIGNED:
      "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200",
    MAINTENANCE:
      "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200",
    DISPOSED:
      "border-zinc-400 bg-zinc-200 text-zinc-800 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200",
  } satisfies Record<NonItAssetStatusValue, string>,
} as const;

export const DC_CHALLAN_STATUS_VALUES = [
  "PENDING",
  "SENT_TO_SCM",
  "DOCUMENT_RECEIVED",
  "SIGNED",
  "RECEIVED",
  "CANCELLED",
] as const;

export type DcChallanStatusValue = (typeof DC_CHALLAN_STATUS_VALUES)[number];

export const DC_CHALLAN_STATUS_LABELS: Record<DcChallanStatusValue, string> = {
  PENDING: "Pending",
  SENT_TO_SCM: "Sent to SCM",
  DOCUMENT_RECEIVED: "Document received",
  SIGNED: "Signed",
  RECEIVED: "Received",
  CANCELLED: "Cancelled",
};

export function isDcChallanStatus(value: string): value is DcChallanStatusValue {
  return (DC_CHALLAN_STATUS_VALUES as readonly string[]).includes(value);
}

export const OPERATIONAL_STATUS_BADGE_CLASS = statusColorMap.operational;
export const LIFECYCLE_STATUS_BADGE_CLASS = statusColorMap.lifecycle;
export const DC_CHALLAN_STATUS_BADGE_CLASS = statusColorMap.dcChallan;
export const NON_IT_ASSET_STATUS_BADGE_CLASS = statusColorMap.nonIt;

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

/** Assignment eligibility: operational READY_TO_MOVE + lifecycle active only. */
export function isAssignmentEligibleAsset(row: {
  operational_status?: string | null;
  status?: string | null;
}): boolean {
  const ops = String(row.operational_status ?? "").toUpperCase();
  const life = String(row.status ?? "").toLowerCase();
  return ops === "READY_TO_MOVE" && life === "active";
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
  return (
    ops === "RETIRED" ||
    ops === "PENDING_DISPOSAL" ||
    ops === "DISPOSED" ||
    ops === "IN_USE_AS_COMPONENT"
  );
}

/** Phase 5E: Transfer/Maintenance require no employee custody (not ASSIGNED). */
export function isOpsBlockedForTransferOrMaintenance(
  operationalStatus: string | null | undefined,
): boolean {
  const ops = String(operationalStatus ?? "").toUpperCase();
  return isOpsBlockedForNormalOperations(ops) || ops === "ASSIGNED" || ops === "IN_MAINTENANCE";
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
  if (ops === "IN_USE_AS_COMPONENT") {
    return "In use as a component — not available for assignment or transfer.";
  }
  if (ops === "IN_MAINTENANCE") {
    return "In maintenance — not available for assignment or transfer.";
  }
  return null;
}
