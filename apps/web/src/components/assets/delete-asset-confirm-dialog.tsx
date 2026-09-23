"use client";

import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";

export type DeleteAssetConfirmAsset = {
  id: string;
  assetCode?: string | null;
  assetName?: string | null;
};

export type DeleteAssetConfirmDialogProps = {
  open: boolean;
  asset: DeleteAssetConfirmAsset | null;
  submitting?: boolean;
  error?: string | null;
  onCancel: () => void;
  onConfirm: () => void;
};

export function DeleteAssetConfirmDialog({
  open,
  asset,
  submitting,
  error,
  onCancel,
  onConfirm,
}: DeleteAssetConfirmDialogProps) {
  if (!open || !asset) return null;

  const label = asset.assetCode?.trim() || asset.assetName?.trim() || "this asset";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !submitting) onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-asset-title"
        aria-describedby="delete-asset-desc"
        data-testid="delete-asset-confirm-dialog"
        className="w-full max-w-lg rounded-md border border-border bg-background p-4 shadow-lg"
        onKeyDown={(e) => {
          if (e.key === "Escape" && !submitting) onCancel();
        }}
      >
        <h2 id="delete-asset-title" className="text-base font-semibold text-foreground">
          Delete Asset?
        </h2>
        <div id="delete-asset-desc" className="mt-3 space-y-2 text-sm">
          <p data-testid="delete-asset-confirm-message">
            Are you sure you want to delete asset{" "}
            <span className="font-mono text-xs" data-testid="delete-asset-code">
              {label}
            </span>
            ?
          </p>
          <p className="text-muted-foreground">
            This action cannot be undone. The asset will be deactivated and removed from active
            lists; audit and history records are preserved.
          </p>
          {asset.assetName?.trim() ? (
            <p>
              <span className="text-muted-foreground">Name: </span>
              <span data-testid="delete-asset-name">{asset.assetName}</span>
            </p>
          ) : null}
          {error ? (
            <p className="text-destructive" role="alert" data-testid="delete-asset-error">
              {error}
            </p>
          ) : null}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            className="cursor-pointer"
            disabled={submitting}
            data-testid="delete-asset-cancel-button"
            onClick={onCancel}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            className="cursor-pointer"
            disabled={submitting}
            data-testid="delete-asset-confirm-button"
            onClick={onConfirm}
          >
            {submitting ? <Loader2 className="mr-1 size-4 animate-spin" aria-hidden /> : null}
            Delete Asset
          </Button>
        </div>
      </div>
    </div>
  );
}
