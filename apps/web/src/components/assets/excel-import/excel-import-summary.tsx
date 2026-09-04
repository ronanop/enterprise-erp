"use client";

import type { ExcelImportValidationSummary } from "@/components/assets/excel-import/excel-import.types";
import { cn } from "@/lib/utils";

export type ExcelImportValidationSummaryProps = {
  summary: ExcelImportValidationSummary;
  className?: string;
};

export function ExcelImportValidationSummaryPanel({
  summary,
  className,
}: ExcelImportValidationSummaryProps) {
  return (
    <div
      className={cn("grid gap-3 sm:grid-cols-4", className)}
      data-testid="excel-import-validation-summary"
    >
      <SummaryCard label="Total rows" value={summary.totalRows} />
      <SummaryCard label="Valid" value={summary.validCount} tone="valid" />
      <SummaryCard label="Warnings" value={summary.warningCount} tone="warning" />
      <SummaryCard label="Invalid" value={summary.invalidCount} tone="invalid" />
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "valid" | "warning" | "invalid";
}) {
  return (
    <div
      className={cn(
        "rounded-md border border-border/70 bg-card px-3 py-2",
        tone === "valid" && "border-emerald-200 bg-emerald-50/50",
        tone === "warning" && "border-amber-200 bg-amber-50/50",
        tone === "invalid" && "border-destructive/30 bg-destructive/5",
      )}
    >
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-lg font-semibold tracking-tight tabular-nums">{value}</p>
    </div>
  );
}
