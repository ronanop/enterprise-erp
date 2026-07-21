"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { ReportExportToolbar } from "@/components/finance/reports/report-export-toolbar";
import { ReportFiltersBar } from "@/components/finance/reports/report-filters-bar";
import {
  ReportEmptyState,
  ReportErrorState,
  ReportTableSkeleton,
} from "@/components/finance/reports/report-state";
import { PageHeader } from "@/components/layout/page-header";
import { useReportFilters } from "@/hooks/use-report-filters";
import { isAuthenticated } from "@/lib/auth";
import {
  exportRawAmount,
  exportTabularCsv,
  exportTabularXlsx,
  printTabularTable,
  type ExportColumn,
} from "@/lib/finance/report-export";
import { ApiClientError } from "@/services/api-client";
import { formatInrPrecise } from "@/services/finance-service";
import {
  filtersToQuery,
  getCostCenterReport,
  type CostCenterSummaryLine,
  type CostCenterSummaryReport,
} from "@/services/report-service";

const COLUMNS: ExportColumn<CostCenterSummaryLine>[] = [
  { key: "cost_center_name", label: "Cost Center" },
  { key: "debit_total", label: "Debit", align: "right", format: (v) => String(exportRawAmount(v)) },
  { key: "credit_total", label: "Credit", align: "right", format: (v) => String(exportRawAmount(v)) },
  { key: "net", label: "Net", align: "right", format: (v) => String(exportRawAmount(v)) },
  { key: "entry_count", label: "Entries", align: "right" },
];

export function CostCenterPage() {
  const { filters, setFilters, resetFilters, bookmarks, saveBookmark, applyBookmark, ready } =
    useReportFilters();
  const [report, setReport] = useState<CostCenterSummaryReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const authenticated = typeof window !== "undefined" ? isAuthenticated() : false;

  const load = useCallback(async () => {
    if (!authenticated) {
      setLoading(false);
      setError("Sign in to view cost center summary.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setReport(await getCostCenterReport(filtersToQuery(filters)));
    } catch (err) {
      setReport(null);
      setError(err instanceof ApiClientError ? err.message : "Failed to load cost center summary");
    } finally {
      setLoading(false);
    }
  }, [authenticated, filters]);

  useEffect(() => {
    if (ready) void load();
  }, [load, ready]);

  const lines = report?.lines ?? [];
  const stamp = new Date().toISOString().slice(0, 10);
  const exportRows = useMemo(() => lines, [lines]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Cost Center Summary"
        description="Debit and credit totals by cost center for the selected period."
        actions={
          <ReportExportToolbar
            loading={loading}
            disabled={!lines.length}
            onRefresh={() => void load()}
            onCsv={() => exportTabularCsv(`cost-center-${stamp}.csv`, exportRows, COLUMNS)}
            onXlsx={() =>
              exportTabularXlsx(`cost-center-${stamp}.xlsx`, "Cost Center", exportRows, COLUMNS)
            }
            onPrint={() => printTabularTable("Cost Center Summary", exportRows, COLUMNS)}
            onPdf={() => printTabularTable("Cost Center Summary", exportRows, COLUMNS)}
          />
        }
      />

      <ReportFiltersBar
        filters={filters}
        onChange={setFilters}
        onReset={resetFilters}
        onSaveBookmark={saveBookmark}
        bookmarks={bookmarks}
        onApplyBookmark={applyBookmark}
        fields={["fiscalYear", "period", "fromDate", "toDate"]}
      />

      <ReportErrorState error={error} onRetry={() => void load()} authenticated={authenticated} />
      {loading && !report ? <ReportTableSkeleton /> : null}
      {!loading && !error && lines.length === 0 ? <ReportEmptyState /> : null}

      {!loading && !error && lines.length > 0 ? (
        <div className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm">
          <div className="erp-scroll overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-border/70 bg-muted/40 text-[11px] text-muted-foreground uppercase">
                  <th className="px-3 py-2 text-left font-medium">Cost Center</th>
                  <th className="px-3 py-2 text-right font-medium">Debit</th>
                  <th className="px-3 py-2 text-right font-medium">Credit</th>
                  <th className="px-3 py-2 text-right font-medium">Net</th>
                  <th className="px-3 py-2 text-right font-medium">Entries</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line, idx) => (
                  <tr
                    key={line.cost_center_id ?? `unassigned-${idx}`}
                    className="border-b border-border/50 hover:bg-accent/30"
                  >
                    <td className="px-3 py-2 font-medium">
                      {line.cost_center_name ?? (line.cost_center_id ? line.cost_center_id.slice(0, 8) : "Unassigned")}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-xs tabular-nums">
                      {formatInrPrecise(line.debit_total)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-xs tabular-nums">
                      {formatInrPrecise(line.credit_total)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-xs tabular-nums">
                      {formatInrPrecise(line.net)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-xs tabular-nums">
                      {line.entry_count}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-border/80 bg-muted/30 text-xs font-medium">
                  <td className="px-3 py-2.5">Totals</td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                    {formatInrPrecise(report?.total_debit ?? 0)}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                    {formatInrPrecise(report?.total_credit ?? 0)}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
