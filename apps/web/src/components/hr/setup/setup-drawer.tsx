"use client";

import type { ReactNode } from "react";
import { Clock3, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Right-side enterprise drawer for Create / Edit / View / History */
export function SetupDrawer({
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
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true">
      <button
        type="button"
        className="absolute inset-0 cursor-pointer bg-slate-950/40 transition-opacity duration-200"
        aria-label="Close drawer"
        onClick={onClose}
      />
      <div
        className={cn(
          "relative z-10 flex h-full w-full flex-col border-l border-border bg-card shadow-xl animate-in slide-in-from-right duration-200",
          wide ? "max-w-2xl" : "max-w-md",
        )}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border/70 px-4 py-3">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold tracking-tight">{title}</h2>
            {description ? (
              <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
            ) : null}
          </div>
          <Button type="button" variant="ghost" size="icon-sm" className="cursor-pointer" onClick={onClose}>
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

export function SetupField({
  label,
  required,
  hint,
  children,
  labelClassName,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: ReactNode;
  /** Override default all-caps label styling (e.g. `normal-case` for Title Case). */
  labelClassName?: string;
}) {
  return (
    <div className="block space-y-1">
      <span
        className={cn(
          "text-[11px] font-medium tracking-wide text-muted-foreground uppercase",
          labelClassName,
        )}
      >
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </span>
      {children}
      {hint ? <span className="block text-[10px] text-muted-foreground">{hint}</span> : null}
    </div>
  );
}

export function SetupInput(props: React.ComponentProps<"input">) {
  return (
    <input
      {...props}
      className={cn(
        "flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none transition-colors",
        "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
        "disabled:cursor-not-allowed disabled:opacity-50",
        props.className,
      )}
    />
  );
}

/** Normalize API time (HH:MM:SS / HH:MM) to HTML time input value (HH:MM). */
export function toTimeInputValue(value: string | null | undefined): string {
  if (!value) return "";
  const m = String(value).trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?/);
  if (!m) return "";
  return `${m[1].padStart(2, "0")}:${m[2]}`;
}

/** Convert HTML time (HH:MM) to API format HH:MM:SS. */
export function toApiTimeValue(value: string | null | undefined): string {
  if (!value) return "";
  const v = toTimeInputValue(value);
  return v ? `${v}:00` : "";
}

/** Time picker with clock icon — 24h HH:MM picker. */
export function SetupTimeInput({
  value,
  onChange,
  disabled,
  id,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  id?: string;
}) {
  return (
    <div className="relative">
      <Clock3 className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
      <input
        id={id}
        type="time"
        step={60}
        value={toTimeInputValue(value)}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "flex h-8 w-full cursor-pointer rounded-lg border border-input bg-transparent py-1 pr-2.5 pl-8 text-sm outline-none transition-colors",
          "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "[color-scheme:light]",
        )}
      />
    </div>
  );
}

export function SetupSelect(props: React.ComponentProps<"select">) {
  return (
    <select
      {...props}
      className={cn(
        "flex h-8 w-full cursor-pointer rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none",
        "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
        props.className,
      )}
    />
  );
}

export function SetupTextarea(props: React.ComponentProps<"textarea">) {
  return (
    <textarea
      {...props}
      className={cn(
        "block min-h-[72px] w-full resize-y rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none",
        "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
        props.className,
      )}
    />
  );
}
