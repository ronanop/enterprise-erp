"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { FinanceStatusBadge } from "@/components/finance/finance-status-badge";
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
  getGlReport,
  type GlReport,
  type GlReportLine,
} from "@/services/report-service";

const COLUMNS: ExportColumn<GlReportLine>[] = [
  { key: "entry_date", label: "Date" },
  { key: "entry_number", label: "Voucher" },
  { key: "journal_number", label: "Journal" },
  { key: "account_code", label: "Account Code" },
  { key: "account_name", label: "Account Name" },
  { key: "description", label: "Description" },
  { key: "debit_amount", label: "Debit", align: "right", format: (v) => String(exportRawAmount(v)) },
  { key: "credit_amount", label: "Credit", align: "right", format: (v) => String(exportRawAmount(v)) },
  { key: "journal_status", label: "Status" },
];

function journalHref(line: GlReportLine): string {
  if (line.journal_header_id) return `/finance/journals/${line.journal_header_id}`;
  return `/finance/general-ledger/${line.id}`;
}

export function GlReportPage() {
  const { filters, setFilters, resetFilters, bookmarks, saveBookmark, applyBookmark, ready } =
    useReportFilters();
  const [report, setReport] = useState<GlReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const authenticated = typeof window !== "undefined" ? isAuthenticated() : false;

  const load = useCallback(async () => {
    if (!authenticated) {
      setLoading(false);
      setError("Sign in to view general ledger report.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setReport(await getGlReport(filtersToQuery(filters)));
    } catch (err) {
      setReport(null);
      setError(err instanceof ApiClientError ? err.message : "Failed to load general ledger report");
    } finally {
      setLoading(false);
    }
  }, [authenticated, filters]);

  useEffect(() => {
    if (ready) void load();
  }, [load, ready]);

  const lines = report?.items ?? [];
  const stamp = new Date().toISOString().slice(0, 10);
  const exportRows = useMemo(() => lines, [lines]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="General Ledger Report"
        description="Printable posted ledger with account and date filters."
        actions={
          <ReportExportToolbar
            loading={loading}
            disabled={!lines.length}
            onRefresh={() => void load()}
            onCsv={() => exportTabularCsv(`general-ledger-report-${stamp}.csv`, exportRows, COLUMNS)}
            onXlsx={() =>
              exportTabularXlsx(
                `general-ledger-report-${stamp}.xlsx`,
                "General Ledger",
                exportRows,
                COLUMNS,
              )
            }
            onPrint={() => printTabularTable("General Ledger Report", exportRows, COLUMNS)}
            onPdf={() => printTabularTable("General Ledger Report", exportRows, COLUMNS)}
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
        fields={["fiscalYear", "period", "fromDate", "toDate", "account", "costCenter", "currency", "search"]}
      />

      <ReportErrorState error={error} onRetry={() => void load()} authenticated={authenticated} />
      {loading && !report ? <ReportTableSkeleton /> : null}
      {!loading && !error && lines.length === 0 ? <ReportEmptyState /> : null}

      {!loading && !error && lines.length > 0 ? (
        <div className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm">
          <div className="erp-scroll overflow-x-auto">
            <table className="w-full min-w-[1100px] text-left text-sm">
              <thead>
                <tr className="border-b border-border/70 bg-muted/40 text-[11px] tracking-wide text-muted-foreground uppercase">
                  <th className="px-2 py-2 font-medium">Date</th>
                  <th className="px-2 py-2 font-medium">Voucher</th>
                  <th className="px-2 py-2 font-medium">Journal</th>
                  <th className="px-2 py-2 font-medium">Account</th>
                  <th className="px-2 py-2 font-medium">Description</th>
                  <th className="px-2 py-2 text-right font-medium">Debit</th>
                  <th className="px-2 py-2 text-right font-medium">Credit</th>
                  <th className="px-2 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => (
                  <tr key={line.id} className="border-b border-border/50 hover:bg-accent/30">
                    <td className="px-2 py-1.5 font-mono text-xs">{line.entry_date}</td>
                    <td className="px-2 py-1.5 font-mono text-xs">
                      <Link
                        href={`/finance/general-ledger/${line.id}`}
                        className="cursor-pointer hover:underline"
                      >
                        {line.entry_number}
                      </Link>
                    </td>
                    <td className="px-2 py-1.5 font-mono text-xs">
                      {line.journal_number ? (
                        <Link href={journalHref(line)} className="cursor-pointer hover:underline">
                          {line.journal_number}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-2 py-1.5 text-xs">
                      <Link
                        href={`/finance/general-ledger/accounts/${line.account_id}`}
                        className="cursor-pointer hover:underline"
                      >
                        {line.account_code}
                        {line.account_name ? ` · ${line.account_name}` : ""}
                      </Link>
                    </td>
                    <td className="px-2 py-1.5 text-xs text-muted-foreground">
                      {line.description ?? "—"}
                    </td>
                    <td className="px-2 py-1.5 text-right font-mono text-xs tabular-nums">
                      {formatInrPrecise(line.debit_amount)}
                    </td>
                    <td className="px-2 py-1.5 text-right font-mono text-xs tabular-nums">
                      {formatInrPrecise(line.credit_amount)}
                    </td>
                    <td className="px-2 py-1.5">
                      <FinanceStatusBadge status={line.journal_status ?? "posted"} />
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-border/80 bg-muted/30 text-xs font-medium">
                  <td className="px-2 py-2" colSpan={5}>
                    Totals · {report?.total ?? lines.length} entries
                  </td>
                  <td className="px-2 py-2 text-right font-mono tabular-nums">
                    {formatInrPrecise(report?.total_debit ?? 0)}
                  </td>
                  <td className="px-2 py-2 text-right font-mono tabular-nums">
                    {formatInrPrecise(report?.total_credit ?? 0)}
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
