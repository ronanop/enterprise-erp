"use client";

import { SalesStageBadge } from "@/components/crm/sales/sales-stage-badge";
import { formatReportCellTitle, formatReportCellValue, isReportStageColumn } from "@/lib/crm/report-amount";
import { resolveSalesStageLabel } from "@/lib/crm/sales-blueprint-stages";

function friendlyStageLabel(columnKey: string, value: unknown): string {
  if (value == null) return "-";
  const raw = String(value).trim();
  if (!raw) return "-";

  const key = columnKey.toLowerCase();
  if (key.includes("quote_stage")) {
    return resolveSalesStageLabel({ entityType: "quote", blueprintState: raw });
  }
  if (key.includes("blueprint_state") && key.includes("ovf")) {
    return resolveSalesStageLabel({ entityType: "ovf", blueprintState: raw });
  }
  if (key.includes("current_stage") || key.includes("blueprint_state")) {
    return resolveSalesStageLabel({ entityType: "opportunity", blueprintState: raw });
  }
  // Already a display label, or unknown stage column — title-case underscores.
  if (raw.includes("_")) {
    return raw.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return raw;
}

/** Report table cell: orange/green stage badge when the column is a stage field. */
export function ReportStageAwareCell({
  columnKey,
  value,
}: {
  columnKey: string;
  value: unknown;
}) {
  if (!isReportStageColumn(columnKey)) {
    return (
      <span title={formatReportCellTitle(columnKey, value)}>
        {formatReportCellValue(columnKey, value)}
      </span>
    );
  }

  const label = friendlyStageLabel(columnKey, value);
  if (label === "-") return <span>-</span>;

  return (
    <SalesStageBadge
      label={label}
      state={typeof value === "string" ? value : undefined}
      className="normal-case"
    />
  );
}
