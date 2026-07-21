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
  getJournalRegisterReport,
  type JournalRegisterLine,
  type JournalRegisterReport,
} from "@/services/report-service";

const COLUMNS: ExportColumn<JournalRegisterLine>[] = [
  { key: "journal_number", label: "Journal No" },
  { key: "journal_date", label: "Date" },
  { key: "journal_type", label: "Type" },
  { key: "reference", label: "Reference" },
  { key: "description", label: "Description" },
  { key: "status", label: "Status" },
  { key: "workflow_status", label: "Workflow" },
  { key: "total_debit", label: "Debit", align: "right", format: (v) => String(exportRawAmount(v)) },
  { key: "total_credit", label: "Credit", align: "right", format: (v) => String(exportRawAmount(v)) },
];

export function JournalRegisterPage() {
  const { filters, setFilters, resetFilters, bookmarks, saveBookmark, applyBookmark, ready } =
    useReportFilters();
  const [report, setReport] = useState<JournalRegisterReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const authenticated = typeof window !== "undefined" ? isAuthenticated() : false;

  const load = useCallback(async () => {
    if (!authenticated) {
      setLoading(false);
      setError("Sign in to view journal register.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setReport(await getJournalRegisterReport(filtersToQuery(filters)));
    } catch (err) {
      setReport(null);
      setError(err instanceof ApiClientError ? err.message : "Failed to load journal register");
    } finally {
      setLoading(false);
    }
  }, [authenticated, filters]);

  useEffect(() => {
    if (ready) void load();
  }, [load, ready]);

  const items = report?.items ?? [];
  const stamp = new Date().toISOString().slice(0, 10);
  const exportRows = useMemo(() => items, [items]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Journal Register"
        description="Journal listing with voucher, status, and workflow state."
        actions={
          <ReportExportToolbar
            loading={loading}
            disabled={!items.length}
            onRefresh={() => void load()}
            onCsv={() => exportTabularCsv(`journal-register-${stamp}.csv`, exportRows, COLUMNS)}
            onXlsx={() =>
              exportTabularXlsx(`journal-register-${stamp}.xlsx`, "Journal Register", exportRows, COLUMNS)
            }
            onPrint={() => printTabularTable("Journal Register", exportRows, COLUMNS)}
            onPdf={() => printTabularTable("Journal Register", exportRows, COLUMNS)}
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
        fields={["fiscalYear", "period", "fromDate", "toDate", "status", "search"]}
      />

      <ReportErrorState error={error} onRetry={() => void load()} authenticated={authenticated} />
      {loading && !report ? <ReportTableSkeleton /> : null}
      {!loading && !error && items.length === 0 ? <ReportEmptyState /> : null}

      {!loading && !error && items.length > 0 ? (
        <div className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm">
          <div className="erp-scroll overflow-x-auto">
            <table className="w-full min-w-[1000px] text-left text-sm">
              <thead>
                <tr className="border-b border-border/70 bg-muted/40 text-[11px] tracking-wide text-muted-foreground uppercase">
                  <th className="px-2 py-2 font-medium">Journal</th>
                  <th className="px-2 py-2 font-medium">Date</th>
                  <th className="px-2 py-2 font-medium">Type</th>
                  <th className="px-2 py-2 font-medium">Reference</th>
                  <th className="px-2 py-2 font-medium">Description</th>
                  <th className="px-2 py-2 text-right font-medium">Debit</th>
                  <th className="px-2 py-2 text-right font-medium">Credit</th>
                  <th className="px-2 py-2 font-medium">Status</th>
                  <th className="px-2 py-2 font-medium">Workflow</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-b border-border/50 hover:bg-accent/30">
                    <td className="px-2 py-1.5 font-mono text-xs">
                      <Link
                        href={`/finance/journals/${item.id}`}
                        className="cursor-pointer hover:underline"
                      >
                        {item.journal_number}
                      </Link>
                    </td>
                    <td className="px-2 py-1.5 font-mono text-xs">{item.journal_date ?? "—"}</td>
                    <td className="px-2 py-1.5 text-xs">{item.journal_type ?? "—"}</td>
                    <td className="px-2 py-1.5 text-xs">{item.reference ?? "—"}</td>
                    <td className="px-2 py-1.5 text-xs text-muted-foreground">
                      {item.description ?? "—"}
                    </td>
                    <td className="px-2 py-1.5 text-right font-mono text-xs tabular-nums">
                      {formatInrPrecise(item.total_debit)}
                    </td>
                    <td className="px-2 py-1.5 text-right font-mono text-xs tabular-nums">
                      {formatInrPrecise(item.total_credit)}
                    </td>
                    <td className="px-2 py-1.5">
                      <FinanceStatusBadge status={item.status} />
                    </td>
                    <td className="px-2 py-1.5 text-xs">
                      {item.workflow_status ? (
                        <FinanceStatusBadge status={item.workflow_status} />
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-border/80 bg-muted/30 text-xs font-medium">
                  <td className="px-2 py-2" colSpan={5}>
                    Totals · {report?.total ?? items.length} journals
                  </td>
                  <td className="px-2 py-2 text-right font-mono tabular-nums">
                    {formatInrPrecise(report?.total_debit ?? 0)}
                  </td>
                  <td className="px-2 py-2 text-right font-mono tabular-nums">
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
