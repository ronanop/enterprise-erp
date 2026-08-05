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
  /** Extra classes for the dialog panel (e.g. wider forms: max-w-2xl). */
  contentClassName?: string;
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
  contentClassName,
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
        className={cn(
          "flex w-full max-w-md max-h-[min(90vh,720px)] flex-col rounded-xl border border-border/80 bg-card p-5 shadow-lg",
          contentClassName,
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="confirm-dialog-title" className="shrink-0 text-sm font-medium tracking-tight">
          {title}
        </h2>
        {description ? (
          <p className="mt-1.5 shrink-0 text-xs leading-relaxed text-muted-foreground">
            {description}
          </p>
        ) : null}
        {children ? (
          <div className="min-h-0 flex-1 overflow-y-auto pr-0.5">{children}</div>
        ) : null}
        <div className="mt-4 flex shrink-0 justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={busy}
            className="cursor-pointer transition-colors duration-200"
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={tone === "destructive" ? "destructive" : "default"}
            onClick={onConfirm}
            disabled={busy}
            className="cursor-pointer transition-colors duration-200"
          >
            {busy ? "Working…" : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
