"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { ASSETS_ACCENT_BTN } from "@/components/assets/shared/premium-surface";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { ApiClientError, resourceService } from "@/services/api-client";

export type DisposeDialogAsset = {
  id: string;
  assetCode?: string | null;
  assetName?: string | null;
  branchId?: string | null;
};

export type DisposeDialogResult = {
  id: string;
  document_number?: string;
  asset_id: string;
  disposal_date?: string | null;
  remarks?: string | null;
  management_approved?: boolean | null;
};

type Props = {
  open: boolean;
  asset: DisposeDialogAsset | null;
  onCancel: () => void;
  onDisposed: (result: DisposeDialogResult) => void;
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function errMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiClientError) return err.message || fallback;
  if (err instanceof Error) return err.message || fallback;
  return fallback;
}

export function ItAssetDisposeDialog({ open, asset, onCancel, onDisposed }: Props) {
  const [reason, setReason] = useState("");
  const [managementApproved, setManagementApproved] = useState<"" | "yes" | "no">("");
  const [disposalDate, setDisposalDate] = useState(todayIso());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setReason("");
    setManagementApproved("");
    setDisposalDate(todayIso());
    setError(null);
    setBusy(false);
  }, [open, asset?.id]);

  if (!open || !asset) return null;

  async function submit() {
    setError(null);
    if (!reason.trim()) {
      setError("Reason for disposal is required.");
      return;
    }
    if (managementApproved !== "yes" && managementApproved !== "no") {
      setError("Select management approval (Yes or No).");
      return;
    }
    if (!disposalDate.trim()) {
      setError("Disposal date is required.");
      return;
    }
    if (!asset.branchId) {
      setError("Asset is missing branch information.");
      return;
    }
    setBusy(true);
    try {
      const res = await resourceService.create<DisposeDialogResult>("/assets/asset-disposals", {
        branch_id: asset.branchId,
        asset_id: asset.id,
        disposal_type: "scrap",
        remarks: reason.trim(),
        management_approved: managementApproved === "yes",
        disposal_date: disposalDate,
      });
      onDisposed(res.data as DisposeDialogResult);
    } catch (err) {
      setError(errMessage(err, "Failed to dispose asset."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dispose-asset-title"
      data-testid="dispose-asset-dialog"
    >
      <div className="w-full max-w-lg rounded-lg border border-border bg-card p-4 shadow-lg sm:p-5">
        <h2 id="dispose-asset-title" className="text-base font-semibold text-foreground">
          Dispose asset
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {[asset.assetCode, asset.assetName].filter(Boolean).join(" · ") || "Selected asset"}
        </p>

        <div className="mt-4 grid gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="dispose-reason">Reason for Disposal *</Label>
            <textarea
              id="dispose-reason"
              data-testid="dispose-reason"
              className="flex min-h-[88px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={4000}
              placeholder="Why is this asset being disposed?"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="dispose-approval">Management Approval *</Label>
            <Select
              value={managementApproved || undefined}
              onValueChange={(v) => setManagementApproved(v === "yes" || v === "no" ? v : "")}
            >
              <SelectTrigger id="dispose-approval" className="cursor-pointer" data-testid="dispose-approval">
                <SelectValue placeholder="Select Yes or No" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="yes" className="cursor-pointer">
                  Yes / Approved
                </SelectItem>
                <SelectItem value="no" className="cursor-pointer">
                  No / Not Approved
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="dispose-date">Disposal Date *</Label>
            <Input
              id="dispose-date"
              data-testid="dispose-date"
              type="date"
              value={disposalDate}
              onChange={(e) => setDisposalDate(e.target.value)}
              className="cursor-pointer"
            />
            <p className="text-xs text-muted-foreground">
              Defaults to today. Change only when recording a past disposal.
            </p>
          </div>
        </div>

        {error ? (
          <p className="mt-3 text-sm text-destructive" role="alert" data-testid="dispose-error">
            {error}
          </p>
        ) : null}

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            className="cursor-pointer"
            disabled={busy}
            onClick={onCancel}
          >
            Cancel
          </Button>
          <Button
            type="button"
            data-testid="dispose-submit"
            className={cn("cursor-pointer", ASSETS_ACCENT_BTN)}
            disabled={busy}
            onClick={() => void submit()}
          >
            {busy ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : null}
            Submit
          </Button>
        </div>
      </div>
    </div>
  );
}
