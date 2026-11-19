"use client";

import { Button } from "@/components/ui/button";

export function SetupConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  destructive,
  loading,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" role="alertdialog">
      <button
        type="button"
        className="absolute inset-0 cursor-pointer bg-slate-950/40"
        aria-label="Cancel"
        onClick={onCancel}
      />
      <div className="relative z-10 w-full max-w-sm rounded-2xl border border-border bg-card p-4 shadow-lg">
        <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
        <p className="mt-2 text-xs text-muted-foreground">{message}</p>
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="outline" size="sm" className="cursor-pointer" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            variant={destructive ? "destructive" : "default"}
            className="cursor-pointer"
            disabled={loading}
            onClick={onConfirm}
          >
            {loading ? "Working…" : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
