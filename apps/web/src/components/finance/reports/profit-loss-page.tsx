"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { FinanceKpiCard } from "@/components/finance/finance-kpi-card";
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
  getProfitLossReport,
  type ProfitLossReport,
  type StatementLine,
} from "@/services/report-service";
import { Scale, TrendingDown, TrendingUp, Wallet } from "lucide-react";

type Row = StatementLine & { section: string };

const COLUMNS: ExportColumn<Row>[] = [
  { key: "section", label: "Section" },
  { key: "account_name", label: "Line" },
  { key: "amount", label: "Current", align: "right", format: (v) => String(exportRawAmount(v)) },
  { key: "previous_amount", label: "Previous", align: "right", format: (v) => String(exportRawAmount(v)) },
  { key: "variance", label: "Variance", align: "right", format: (v) => String(exportRawAmount(v)) },
];

function PlSection({ title, lines }: { title: string; lines: StatementLine[] }) {
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
                className={cn("border-b border-border/50", line.is_total && "bg-muted/20 font-medium")}
              >
                <td className="px-3 py-2">{line.account_name}</td>
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
      </table>
    </div>
  );
}

export function ProfitLossPage() {
  const { filters, setFilters, resetFilters, bookmarks, saveBookmark, applyBookmark, ready } =
    useReportFilters();
  const [report, setReport] = useState<ProfitLossReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const authenticated = typeof window !== "undefined" ? isAuthenticated() : false;

  const load = useCallback(async () => {
    if (!authenticated) {
      setLoading(false);
      setError("Sign in to view profit & loss.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setReport(await getProfitLossReport(filtersToQuery(filters)));
    } catch (err) {
      setReport(null);
      setError(err instanceof ApiClientError ? err.message : "Failed to load profit & loss");
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
      ...report.revenue.map((l) => ({ ...l, section: "Revenue" })),
      ...report.cogs.map((l) => ({ ...l, section: "COGS" })),
      ...report.operating_expenses.map((l) => ({ ...l, section: "Operating Expenses" })),
    ];
  }, [report]);

  const stamp = new Date().toISOString().slice(0, 10);
  const subtitle =
    report?.from_date && report?.to_date
      ? `${report.from_date} to ${report.to_date}`
      : undefined;

  const printBody = () => {
    if (!report) return;
    const sectionHtml = (title: string, lines: StatementLine[]) =>
      `<div class="section">${title}</div><table><thead><tr><th>Line</th><th class="right">Current</th><th class="right">Previous</th></tr></thead><tbody>${lines
        .map(
          (l) =>
            `<tr><td>${l.account_name}</td><td class="right">${exportRawAmount(l.amount).toFixed(2)}</td><td class="right">${exportRawAmount(l.previous_amount).toFixed(2)}</td></tr>`,
        )
        .join("")}</tbody></table>`;
    printHtmlReport(
      "Profit & Loss",
      sectionHtml("Revenue", report.revenue) +
        `<p class="total">Gross Profit: ${report.gross_profit.toFixed(2)}</p>` +
        sectionHtml("COGS", report.cogs) +
        sectionHtml("Operating Expenses", report.operating_expenses) +
        `<p class="total">Net Profit: ${report.net_profit.toFixed(2)}</p>`,
      subtitle,
    );
  };

  const empty =
    !report ||
    (report.revenue.length === 0 &&
      report.cogs.length === 0 &&
      report.operating_expenses.length === 0);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Profit & Loss"
        description="Revenue, COGS, operating expenses, and net profit with comparison."
        actions={
          <ReportExportToolbar
            loading={loading}
            disabled={empty}
            onRefresh={() => void load()}
            onCsv={() => exportTabularCsv(`profit-loss-${stamp}.csv`, exportRows, COLUMNS)}
            onXlsx={() =>
              exportTabularXlsx(`profit-loss-${stamp}.xlsx`, "Profit and Loss", exportRows, COLUMNS)
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
        fields={["fiscalYear", "period", "fromDate", "toDate"]}
      />

      <ReportErrorState error={error} onRetry={() => void load()} authenticated={authenticated} />
      {loading && !report ? <ReportTableSkeleton /> : null}

      {!loading && !error && report ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <FinanceKpiCard label="Revenue" value={formatInrPrecise(report.total_revenue)} icon={TrendingUp} />
          <FinanceKpiCard label="Gross Profit" value={formatInrPrecise(report.gross_profit)} icon={Scale} />
          <FinanceKpiCard
            label="Operating Income"
            value={formatInrPrecise(report.operating_income)}
            icon={Wallet}
          />
          <FinanceKpiCard
            label="Net Profit"
            value={formatInrPrecise(report.net_profit)}
            icon={TrendingDown}
            tone={report.net_profit >= 0 ? "success" : "danger"}
          />
        </div>
      ) : null}

      {!loading && !error && empty ? <ReportEmptyState /> : null}

      {!loading && !error && report && !empty ? (
        <div className="grid gap-4">
          <PlSection title="Revenue" lines={report.revenue} />
          <PlSection title="Cost of Goods Sold" lines={report.cogs} />
          <PlSection title="Operating Expenses" lines={report.operating_expenses} />
        </div>
      ) : null}
    </div>
  );
}
