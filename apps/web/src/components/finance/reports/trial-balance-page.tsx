"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

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
import { cn } from "@/lib/utils";
import { ApiClientError } from "@/services/api-client";
import { formatInrPrecise } from "@/services/finance-service";
import {
  filtersToQuery,
  getTrialBalanceReport,
  type TrialBalanceLine,
  type TrialBalanceReport,
} from "@/services/report-service";

const COLUMNS: ExportColumn<TrialBalanceLine>[] = [
  { key: "account_code", label: "Account Code" },
  { key: "account_name", label: "Account Name" },
  { key: "opening", label: "Opening", align: "right", format: (v) => String(exportRawAmount(v)) },
  { key: "debit_total", label: "Debit", align: "right", format: (v) => String(exportRawAmount(v)) },
  { key: "credit_total", label: "Credit", align: "right", format: (v) => String(exportRawAmount(v)) },
  { key: "closing", label: "Closing", align: "right", format: (v) => String(exportRawAmount(v)) },
  { key: "balance", label: "Difference", align: "right", format: (v) => String(exportRawAmount(v)) },
];

export function TrialBalancePage() {
  const {
    filters,
    setFilters,
    resetFilters,
    bookmarks,
    saveBookmark,
    applyBookmark,
    ready,
  } = useReportFilters();
  const [report, setReport] = useState<TrialBalanceReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const authenticated = typeof window !== "undefined" ? isAuthenticated() : false;

  const load = useCallback(async () => {
    if (!authenticated) {
      setLoading(false);
      setError("Sign in to view trial balance.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setReport(await getTrialBalanceReport(filtersToQuery(filters)));
    } catch (err) {
      setReport(null);
      setError(err instanceof ApiClientError ? err.message : "Failed to load trial balance");
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
        title="Trial Balance"
        description="Opening, debit, credit, and closing balances by account."
        actions={
          <ReportExportToolbar
            loading={loading}
            disabled={!lines.length}
            onRefresh={() => void load()}
            onCsv={() =>
              exportTabularCsv(`trial-balance-${stamp}.csv`, exportRows, COLUMNS)
            }
            onXlsx={() =>
              exportTabularXlsx(`trial-balance-${stamp}.xlsx`, "Trial Balance", exportRows, COLUMNS)
            }
            onPrint={() => printTabularTable("Trial Balance", exportRows, COLUMNS)}
            onPdf={() => printTabularTable("Trial Balance", exportRows, COLUMNS)}
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
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead>
                <tr className="border-b border-border/70 bg-muted/40 text-[11px] tracking-wide text-muted-foreground uppercase">
                  <th className="px-3 py-2.5 font-medium">Account</th>
                  <th className="px-3 py-2.5 text-right font-medium">Opening</th>
                  <th className="px-3 py-2.5 text-right font-medium">Debit</th>
                  <th className="px-3 py-2.5 text-right font-medium">Credit</th>
                  <th className="px-3 py-2.5 text-right font-medium">Closing</th>
                  <th className="px-3 py-2.5 text-right font-medium">Difference</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => (
                  <tr key={line.account_id} className="border-b border-border/50 hover:bg-accent/30">
                    <td className="px-3 py-2">
                      <Link
                        href={`/finance/general-ledger/accounts/${line.account_id}`}
                        className="cursor-pointer hover:underline"
                      >
                        <span className="font-mono text-xs text-muted-foreground">{line.account_code}</span>
                        <span className="mx-1.5 text-muted-foreground/40">·</span>
                        <span className="font-medium">{line.account_name}</span>
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-xs tabular-nums">
                      {formatInrPrecise(line.opening)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-xs tabular-nums">
                      {formatInrPrecise(line.debit_total)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-xs tabular-nums">
                      {formatInrPrecise(line.credit_total)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-xs tabular-nums">
                      {formatInrPrecise(line.closing)}
                    </td>
                    <td
                      className={cn(
                        "px-3 py-2 text-right font-mono text-xs tabular-nums",
                        Math.abs(line.balance) > 0.01 && "text-amber-700",
                      )}
                    >
                      {formatInrPrecise(line.balance)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-border/80 bg-muted/30 text-xs font-medium">
                  <td className="px-3 py-2.5">Totals</td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                    {formatInrPrecise(report?.total_opening ?? 0)}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                    {formatInrPrecise(report?.total_debit ?? 0)}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                    {formatInrPrecise(report?.total_credit ?? 0)}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                    {formatInrPrecise(report?.total_closing ?? 0)}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                    {formatInrPrecise(report?.difference ?? 0)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
