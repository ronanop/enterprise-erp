"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";

import { ConfirmDialog } from "@/components/finance/journals/confirm-dialog";
import { RowActionsItem, RowActionsMenu } from "@/components/ui/row-actions-menu";
import { useAuthUser } from "@/hooks/use-auth-user";
import { canDeleteCrmRecords } from "@/lib/crm/crm-module-access";
import { ApiClientError } from "@/services/api-client";

type Props = {
  entityLabel: string;
  entityName: string;
  onDelete: () => Promise<void>;
  onDeleted?: () => void;
};

export function CrmAdminDeleteMenu({ entityLabel, entityName, onDelete, onDeleted }: Props) {
  const { user, adminModuleKeys } = useAuthUser();
  const canDelete = canDeleteCrmRecords(adminModuleKeys, user?.userType);
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!canDelete) {
    return null;
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
    <>
      <RowActionsMenu open={menuOpen} onOpenChange={setMenuOpen} align="end">
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
      </RowActionsMenu>

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
    </>
  );
}
