"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiClientError } from "@/services/api-client";
import { disposeNonItAsset, type NonItAsset } from "@/services/nonit-asset-service";

type Props = {
  open: boolean;
  asset: NonItAsset;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
};

function formatApiError(err: unknown, fallback: string): string {
  if (err instanceof ApiClientError) return err.message || fallback;
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

export function NonItDisposeDialog({ open, asset, onOpenChange, onDone }: Props) {
  const [reason, setReason] = useState("");
  const [disposalDate, setDisposalDate] = useState(
    () => new Date().toISOString().slice(0, 10),
  );
  const [remarks, setRemarks] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  async function submit() {
    if (!reason.trim()) {
      setError("Disposal reason is required");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await disposeNonItAsset(asset.id, {
        disposal_reason: reason.trim(),
        disposal_date: disposalDate || null,
        remarks: remarks.trim() || null,
        version: asset.version,
      });
      onDone();
      onOpenChange(false);
    } catch (err) {
      setError(formatApiError(err, "Failed to dispose asset"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="Dispose asset"
      onClick={() => {
        if (!busy) onOpenChange(false);
      }}
    >
      <div
        className="w-full max-w-md space-y-4 rounded-xl border border-border bg-background p-4 shadow-lg sm:p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <h2 className="text-base font-semibold tracking-tight">Dispose {asset.asset_code}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            This is permanent. The asset stays in inventory as read-only; its code is never reused.
          </p>
        </div>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="dispose-reason">
              Reason
            </label>
            <Input
              id="dispose-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="dispose-date">
              Disposal date
            </label>
            <Input
              id="dispose-date"
              type="date"
              value={disposalDate}
              onChange={(e) => setDisposalDate(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="dispose-remarks">
              Remarks
            </label>
            <Input
              id="dispose-remarks"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
            />
          </div>
        </div>
        {error ? (
          <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <div className="flex justify-end gap-2 border-t border-border/60 pt-4">
          <Button
            type="button"
            variant="ghost"
            className="cursor-pointer transition-colors duration-200"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            className="cursor-pointer transition-colors duration-200"
            disabled={busy}
            onClick={() => void submit()}
          >
            {busy ? "Disposing…" : "Dispose"}
          </Button>
        </div>
      </div>
    </div>
  );
}
