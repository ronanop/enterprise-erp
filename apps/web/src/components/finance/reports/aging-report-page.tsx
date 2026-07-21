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
import { Button } from "@/components/ui/button";
import { useReportFilters } from "@/hooks/use-report-filters";
import { isAuthenticated } from "@/lib/auth";
import {
  exportRawAmount,
  exportTabularCsv,
  exportTabularXlsx,
  printHtmlReport,
  printTabularTable,
  type ExportColumn,
} from "@/lib/finance/report-export";
import { ApiClientError } from "@/services/api-client";
import { formatInrPrecise } from "@/services/finance-service";
import {
  filtersToQuery,
  getApAgingReport,
  getArAgingReport,
  type AgingBucket,
  type ApAgingReport,
  type ArAgingReport,
} from "@/services/report-service";

type Props = {
  mode: "ar" | "ap";
};

type AgingItem = {
  id: string;
  document_number: string;
  party_id: string;
  party_name?: string | null;
  party_code?: string | null;
  due_date?: string | null;
  balance_amount: number;
  aging_bucket?: string | null;
  status?: string;
};

const BUCKET_COLUMNS: ExportColumn<AgingBucket>[] = [
  { key: "bucket", label: "Bucket" },
  { key: "amount", label: "Amount", align: "right", format: (v) => String(exportRawAmount(v)) },
  { key: "count", label: "Count", align: "right" },
];

