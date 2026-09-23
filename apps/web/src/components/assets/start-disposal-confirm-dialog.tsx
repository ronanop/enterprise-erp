"use client";

import { Loader2 } from "lucide-react";

import {
  formatLifecycleStatusLabel,
  OPERATIONAL_STATUS_LABELS,
  isOperationalStatus,
} from "@/components/assets/shared/asset-status";
import { Button } from "@/components/ui/button";

export type StartDisposalConfirmAsset = {
  id: string;
  assetCode?: string | null;
  assetName?: string | null;
  serialNumber?: string | null;
  lifecycleStatus?: string | null;
  operationalStatus?: string | null;
};

export type StartDisposalConfirmDialogProps = {
  open: boolean;
  asset: StartDisposalConfirmAsset | null;
  submitting?: boolean;
  error?: string | null;
  onCancel: () => void;
  onConfirm: () => void;
};

export function StartDisposalConfirmDialog({
  open,
  asset,
  submitting,
  error,
  onCancel,
  onConfirm,
}: StartDisposalConfirmDialogProps) {
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
        aria-labelledby="start-disposal-title"
        aria-describedby="start-disposal-desc"
        data-testid="start-disposal-confirm-dialog"
        className="w-full max-w-lg rounded-md border border-border bg-background p-4 shadow-lg"
        onKeyDown={(e) => {
          if (e.key === "Escape" && !submitting) onCancel();
        }}
      >
        <h2 id="start-disposal-title" className="text-base font-semibold text-foreground">
          Start Disposal
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
          <p id="start-disposal-desc" className="pt-2 text-muted-foreground">
            This asset is retired and is no longer available for operational use. Starting
            disposal will move it to Pending Disposal and make it available for the governed
            disposal workflow.
          </p>
          {error ? (
            <p className="text-destructive" role="alert" data-testid="start-disposal-error">
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
            data-testid="start-disposal-confirm-button"
            onClick={onConfirm}
          >
            {submitting ? (
              <>
                <Loader2 className="mr-1 size-4 animate-spin" aria-hidden />
                Starting…
              </>
            ) : (
              "Start Disposal"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
