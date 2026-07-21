"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function FinanceField({
  label,
  htmlFor,
  error,
  hint,
  className,
  children,
}: {
  label: string;
  htmlFor?: string;
  error?: string;
  hint?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={cn("block space-y-1", className)} htmlFor={htmlFor}>
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

export function FinanceSelect({
  className,
  children,
  ...props
}: React.ComponentProps<"select">) {
  return (
    <select
      className={cn(
        "flex h-8 w-full cursor-pointer rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none transition-colors",
        "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}

export function FinanceTextarea({
  className,
  ...props
}: React.ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(
        "flex min-h-[72px] w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none transition-colors",
        "placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
        "disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}
