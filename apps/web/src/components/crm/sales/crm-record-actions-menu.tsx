"use client";

import { useState } from "react";
import { Copy, Printer, Share2, Trash2 } from "lucide-react";

import { CrmEntityShareDialog } from "@/components/crm/sales/crm-entity-share-dialog";
import { ConfirmDialog } from "@/components/finance/journals/confirm-dialog";
import { RowActionsItem, RowActionsMenu } from "@/components/ui/row-actions-menu";
import { useAuthUser } from "@/hooks/use-auth-user";
import { canDeleteCrmRecords } from "@/lib/crm/crm-module-access";
import { ApiClientError } from "@/services/api-client";

type Props = {
  entityType: string;
  entityId: string;
  entityLabel: string;
  entityName: string;
  shareTitle: string;
  onClone: () => Promise<void>;
  onPrintPreview: () => Promise<void>;
  onDelete: () => Promise<void>;
  onDeleted?: () => void;
  cloneDisabled?: boolean;
};

export function CrmRecordActionsMenu({
  entityType,
  entityId,
  entityLabel,
  entityName,
  shareTitle,
  onClone,
  onPrintPreview,
  onDelete,
  onDeleted,
  cloneDisabled,
}: Props) {
  const { user, adminModuleKeys } = useAuthUser();
  const canDelete = canDeleteCrmRecords(adminModuleKeys, user?.userType);
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function runClone() {
    setMenuOpen(false);
    setBusy(true);
    setError(null);
    try {
      await onClone();
    } catch (err) {
      const message =
        err instanceof ApiClientError ? err.message : `Failed to clone ${entityLabel.toLowerCase()}`;
      setActionError(message);
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  function onShare() {
    setMenuOpen(false);
    setShareOpen(true);
  }

  async function runPrintPreview() {
    setMenuOpen(false);
    setBusy(true);
    setError(null);
    try {
      await onPrintPreview();
    } catch (err) {
      const message =
        err instanceof ApiClientError ? err.message : `Failed to print ${entityLabel.toLowerCase()}`;
      setActionError(message);
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  async function onDeleteConfirm() {
    setBusy(true);
    setError(null);
    try {
      await onDelete();
      setDeleteOpen(false);
      onDeleted?.();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : `Failed to delete ${entityLabel.toLowerCase()}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <RowActionsMenu open={menuOpen} onOpenChange={setMenuOpen} align="end">
        <RowActionsItem disabled={cloneDisabled || busy} onClick={() => void runClone()}>
          <Copy className="size-3.5 text-muted-foreground" />
          Clone
        </RowActionsItem>
        <RowActionsItem onClick={onShare}>
          <Share2 className="size-3.5 text-muted-foreground" />
          Share
        </RowActionsItem>
        <RowActionsItem disabled={busy} onClick={() => void runPrintPreview()}>
          <Printer className="size-3.5 text-muted-foreground" />
          Print preview
        </RowActionsItem>
        {canDelete ? (
          <RowActionsItem
            destructive
            onClick={() => {
              setMenuOpen(false);
              setDeleteOpen(true);
            }}
          >
            <Trash2 className="size-3.5" />
            Delete
          </RowActionsItem>
        ) : null}
      </RowActionsMenu>

      <CrmEntityShareDialog
        open={shareOpen}
        entityType={entityType}
        entityId={entityId}
        entityTitle={shareTitle}
        onClose={() => setShareOpen(false)}
      />

      <ConfirmDialog
        open={deleteOpen}
        title={`Delete ${entityLabel.toLowerCase()}`}
        description={`Remove ${entityName}? This soft-deletes the record.`}
        tone="destructive"
        confirmLabel="Delete"
        busy={busy}
        onCancel={() => setDeleteOpen(false)}
        onConfirm={() => void onDeleteConfirm()}
      >
        {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
      </ConfirmDialog>

      {actionError ? (
        <p className="max-w-[220px] text-right text-xs text-destructive" role="alert">
          {actionError}
        </p>
      ) : null}
    </div>
  );
}
