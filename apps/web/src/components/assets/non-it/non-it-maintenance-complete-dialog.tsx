"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiClientError } from "@/services/api-client";
import {
  completeNonItMaintenance,
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

export function NonItMaintenanceCompleteDialog({
  open,
  asset,
  onOpenChange,
  onDone,
}: Props) {
  const [notes, setNotes] = useState("");
  const [completionDate, setCompletionDate] = useState(
    () => new Date().toISOString().slice(0, 10),
  );
  const [restore, setRestore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const canRestore = Boolean(asset.prior_holder_available);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await completeNonItMaintenance(asset.id, {
        completion_notes: notes.trim() || null,
        completion_date: completionDate || null,
        restore_prior_holder: canRestore && restore,
        version: asset.version,
      });
      onDone();
      onOpenChange(false);
    } catch (err) {
      setError(formatApiError(err, "Failed to complete maintenance"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="Complete maintenance"
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
            Complete maintenance — {asset.asset_code}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Return the asset to stock or restore the previous holder.
          </p>
        </div>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="maint-done-date">
              Completion date
            </label>
            <Input
              id="maint-done-date"
              type="date"
              value={completionDate}
              onChange={(e) => setCompletionDate(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="maint-done-notes">
              Notes
            </label>
            <Input id="maint-done-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <fieldset className="space-y-2 rounded-md border border-border p-3">
            <legend className="px-1 text-xs font-medium text-muted-foreground">
              After completion
            </legend>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="radio"
                name="maint-result"
                checked={!restore}
                onChange={() => setRestore(false)}
                className="cursor-pointer"
              />
              Return to stock
            </label>
            <label
              className={`flex items-center gap-2 text-sm ${canRestore ? "cursor-pointer" : "opacity-50"}`}
            >
              <input
                type="radio"
                name="maint-result"
                checked={restore}
                disabled={!canRestore}
                onChange={() => setRestore(true)}
                className="cursor-pointer"
              />
              Reassign to previous holder
              {canRestore && asset.prior_holder_label
                ? ` (${asset.prior_holder_label})`
                : canRestore
                  ? ""
                  : " — none"}
            </label>
          </fieldset>
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
            {busy ? "Saving…" : "Complete"}
          </Button>
        </div>
      </div>
    </div>
  );
}
