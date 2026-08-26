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
  confirmDisabled?: boolean;
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
  confirmDisabled,
  contentClassName,
  onConfirm,
  onCancel,
  children,
}: ConfirmDialogProps) {
  if (!open) return null;

  const compact = !description && !children;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[2px] motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-200"
      role="presentation"
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        className={cn(
          "w-full max-h-[min(90vh,720px)] overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-xl shadow-slate-900/15",
          "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-95 motion-safe:duration-200",
          compact
            ? "max-w-lg min-h-[5.75rem] p-6 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between"
            : "max-w-md flex flex-col",
          contentClassName,
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {compact ? (
          <h2
            id="confirm-dialog-title"
            className="shrink-0 text-sm font-medium leading-snug tracking-tight text-foreground"
          >
            {title}
          </h2>
        ) : (
          <div className="shrink-0 border-b border-slate-100 px-6 pt-5 pb-4">
            <h2
              id="confirm-dialog-title"
              className="text-[17px] font-semibold tracking-tight text-slate-900"
            >
              {title}
            </h2>
            {description ? (
              <p className="mt-1.5 text-[13px] leading-relaxed text-slate-500">{description}</p>
            ) : null}
          </div>
        )}

        {!compact && children ? (
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
        ) : null}

        {compact && children ? (
          <div className="min-h-0 flex-1 overflow-y-auto pr-0.5">{children}</div>
        ) : null}

        <div
          className={cn(
            "flex shrink-0 gap-2",
            compact
              ? "justify-end sm:justify-end"
              : "justify-end border-t border-slate-100 bg-slate-50/60 px-6 py-4",
          )}
        >
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={busy}
            className="h-9 cursor-pointer border-slate-200 bg-white px-4 transition-colors duration-200 hover:bg-slate-50"
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={tone === "destructive" ? "destructive" : "default"}
            onClick={onConfirm}
            disabled={busy || confirmDisabled}
            className="h-9 cursor-pointer px-4 transition-colors duration-200"
          >
            {busy ? "Working…" : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
