"use client";

import { useState } from "react";

import {
  NonItAssignmentPicker,
  type AssignmentTarget,
} from "@/components/assets/non-it/non-it-assignment-picker";
import { Button } from "@/components/ui/button";
import { ApiClientError } from "@/services/api-client";
import {
  assignNonItAsset,
  type NonItAsset,
  type NonItAssignmentMode,
} from "@/services/nonit-asset-service";

type Props = {
  open: boolean;
  asset: NonItAsset;
  onOpenChange: (open: boolean) => void;
  onDone: (asset?: NonItAsset) => void;
};

function formatApiError(err: unknown, fallback: string): string {
  if (err instanceof ApiClientError) return err.message || fallback;
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

export function NonItAssignDialog({ open, asset, onOpenChange, onDone }: Props) {
  const [target, setTarget] = useState<AssignmentTarget>({
    employee_id: null,
    location_id: null,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const isReassign = asset.status === "ASSIGNED";
  const mode = (asset.assignment_mode || "EMPLOYEE") as NonItAssignmentMode;

  async function submit() {
    if (!target.employee_id && !target.location_id) {
      setError("Select an employee or location");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const updated = await assignNonItAsset(asset.id, {
        employee_id: target.employee_id,
        location_id: target.location_id,
        version: asset.version,
      });
      onDone(updated);
      onOpenChange(false);
    } catch (err) {
      setError(formatApiError(err, "Assign failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={isReassign ? "Reassign asset" : "Assign asset"}
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
            {isReassign ? "Reassign" : "Assign"} {asset.asset_code}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {asset.asset_type_name ?? "Non-IT asset"} — choose the new holder.
          </p>
        </div>

        <NonItAssignmentPicker
          assignmentMode={mode}
          value={target}
          onChange={setTarget}
          disabled={busy}
        />

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
            {busy ? "Saving…" : isReassign ? "Reassign" : "Assign"}
          </Button>
        </div>
      </div>
    </div>
  );
}
