/**
 * Assignment CRUD presentation rules (frontend only).
 * Soft-delete = existing cancel workflow. No hard DELETE.
 */

export type AssignmentCrudStatus =
  | "draft"
  | "submitted"
  | "approved"
  | "active"
  | "returned"
  | "cancelled"
  | "rejected"
  | string;

export type AssignmentCrudCapabilities = {
  canView: boolean;
  canEdit: boolean;
  canReturn: boolean;
  canDelete: boolean;
  canChangeAsset: boolean;
};

export function getAssignmentCrudCapabilities(
  status: AssignmentCrudStatus | null | undefined,
): AssignmentCrudCapabilities {
  const s = (status ?? "").toLowerCase();
  const isDraft = s === "draft";
  const isActive = s === "active";
  return {
    canView: Boolean(status),
    canEdit: isDraft,
    canReturn: isActive,
    canDelete: isDraft,
    /** Asset may change only while draft; locked after activation. */
    canChangeAsset: isDraft,
  };
}

export function assertCanDeleteAssignment(status: AssignmentCrudStatus): void {
  if (!getAssignmentCrudCapabilities(status).canDelete) {
    throw new Error("Only draft assignments can be deleted (cancelled). Active assignments cannot be deleted.");
  }
}
