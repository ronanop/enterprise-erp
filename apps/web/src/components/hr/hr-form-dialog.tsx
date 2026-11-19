"use client";

import type { ReactNode } from "react";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function HrFormDialog({
  open,
  title,
  description,
  onClose,
  children,
  footer,
  wide,
}: {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="hr-dialog-title"
    >
      <button
        type="button"
        className="absolute inset-0 cursor-pointer"
        aria-label="Close dialog backdrop"
        onClick={onClose}
      />
      <div
        className={cn(
          "relative z-10 flex max-h-[90dvh] w-full flex-col rounded-t-2xl border border-border bg-card shadow-lg sm:rounded-2xl",
          wide ? "sm:max-w-2xl" : "sm:max-w-lg",
        )}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border/70 px-4 py-3">
          <div>
            <h2 id="hr-dialog-title" className="text-sm font-semibold tracking-tight">
              {title}
            </h2>
            {description ? (
              <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
            ) : null}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="cursor-pointer"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="size-4" />
          </Button>
        </div>
        <div className="erp-scroll flex-1 overflow-y-auto px-4 py-4">{children}</div>
        {footer ? (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border/70 px-4 py-3">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function HrField({
  label,
  htmlFor,
  error,
  hint,
  children,
}: {
  label: string;
  htmlFor?: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-1" htmlFor={htmlFor}>
      <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </span>
      {children}
      {hint && !error ? (
        <span className="block text-[10px] text-muted-foreground">{hint}</span>
      ) : null}
      {error ? <span className="block text-[11px] text-destructive">{error}</span> : null}
    </label>
  );
}

export function HrSelect(props: React.ComponentProps<"select">) {
  return (
    <select
      {...props}
      className={cn(
        "flex h-8 w-full cursor-pointer rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none transition-colors",
        "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
        "disabled:cursor-not-allowed disabled:opacity-50",
        props.className,
      )}
    />
  );
}
