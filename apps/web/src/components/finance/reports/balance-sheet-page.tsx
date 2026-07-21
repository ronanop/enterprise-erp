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
  printHtmlReport,
  type ExportColumn,
} from "@/lib/finance/report-export";
import { cn } from "@/lib/utils";
import { ApiClientError } from "@/services/api-client";
import { formatInrPrecise } from "@/services/finance-service";
import {
  filtersToQuery,
  getBalanceSheetReport,
  type BalanceSheetReport,
  type StatementLine,
} from "@/services/report-service";

type Row = StatementLine & { section: string };

const COLUMNS: ExportColumn<Row>[] = [
  { key: "section", label: "Section" },
  { key: "account_name", label: "Line" },
  { key: "amount", label: "Current", align: "right", format: (v) => String(exportRawAmount(v)) },
  { key: "previous_amount", label: "Previous", align: "right", format: (v) => String(exportRawAmount(v)) },
  { key: "variance", label: "Variance", align: "right", format: (v) => String(exportRawAmount(v)) },
];

function StatementSection({
  title,
  lines,
  total,
  previousTotal,
}: {
  title: string;
  lines: StatementLine[];
  total: number;
  previousTotal: number;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm">
      <div className="border-b border-border/70 px-3 py-2">
        <h3 className="text-sm font-medium tracking-tight">{title}</h3>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border/70 bg-muted/40 text-[11px] text-muted-foreground uppercase">
            <th className="px-3 py-2 text-left font-medium">Line</th>
            <th className="px-3 py-2 text-right font-medium">Current</th>
            <th className="px-3 py-2 text-right font-medium">Previous</th>
            <th className="px-3 py-2 text-right font-medium">Variance</th>
          </tr>
        </thead>
        <tbody>
          {lines.length === 0 ? (
            <tr>
              <td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">
                No lines
              </td>
            </tr>
          ) : (
            lines.map((line, idx) => (
              <tr
                key={`${line.account_id ?? line.account_name}-${idx}`}
                className={cn(
                  "border-b border-border/50",
                  line.is_total && "bg-muted/20 font-medium",
                )}
              >
                <td
                  className="px-3 py-2"
                  style={{ paddingLeft: `${12 + (line.level ?? 0) * 12}px` }}
                >
                  {line.account_code ? (
                    <span className="font-mono text-xs text-muted-foreground">{line.account_code} · </span>
                  ) : null}
                  {line.account_name}
                </td>
                <td className="px-3 py-2 text-right font-mono text-xs tabular-nums">
                  {formatInrPrecise(line.amount)}
                </td>
                <td className="px-3 py-2 text-right font-mono text-xs tabular-nums">
                  {formatInrPrecise(line.previous_amount)}
                </td>
                <td className="px-3 py-2 text-right font-mono text-xs tabular-nums">
                  {formatInrPrecise(line.variance)}
                </td>
              </tr>
            ))
          )}
        </tbody>
        <tfoot>
          <tr className="border-t border-border/80 bg-muted/30 text-xs font-medium">
            <td className="px-3 py-2.5">Total {title}</td>
            <td className="px-3 py-2.5 text-right font-mono tabular-nums">{formatInrPrecise(total)}</td>
            <td className="px-3 py-2.5 text-right font-mono tabular-nums">{formatInrPrecise(previousTotal)}</td>
            <td className="px-3 py-2.5 text-right font-mono tabular-nums">
              {formatInrPrecise(total - previousTotal)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

export function BalanceSheetPage() {
  const { filters, setFilters, resetFilters, bookmarks, saveBookmark, applyBookmark, ready } =
    useReportFilters();
  const [report, setReport] = useState<BalanceSheetReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const authenticated = typeof window !== "undefined" ? isAuthenticated() : false;

  const load = useCallback(async () => {
    if (!authenticated) {
      setLoading(false);
      setError("Sign in to view balance sheet.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setReport(await getBalanceSheetReport(filtersToQuery(filters)));
    } catch (err) {
      setReport(null);
      setError(err instanceof ApiClientError ? err.message : "Failed to load balance sheet");
    } finally {
      setLoading(false);
    }
  }, [authenticated, filters]);

  useEffect(() => {
    if (ready) void load();
  }, [load, ready]);

  const exportRows = useMemo<Row[]>(() => {
    if (!report) return [];
    return [
      ...report.assets.map((l) => ({ ...l, section: "Assets" })),
      ...report.liabilities.map((l) => ({ ...l, section: "Liabilities" })),
      ...report.equity.map((l) => ({ ...l, section: "Equity" })),
    ];
  }, [report]);

  const stamp = new Date().toISOString().slice(0, 10);
  const subtitle = report?.as_of ? `As of ${report.as_of}` : undefined;

  const printBody = () => {
    if (!report) return;
    const sectionHtml = (title: string, lines: StatementLine[]) =>
      `<div class="section">${title}</div><table><thead><tr><th>Line</th><th class="right">Current</th><th class="right">Previous</th><th class="right">Variance</th></tr></thead><tbody>${lines
        .map(
          (l) =>
            `<tr><td>${l.account_name}</td><td class="right">${exportRawAmount(l.amount).toFixed(2)}</td><td class="right">${exportRawAmount(l.previous_amount).toFixed(2)}</td><td class="right">${exportRawAmount(l.variance).toFixed(2)}</td></tr>`,
        )
        .join("")}</tbody></table>`;
    printHtmlReport(
      "Balance Sheet",
      sectionHtml("Assets", report.assets) +
        sectionHtml("Liabilities", report.liabilities) +
        sectionHtml("Equity", report.equity),
      subtitle,
    );
  };

  const empty =
    !report ||
    (report.assets.length === 0 && report.liabilities.length === 0 && report.equity.length === 0);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Balance Sheet"
        description="Assets, liabilities, and equity with period comparison."
        actions={
          <ReportExportToolbar
            loading={loading}
            disabled={empty}
            onRefresh={() => void load()}
            onCsv={() => exportTabularCsv(`balance-sheet-${stamp}.csv`, exportRows, COLUMNS)}
            onXlsx={() =>
              exportTabularXlsx(`balance-sheet-${stamp}.xlsx`, "Balance Sheet", exportRows, COLUMNS)
            }
            onPrint={printBody}
            onPdf={printBody}
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
        fields={["fiscalYear", "period", "asOf"]}
      />

      {report?.as_of ? (
        <p className="text-xs text-muted-foreground">
          As of {report.as_of}
          {report.previous_as_of ? ` · Previous ${report.previous_as_of}` : ""}
        </p>
      ) : null}

      <ReportErrorState error={error} onRetry={() => void load()} authenticated={authenticated} />
      {loading && !report ? <ReportTableSkeleton /> : null}
      {!loading && !error && empty ? <ReportEmptyState /> : null}

      {!loading && !error && report && !empty ? (
        <div className="grid gap-4 lg:grid-cols-1">
          <StatementSection
            title="Assets"
            lines={report.assets}
            total={report.total_assets}
            previousTotal={report.previous_total_assets}
          />
          <StatementSection
            title="Liabilities"
            lines={report.liabilities}
            total={report.total_liabilities}
            previousTotal={report.previous_total_liabilities}
          />
          <StatementSection
            title="Equity"
            lines={report.equity}
            total={report.total_equity}
            previousTotal={report.previous_total_equity}
          />
        </div>
      ) : null}
    </div>
  );
}