export function AgingReportPage({ mode }: Props) {
  const { filters, setFilters, resetFilters, bookmarks, saveBookmark, applyBookmark, ready } =
    useReportFilters();
  const [report, setReport] = useState<ArAgingReport | ApAgingReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showItems, setShowItems] = useState(true);
  const authenticated = typeof window !== "undefined" ? isAuthenticated() : false;

  const isAr = mode === "ar";
  const title = isAr ? "AR Aging Report" : "AP Aging Report";
  const partyLabel = isAr ? "Customer" : "Vendor";
  const partyBase = isAr
    ? "/finance/accounts-receivable/customers"
    : "/finance/accounts-payable/vendors";

  const load = useCallback(async () => {
    if (!authenticated) {
      setLoading(false);
      setError(`Sign in to view ${isAr ? "AR" : "AP"} aging.`);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const query = filtersToQuery(filters);
      setReport(
        isAr
          ? await getArAgingReport(query)
          : await getApAgingReport(query),
      );
    } catch (err) {
      setReport(null);
      setError(err instanceof ApiClientError ? err.message : "Failed to load aging report");
    } finally {
      setLoading(false);
    }
  }, [authenticated, filters, isAr]);

  useEffect(() => {
    if (ready) void load();
  }, [load, ready]);

  const buckets = report?.buckets ?? [];
  const items: AgingItem[] = useMemo(() => {
    if (!report?.items) return [];
    return report.items.map((row) => {
      if (isAr) {
        const r = row as ArAgingReport["items"][number];
        return {
          id: r.id,
          document_number: r.document_number,
          party_id: r.customer_id,
          party_name: r.customer_name,
          party_code: r.customer_code,
          due_date: r.due_date,
          balance_amount: r.balance_amount,
          aging_bucket: r.aging_bucket,
          status: r.status,
        };
      }
      const r = row as ApAgingReport["items"][number];
      return {
        id: r.id,
        document_number: r.document_number,
        party_id: r.vendor_id,
        party_name: r.vendor_name,
        party_code: r.vendor_code,
        due_date: r.due_date,
        balance_amount: r.balance_amount,
        aging_bucket: r.aging_bucket,
        status: r.status,
      };
    });
  }, [report, isAr]);

  const asOf = report?.as_of ?? filters.asOf;
  const stamp = asOf || new Date().toISOString().slice(0, 10);

  const printBody = () => {
    const bucketHtml = buckets
      .map(
        (b) =>
          `<tr><td>${b.bucket}</td><td class="right">${exportRawAmount(b.amount).toFixed(2)}</td><td class="right">${b.count}</td></tr>`,
      )
      .join("");
    const itemsHtml = items
      .slice(0, 500)
      .map(
        (r) =>
          `<tr><td>${r.document_number}</td><td>${r.party_name ?? r.party_code ?? ""}</td><td>${r.due_date ?? ""}</td><td>${r.aging_bucket ?? ""}</td><td class="right">${exportRawAmount(r.balance_amount).toFixed(2)}</td></tr>`,
      )
      .join("");
    printHtmlReport(
      title,
      `<div class="section">Buckets</div><table><thead><tr><th>Bucket</th><th class="right">Amount</th><th class="right">Count</th></tr></thead><tbody>${bucketHtml}</tbody></table>` +
        `<div class="section">Items</div><table><thead><tr><th>Document</th><th>${partyLabel}</th><th>Due</th><th>Bucket</th><th class="right">Balance</th></tr></thead><tbody>${itemsHtml}</tbody></table>`,
      `As of ${asOf}`,
    );
  };

  const bucketMax = Math.max(...buckets.map((b) => b.amount), 1);

  return (
    <div className="space-y-4">
      <PageHeader
        title={title}
        description={`${partyLabel} outstanding by aging bucket — as of ${asOf}.`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 cursor-pointer"
              onClick={() => setShowItems((v) => !v)}
            >
              {showItems ? "Hide items" : "Show items"}
            </Button>
            <ReportExportToolbar
              loading={loading}
              disabled={!buckets.length && !items.length}
              onRefresh={() => void load()}
              onCsv={() => exportTabularCsv(`${mode}-aging-${stamp}.csv`, buckets, BUCKET_COLUMNS)}
              onXlsx={() =>
                exportTabularXlsx(`${mode}-aging-${stamp}.xlsx`, "Aging", buckets, BUCKET_COLUMNS)
              }
              onPrint={printBody}
              onPdf={printBody}
            />
          </div>
        }
      />

      <ReportFiltersBar
        filters={filters}
        onChange={setFilters}
        onReset={resetFilters}
        onSaveBookmark={saveBookmark}
        bookmarks={bookmarks}
        onApplyBookmark={applyBookmark}
        fields={["asOf"]}
      />

      <ReportErrorState error={error} onRetry={() => void load()} authenticated={authenticated} />
      {loading && !report ? <ReportTableSkeleton rows={4} /> : null}

      {!loading && !error && report ? (
        <p className="text-xs text-muted-foreground">
          Total outstanding: {formatInrPrecise(report.total_outstanding)}
        </p>
      ) : null}

      {!loading && !error && buckets.length === 0 && items.length === 0 ? (
        <ReportEmptyState />
      ) : null}

      {!loading && !error && buckets.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {buckets.map((b) => (
            <div key={b.bucket} className="rounded-lg border border-border/70 bg-card p-3 shadow-sm">
              <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                {b.bucket}
              </p>
              <p className="mt-1 font-mono text-lg tabular-nums">{formatInrPrecise(b.amount)}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {b.count} document{b.count === 1 ? "" : "s"}
              </p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-200"
                  style={{ width: `${Math.min(100, (b.amount / bucketMax) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {!loading && !error && showItems && items.length > 0 ? (
        <div className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm">
          <div className="erp-scroll overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b border-border/70 bg-muted/40 text-[11px] text-muted-foreground uppercase">
                  <th className="px-2 py-2 text-left">Document</th>
                  <th className="px-2 py-2 text-left">{partyLabel}</th>
                  <th className="px-2 py-2 text-left">Due</th>
                  <th className="px-2 py-2 text-left">Bucket</th>
                  <th className="px-2 py-2 text-right">Balance</th>
                  <th className="px-2 py-2 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.id} className="border-b border-border/40 hover:bg-muted/40">
                    <td className="px-2 py-1.5 font-mono text-xs">{row.document_number}</td>
                    <td className="px-2 py-1.5 text-xs">
                      <Link
                        href={`${partyBase}/${row.party_id}`}
                        className="cursor-pointer hover:underline"
                      >
                        {row.party_name ?? row.party_code ?? "—"}
                      </Link>
                    </td>
                    <td className="px-2 py-1.5 font-mono text-xs">{row.due_date ?? "—"}</td>
                    <td className="px-2 py-1.5 text-xs">{row.aging_bucket ?? "—"}</td>
                    <td className="px-2 py-1.5 text-right font-mono text-xs tabular-nums">
                      {formatInrPrecise(row.balance_amount)}
                    </td>
                    <td className="px-2 py-1.5">
                      {row.status ? <FinanceStatusBadge status={row.status} /> : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
