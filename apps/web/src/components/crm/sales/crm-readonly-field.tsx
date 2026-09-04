"use client";

import type { ReactNode } from "react";

import { FinanceField } from "@/components/finance/journals/finance-form-field";

export function textOrDash(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  const text = String(value).trim();
  return text || "—";
}

export function ReadOnlyValue({ value }: { value: string }) {
  return (
    <div className="flex min-h-8 w-full items-center rounded-lg border border-input bg-muted/20 px-2.5 text-sm text-foreground">
      {value}
    </div>
  );
}

export function CrmReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <FinanceField label={label}>
      <ReadOnlyValue value={value} />
    </FinanceField>
  );
}

export function CrmReadOnlyTextarea({ label, value }: { label: string; value: string }) {
  return (
    <FinanceField label={label}>
      <div className="flex min-h-[72px] w-full rounded-lg border border-input bg-muted/20 px-2.5 py-2 text-sm whitespace-pre-wrap text-foreground">
        {value}
      </div>
    </FinanceField>
  );
}

export function CrmReadOnlyFieldSpan({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <FinanceField label={label} className={className}>
      {children}
    </FinanceField>
  );
}
