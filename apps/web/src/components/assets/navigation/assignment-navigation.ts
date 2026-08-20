/**
 * CR-004 Phase 4 Task 6 — Assignment Navigation (routing SSOT for Assignment module).
 *
 * Navigation only — no UI, no business logic, no fetch.
 * AssetNavigation delegates Issue/Return hrefs here.
 */

import { stashInventoryFocusAsset } from "@/components/assets/inventory/inventory-focus";

export type AssignmentWizardHrefParams = {
  assetId?: string;
  employeeId?: string;
  draftId?: string;
};

export type ReturnWizardHrefParams = {
  assetId?: string;
  assignmentId?: string;
  intent?: string;
};

export const assignmentNavigationPaths = {
  list: "/assets/asset-assignments",
  new: "/assets/asset-assignments/new",
  return: "/assets/asset-assignments/return",
  inventory: "/assets/assets",
} as const;

export type AssetNavigateFn = (href: string) => void;

/** Canonical Issue wizard deep-link builder. */
export function buildAssignmentWizardHref(params: AssignmentWizardHrefParams = {}): string {
  const q = new URLSearchParams();
  if (params.assetId) q.set("assetId", params.assetId);
  if (params.employeeId) q.set("employeeId", params.employeeId);
  if (params.draftId) q.set("draftId", params.draftId);
  const qs = q.toString();
  return `${assignmentNavigationPaths.new}${qs ? `?${qs}` : ""}`;
}

/** Canonical Return wizard deep-link builder. */
export function buildReturnWizardHref(params: ReturnWizardHrefParams = {}): string {
  const q = new URLSearchParams();
  if (params.assetId) q.set("assetId", params.assetId);
  if (params.assignmentId) q.set("assignmentId", params.assignmentId);
  q.set("intent", params.intent ?? "return");
  return `${assignmentNavigationPaths.return}?${q.toString()}`;
}

/** @deprecated Prefer buildAssignmentWizardHref — kept for call-site compatibility. */
export const buildIssueWizardHref = buildAssignmentWizardHref;

export type AssignmentNavigation = {
  openAssignmentList: () => void;
  openNewAssignment: () => void;
  openDraft: (draftId: string) => void;
  openIssue: (assetId: string, extra?: Omit<AssignmentWizardHrefParams, "assetId">) => void;
  openReturn: (assetId: string) => void;
  openReturnByAssignment: (assignmentId: string) => void;
  openInventory: (assetId?: string) => void;
  buildAssignmentWizardHref: typeof buildAssignmentWizardHref;
  buildReturnWizardHref: typeof buildReturnWizardHref;
};

export {
  consumeInventoryFocusAsset,
  stashInventoryFocusAsset,
} from "@/components/assets/inventory/inventory-focus";

export function createAssignmentNavigation(push: AssetNavigateFn): AssignmentNavigation {
  return {
    openAssignmentList: () => push(assignmentNavigationPaths.list),
    openNewAssignment: () => push(buildAssignmentWizardHref({})),
    openDraft: (draftId) => push(buildAssignmentWizardHref({ draftId })),
    openIssue: (assetId, extra) =>
      push(buildAssignmentWizardHref({ assetId, ...extra })),
    openReturn: (assetId) => push(buildReturnWizardHref({ assetId, intent: "return" })),
    openReturnByAssignment: (assignmentId) =>
      push(buildReturnWizardHref({ assignmentId, intent: "return" })),
    openInventory: (assetId) => {
      stashInventoryFocusAsset(assetId);
      push(assignmentNavigationPaths.inventory);
    },
    buildAssignmentWizardHref,
    buildReturnWizardHref,
  };
}

/** Supported deep-link catalog for validation / docs / tests. */
export const ASSIGNMENT_DEEP_LINKS = {
  newBlank: () => buildAssignmentWizardHref({}),
  newAsset: (assetId: string) => buildAssignmentWizardHref({ assetId }),
  newEmployee: (employeeId: string) => buildAssignmentWizardHref({ employeeId }),
  newDraft: (draftId: string) => buildAssignmentWizardHref({ draftId }),
  returnAsset: (assetId: string) => buildReturnWizardHref({ assetId, intent: "return" }),
  returnAssignment: (assignmentId: string) =>
    buildReturnWizardHref({ assignmentId, intent: "return" }),
  returnAssetIntent: (assetId: string) =>
    buildReturnWizardHref({ assetId, intent: "return" }),
} as const;
