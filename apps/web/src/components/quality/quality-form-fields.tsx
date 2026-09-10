"use client";

import { useRef } from "react";
import { Loader2 } from "lucide-react";

import { Input } from "@/components/ui/input";
import type { QmOption } from "@/services/quality-service";

export function QmSelectField({
  label,
  value,
  onChange,
  options,
  required,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: QmOption[];
  required?: boolean;
  disabled?: boolean;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium text-muted-foreground">
        {label}
        {required ? " *" : ""}
      </span>
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="flex h-9 w-full cursor-pointer rounded-md border border-input bg-background px-3 text-sm shadow-none"
      >
        <option value="">Select…</option>
        {options.map((opt) => (
          <option key={opt.id} value={opt.id}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function QmTextField({
  label,
  value,
  onChange,
  type = "text",
  required,
  placeholder,
  min,
  error,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
  min?: number;
  error?: string;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium text-muted-foreground">
        {label}
        {required ? " *" : ""}
      </span>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      <Input
        type={type}
        value={value}
        placeholder={placeholder}
        min={min}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        className={`shadow-none ${error ? "border-destructive focus-visible:ring-destructive/30" : ""}`}
      />
    </label>
  );
}

export function QmTextAreaField({
  label,
  value,
  onChange,
  rows = 3,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <textarea
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-none"
      />
    </label>
  );
}

export function QmFormShell({
  title,
  description,
  backHref,
  backLabel,
  children,
  onSubmit,
  saving,
  statusMessage,
  error,
  submitLabel = "Create",
}: {
  title: string;
  description: string;
  backHref: string;
  backLabel: string;
  children: React.ReactNode;
  onSubmit: () => void | Promise<void>;
  saving: boolean;
  statusMessage?: string | null;
  error: string | null;
  submitLabel?: string;
}) {
  const submitLock = useRef(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitLock.current || saving) return;
    submitLock.current = true;
    try {
      await onSubmit();
    } finally {
      submitLock.current = false;
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        <a
          href={backHref}
          aria-disabled={saving}
          className={`inline-flex h-8 items-center rounded-lg border border-border px-3 text-sm hover:bg-muted ${
            saving ? "pointer-events-none opacity-50" : ""
          }`}
        >
          {backLabel}
        </a>
      </div>

      {statusMessage ? (
        <div className="flex items-center gap-2 rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-primary">
          <Loader2 className="size-4 shrink-0 animate-spin" />
          {statusMessage}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <form
        className="relative space-y-6 rounded-xl border border-border bg-card p-5 shadow-sm"
        onSubmit={(e) => void handleSubmit(e)}
      >
        {saving ? (
          <div
            className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-background/70 backdrop-blur-[1px]"
            aria-live="polite"
            aria-busy="true"
          >
            <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm shadow-sm">
              <Loader2 className="size-4 animate-spin text-primary" />
              {statusMessage ?? "Saving…"}
            </div>
          </div>
        ) : null}
        {children}
        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <a
            href={backHref}
            aria-disabled={saving}
            className={`inline-flex h-9 items-center rounded-lg border border-border px-4 text-sm hover:bg-muted ${
              saving ? "pointer-events-none opacity-50" : ""
            }`}
          >
            Cancel
          </a>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex h-9 min-w-[7rem] items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            {saving ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Saving…
              </>
            ) : (
              submitLabel
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
