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
import { ApiClientError } from "@/services/api-client";
import { formatInrPrecise } from "@/services/finance-service";
import {
  filtersToQuery,
  getCashFlowReport,
  type CashFlowReport,
  type CashFlowSectionLine,
} from "@/services/report-service";
import { ArrowDownUp, Banknote, TrendingUp, Wallet } from "lucide-react";

type Row = CashFlowSectionLine & { section: string };

const COLUMNS: ExportColumn<Row>[] = [
  { key: "section", label: "Section" },
  { key: "label", label: "Line" },
  { key: "amount", label: "Amount", align: "right", format: (v) => String(exportRawAmount(v)) },
];

function CashFlowSection({ title, lines }: { title: string; lines: CashFlowSectionLine[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm">
      <div className="border-b border-border/70 px-3 py-2">
        <h3 className="text-sm font-medium tracking-tight">{title}</h3>
      </div>
      <table className="w-full text-sm">
        <tbody>
          {lines.length === 0 ? (
            <tr>
              <td colSpan={2} className="px-3 py-6 text-center text-muted-foreground">
                No lines
              </td>
            </tr>
          ) : (
            lines.map((line) => (
              <tr key={line.label} className="border-b border-border/50">
                <td className="px-3 py-2">{line.label}</td>
                <td className="px-3 py-2 text-right font-mono text-xs tabular-nums">
                  {formatInrPrecise(line.amount)}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export function CashFlowPage() {
  const { filters, setFilters, resetFilters, bookmarks, saveBookmark, applyBookmark, ready } =
    useReportFilters();
  const [report, setReport] = useState<CashFlowReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const authenticated = typeof window !== "undefined" ? isAuthenticated() : false;

  const load = useCallback(async () => {
    if (!authenticated) {
      setLoading(false);
      setError("Sign in to view cash flow.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setReport(await getCashFlowReport(filtersToQuery(filters)));
    } catch (err) {
      setReport(null);
      setError(err instanceof ApiClientError ? err.message : "Failed to load cash flow");
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
      ...report.operating.map((l) => ({ ...l, section: "Operating" })),
      ...report.investing.map((l) => ({ ...l, section: "Investing" })),
      ...report.financing.map((l) => ({ ...l, section: "Financing" })),
    ];
  }, [report]);

  const stamp = new Date().toISOString().slice(0, 10);
  const subtitle =
    report?.from_date && report?.to_date
      ? `${report.from_date} to ${report.to_date}`
      : undefined;

  const printBody = () => {
    if (!report) return;
    const sectionHtml = (title: string, lines: CashFlowSectionLine[]) =>
      `<div class="section">${title}</div><table><tbody>${lines
        .map(
          (l) =>
            `<tr><td>${l.label}</td><td class="right">${exportRawAmount(l.amount).toFixed(2)}</td></tr>`,
        )
        .join("")}</tbody></table>`;
    printHtmlReport(
      "Cash Flow Statement",
      sectionHtml("Operating Activities", report.operating) +
        sectionHtml("Investing Activities", report.investing) +
        sectionHtml("Financing Activities", report.financing) +
        `<p class="total">Opening Cash: ${report.opening_cash.toFixed(2)}</p>` +
        `<p class="total">Closing Cash: ${report.closing_cash.toFixed(2)}</p>`,
      subtitle,
    );
  };

  const empty =
    !report ||
    (report.operating.length === 0 &&
      report.investing.length === 0 &&
      report.financing.length === 0);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Cash Flow"
        description="Operating, investing, and financing cash movements."
        actions={
          <ReportExportToolbar
            loading={loading}
            disabled={empty}
            onRefresh={() => void load()}
            onCsv={() => exportTabularCsv(`cash-flow-${stamp}.csv`, exportRows, COLUMNS)}
            onXlsx={() =>
              exportTabularXlsx(`cash-flow-${stamp}.xlsx`, "Cash Flow", exportRows, COLUMNS)
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
          <FinanceKpiCard label="Net Operating" value={formatInrPrecise(report.net_operating)} icon={TrendingUp} />
          <FinanceKpiCard label="Net Investing" value={formatInrPrecise(report.net_investing)} icon={ArrowDownUp} />
          <FinanceKpiCard label="Opening Cash" value={formatInrPrecise(report.opening_cash)} icon={Wallet} />
          <FinanceKpiCard label="Closing Cash" value={formatInrPrecise(report.closing_cash)} icon={Banknote} />
        </div>
      ) : null}

      {!loading && !error && empty ? <ReportEmptyState /> : null}

      {!loading && !error && report && !empty ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <CashFlowSection title="Operating Activities" lines={report.operating} />
          <CashFlowSection title="Investing Activities" lines={report.investing} />
          <CashFlowSection title="Financing Activities" lines={report.financing} />
        </div>
      ) : null}
    </div>
  );
}
