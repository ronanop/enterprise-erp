"use client";

import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "default" | "destructive";
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  children?: ReactNode;
};

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "default",
  busy,
  onConfirm,
  onCancel,
  children,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4"
      role="presentation"
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        className="w-full max-w-md rounded-xl border border-border/80 bg-card p-4 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="confirm-dialog-title" className="text-sm font-medium tracking-tight">
          {title}
        </h2>
        {description ? (
          <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{description}</p>
        ) : null}
        {children}
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={tone === "destructive" ? "destructive" : "default"}
            onClick={onConfirm}
            disabled={busy}
            className={cn("cursor-pointer")}
          >
            {busy ? "Working…" : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
