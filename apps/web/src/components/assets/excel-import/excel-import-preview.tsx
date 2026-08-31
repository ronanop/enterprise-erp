"use client";

import type {
  ExcelImportPreviewRow,
  ExcelImportRowStatus,
} from "@/components/assets/excel-import/excel-import.types";
import { EmptyState } from "@/components/assets/shared";
import { cn } from "@/lib/utils";

export type ExcelImportPreviewGridProps = {
  rows: ExcelImportPreviewRow[];
  filter?: ExcelImportRowStatus | "all";
  className?: string;
};

const STATUS_STYLES: Record<ExcelImportRowStatus, string> = {
  valid: "bg-emerald-50 text-emerald-800 border-emerald-200",
  warning: "bg-amber-50 text-amber-900 border-amber-200",
  invalid: "bg-destructive/10 text-destructive border-destructive/30",
};

export function ExcelImportPreviewGrid({
  rows,
  filter = "all",
  className,
}: ExcelImportPreviewGridProps) {
  const visible = filter === "all" ? rows : rows.filter((r) => r.status === filter);

  if (visible.length === 0) {
    return (
      <EmptyState
        variant="no-assets"
        title="No rows to preview"
        description="Adjust filters or remapping, then validate again."
      />
    );
  }

  return (
    <div
      className={cn("overflow-x-auto rounded-md border border-border/70", className)}
      data-testid="excel-import-preview-grid"
    >
      <table className="w-full min-w-[64rem] text-left text-sm">
        <thead className="bg-muted/40 text-xs text-muted-foreground">
          <tr>
            <th className="px-2 py-2">Row</th>
            <th className="px-2 py-2">Status</th>
            <th className="px-2 py-2">Asset Tag</th>
            <th className="px-2 py-2">Laptop Name</th>
            <th className="px-2 py-2">Branch</th>
            <th className="px-2 py-2">Ops Status</th>
            <th className="px-2 py-2">Type</th>
            <th className="px-2 py-2">Employee</th>
            <th className="px-2 py-2">Messages</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((row) => (
            <tr key={row.rowNumber} className="border-t border-border/40 align-top">
              <td className="px-2 py-2 font-mono text-xs">{row.rowNumber}</td>
              <td className="px-2 py-2">
                <span
                  className={cn(
                    "inline-flex rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide",
                    STATUS_STYLES[row.status],
                  )}
                >
                  {row.status}
                </span>
              </td>
              <td className="px-2 py-2 font-mono text-xs">{row.values.assetTag ?? "—"}</td>
              <td className="max-w-[10rem] truncate px-2 py-2">{row.values.laptopName ?? "—"}</td>
              <td className="px-2 py-2">{row.values.branch ?? "—"}</td>
              <td className="px-2 py-2 font-mono text-xs">
                {row.values.operationalStatus ?? "—"}
              </td>
              <td className="px-2 py-2">{row.values.assetType ?? "—"}</td>
              <td className="px-2 py-2 font-mono text-xs">{row.values.employeeId ?? "—"}</td>
              <td className="px-2 py-2 text-xs text-muted-foreground">
                {row.issues.length === 0 ? (
                  <span className="text-emerald-700">OK</span>
                ) : (
                  <ul className="list-disc space-y-0.5 pl-4">
                    {row.issues.map((issue, idx) => (
                      <li
                        key={`${issue.code}-${idx}`}
                        className={
                          issue.severity === "error" ? "text-destructive" : "text-amber-800"
                        }
                      >
                        {issue.message}
                      </li>
                    ))}
                  </ul>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
