/**
 * CR-006 Task 5 — Status-driven UI action matrix (frontend only).
 * Gates register/drawer CTAs by Operational Status. Backend remains second-line validation.
 */

import type { OperationalStatusValue } from "@/components/assets/shared/asset-status";
import { isOperationalStatus } from "@/components/assets/shared/asset-status";

/** Business actions governed by operational status. */
export type StatusDrivenActionId =
  | "view"
  | "edit"
  | "assign"
  | "return"
  | "delete"
  | "history"
  | "dispose";

export type StatusActionCapability = {
  view: boolean;
  edit: boolean;
  assign: boolean;
  return: boolean;
  delete: boolean;
  history: boolean;
  dispose: boolean;
};

const ALL_DENIED: StatusActionCapability = {
  view: false,
  edit: false,
  assign: false,
  return: false,
  delete: false,
  history: false,
  dispose: false,
};

export const STATUS_ACTION_MATRIX: Record<OperationalStatusValue, StatusActionCapability> = {
  READY_TO_MOVE: {
    view: true,
    edit: true,
    assign: true,
    return: false,
    delete: true,
    history: true,
    dispose: false,
  },
  ASSIGNED: {
    view: true,
    edit: false,
    assign: false,
    return: true,
    delete: false,
    history: true,
    dispose: false,
  },
  RETIRED: {
    view: true,
    edit: false,
    assign: false,
    return: false,
    delete: false,
    history: true,
    dispose: false,
  },
  PENDING_DISPOSAL: {
    view: true,
    edit: false,
    assign: false,
    return: false,
    delete: false,
    history: true,
    dispose: true,
  },
  DISPOSED: {
    view: true,
    edit: false,
    assign: false,
    return: false,
    delete: false,
    history: true,
    dispose: false,
  },
};

export function normalizeOperationalStatus(
  status?: string | null,
): OperationalStatusValue | null {
  if (!status?.trim()) return null;
  const upper = status.trim().toUpperCase();
  return isOperationalStatus(upper) ? upper : null;
}

export function getStatusActionCapability(
  operationalStatus?: string | null,
): StatusActionCapability {
  const status = normalizeOperationalStatus(operationalStatus);
  if (!status) {
    // Unknown status: allow view only — never expose mutating workflows.
    return { ...ALL_DENIED, view: true, history: true };
  }
  return STATUS_ACTION_MATRIX[status];
}

export function isStatusActionAllowed(
  operationalStatus: string | null | undefined,
  action: StatusDrivenActionId,
): boolean {
  return Boolean(getStatusActionCapability(operationalStatus)[action]);
}

/** Drawer primary CTA for the given status (null → empty-state message). */
export function resolveDrawerPrimaryAction(
  operationalStatus?: string | null,
): { action: StatusDrivenActionId; label: string } | null {
  const status = normalizeOperationalStatus(operationalStatus);
  switch (status) {
    case "READY_TO_MOVE":
      return { action: "assign", label: "Allocate Asset" };
    case "ASSIGNED":
      return { action: "return", label: "Return Asset" };
    case "PENDING_DISPOSAL":
      return { action: "dispose", label: "Complete Disposal" };
    case "RETIRED":
    case "DISPOSED":
      return { action: "history", label: "View History" };
    default:
      return null;
  }
}

export function statusActionEmptyMessage(operationalStatus?: string | null): string {
  const status = normalizeOperationalStatus(operationalStatus);
  if (!status) return "No actions available for this asset status.";
  return `No additional actions available while status is ${status.replaceAll("_", " ")}.`;
}
