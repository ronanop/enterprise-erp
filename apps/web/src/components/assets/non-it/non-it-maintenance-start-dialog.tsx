"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiClientError } from "@/services/api-client";
import {
  startNonItMaintenance,
  type NonItAsset,
} from "@/services/nonit-asset-service";

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

export function NonItMaintenanceStartDialog({
  open,
  asset,
  onOpenChange,
  onDone,
}: Props) {
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [provider, setProvider] = useState("");
  const [cost, setCost] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  async function submit() {
    if (!reason.trim()) {
      setError("Reason is required");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const costNum = cost.trim() ? Number(cost) : null;
      await startNonItMaintenance(asset.id, {
        maintenance_reason: reason.trim(),
        maintenance_notes: notes.trim() || null,
        maintenance_provider: provider.trim() || null,
        maintenance_cost: costNum != null && Number.isFinite(costNum) ? costNum : null,
        version: asset.version,
      });
      onDone();
      onOpenChange(false);
    } catch (err) {
      setError(formatApiError(err, "Failed to start maintenance"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="Send to maintenance"
      onClick={() => {
        if (!busy) onOpenChange(false);
      }}
    >
      <div
        className="w-full max-w-md space-y-4 rounded-xl border border-border bg-background p-4 shadow-lg sm:p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <h2 className="text-base font-semibold tracking-tight">
            Send {asset.asset_code} to maintenance
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Clears the current holder until maintenance is completed.
          </p>
        </div>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="maint-reason">
              Reason
            </label>
            <Input
              id="maint-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="maint-notes">
              Notes
            </label>
            <Input id="maint-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="maint-provider">
                Provider
              </label>
              <Input
                id="maint-provider"
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="maint-cost">
                Cost
              </label>
              <Input
                id="maint-cost"
                type="number"
                step="0.01"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
              />
            </div>
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
            className="cursor-pointer transition-colors duration-200"
            disabled={busy}
            onClick={() => void submit()}
          >
            {busy ? "Saving…" : "Start maintenance"}
          </Button>
        </div>
      </div>
    </div>
  );
}
