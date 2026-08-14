"use client";

import { Loader2 } from "lucide-react";

import {
  formatLifecycleStatusLabel,
  OPERATIONAL_STATUS_LABELS,
  isOperationalStatus,
} from "@/components/assets/shared/asset-status";
import { Button } from "@/components/ui/button";

export type ReinstateConfirmAsset = {
  id: string;
  assetCode?: string | null;
  assetName?: string | null;
  serialNumber?: string | null;
  lifecycleStatus?: string | null;
  operationalStatus?: string | null;
};

export type ReinstateConfirmDialogProps = {
  open: boolean;
  asset: ReinstateConfirmAsset | null;
  submitting?: boolean;
  error?: string | null;
  onCancel: () => void;
  onConfirm: () => void;
};

export function ReinstateConfirmDialog({
  open,
  asset,
  submitting,
  error,
  onCancel,
  onConfirm,
}: ReinstateConfirmDialogProps) {
  if (!open || !asset) return null;

  const opsRaw = String(asset.operationalStatus ?? "");
  const opsLabel = isOperationalStatus(opsRaw)
    ? OPERATIONAL_STATUS_LABELS[opsRaw]
    : opsRaw || "—";
  const lifeLabel = formatLifecycleStatusLabel(String(asset.lifecycleStatus ?? "")) || "—";

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
        aria-labelledby="reinstate-title"
        aria-describedby="reinstate-desc"
        data-testid="reinstate-confirm-dialog"
        className="w-full max-w-lg rounded-md border border-border bg-background p-4 shadow-lg"
        onKeyDown={(e) => {
          if (e.key === "Escape" && !submitting) onCancel();
        }}
      >
        <h2 id="reinstate-title" className="text-base font-semibold text-foreground">
          Reinstate asset?
        </h2>
        <div className="mt-3 space-y-2 text-sm">
          <p>
            <span className="text-muted-foreground">Asset Code: </span>
            <span className="font-mono text-xs">{asset.assetCode || "—"}</span>
          </p>
          <p>
            <span className="text-muted-foreground">Name: </span>
            {asset.assetName || "—"}
          </p>
          <p>
            <span className="text-muted-foreground">Serial Number: </span>
            <span className="font-mono text-xs">{asset.serialNumber || "—"}</span>
          </p>
          <p className="pt-1">
            <span className="text-muted-foreground">Lifecycle: </span>
            {lifeLabel}
            <span className="mx-2 text-muted-foreground">·</span>
            <span className="text-muted-foreground">Operational: </span>
            {opsLabel}
          </p>
          <p id="reinstate-desc" className="pt-2 text-muted-foreground">
            This will return the asset to Ready to Move. It can then be assigned again. Make sure
            the asset has been inspected and is fit for use.
          </p>
          {error ? (
            <p className="text-destructive" role="alert" data-testid="reinstate-error">
              {error}
            </p>
          ) : null}
        </div>
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            className="cursor-pointer transition-colors duration-200"
            disabled={submitting}
            onClick={onCancel}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="cursor-pointer transition-colors duration-200"
            disabled={submitting}
            data-testid="reinstate-confirm-button"
            onClick={onConfirm}
          >
            {submitting ? (
              <>
                <Loader2 className="mr-1 size-4 animate-spin" aria-hidden />
                Reinstating…
              </>
            ) : (
              "Reinstate"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
