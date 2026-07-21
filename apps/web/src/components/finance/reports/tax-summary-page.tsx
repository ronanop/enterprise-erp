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
  getTaxSummaryReport,
  type TaxSummaryLine,
  type TaxSummaryReport,
} from "@/services/report-service";

const COLUMNS: ExportColumn<TaxSummaryLine>[] = [
  { key: "tax_type", label: "Tax Type" },
  { key: "transaction_type", label: "Transaction Type" },
  { key: "taxable_amount", label: "Taxable", align: "right", format: (v) => String(exportRawAmount(v)) },
  { key: "tax_amount", label: "Tax", align: "right", format: (v) => String(exportRawAmount(v)) },
  { key: "count", label: "Count", align: "right" },
];

export function TaxSummaryPage() {
  const { filters, setFilters, resetFilters, bookmarks, saveBookmark, applyBookmark, ready } =
    useReportFilters();
  const [report, setReport] = useState<TaxSummaryReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const authenticated = typeof window !== "undefined" ? isAuthenticated() : false;

  const load = useCallback(async () => {
    if (!authenticated) {
      setLoading(false);
      setError("Sign in to view tax summary.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setReport(await getTaxSummaryReport(filtersToQuery(filters)));
    } catch (err) {
      setReport(null);
      setError(err instanceof ApiClientError ? err.message : "Failed to load tax summary");
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
        title="Tax Summary"
        description="Taxable and tax amounts grouped by tax and transaction type."
        actions={
          <ReportExportToolbar
            loading={loading}
            disabled={!lines.length}
            onRefresh={() => void load()}
            onCsv={() => exportTabularCsv(`tax-summary-${stamp}.csv`, exportRows, COLUMNS)}
            onXlsx={() =>
              exportTabularXlsx(`tax-summary-${stamp}.xlsx`, "Tax Summary", exportRows, COLUMNS)
            }
            onPrint={() => printTabularTable("Tax Summary", exportRows, COLUMNS)}
            onPdf={() => printTabularTable("Tax Summary", exportRows, COLUMNS)}
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
        fields={["period"]}
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
                  <th className="px-3 py-2 text-left font-medium">Tax Type</th>
                  <th className="px-3 py-2 text-left font-medium">Transaction</th>
                  <th className="px-3 py-2 text-right font-medium">Taxable</th>
                  <th className="px-3 py-2 text-right font-medium">Tax</th>
                  <th className="px-3 py-2 text-right font-medium">Count</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line, idx) => (
                  <tr key={`${line.tax_type}-${line.transaction_type}-${idx}`} className="border-b border-border/50 hover:bg-accent/30">
                    <td className="px-3 py-2 font-medium">{line.tax_type}</td>
                    <td className="px-3 py-2 text-muted-foreground">{line.transaction_type}</td>
                    <td className="px-3 py-2 text-right font-mono text-xs tabular-nums">
                      {formatInrPrecise(line.taxable_amount)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-xs tabular-nums">
                      {formatInrPrecise(line.tax_amount)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-xs tabular-nums">{line.count}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-border/80 bg-muted/30 text-xs font-medium">
                  <td className="px-3 py-2.5" colSpan={2}>
                    Totals
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                    {formatInrPrecise(report?.total_taxable ?? 0)}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                    {formatInrPrecise(report?.total_tax ?? 0)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
