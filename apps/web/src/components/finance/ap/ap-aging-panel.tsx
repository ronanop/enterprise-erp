"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Download, FileSpreadsheet, Printer } from "lucide-react";

import { FinanceStatusBadge } from "@/components/finance/finance-status-badge";
import { Button } from "@/components/ui/button";
import {
  exportApAgingCsv,
  exportApAgingXlsx,
  exportApVendorSummaryCsv,
  exportApVendorSummaryXlsx,
  printApAgingTable,
} from "@/lib/finance/ap-export";
import type { ApAgingReport } from "@/services/ap-service";
import { formatInrPrecise } from "@/services/finance-service";

type Props = {
  report: ApAgingReport | null;
  loading?: boolean;
};

export function ApAgingPanel({ report, loading }: Props) {
  const [showItems, setShowItems] = useState(false);
  const asOf = report?.as_of ?? new Date().toISOString().slice(0, 10);
  const buckets = report?.buckets ?? [];
  const vendorSummary = report?.vendor_summary ?? [];
  const total = report?.total_outstanding ?? 0;

  const bucketMax = useMemo(
    () => Math.max(...buckets.map((b) => b.amount), 1),
    [buckets],
  );

  if (loading && !report) {
    return (
      <div className="rounded-xl border border-border/80 bg-card p-4 shadow-sm">
        <div className="h-6 w-40 animate-pulse rounded bg-muted/70" />
        <div className="mt-4 grid gap-2 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-lg bg-muted/70" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border/80 bg-card shadow-sm">
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 border-b border-border/70 bg-card px-3 py-2">
        <h3 className="text-sm font-medium tracking-tight">AP Aging · As of {asOf}</h3>
        <span className="text-xs text-muted-foreground">Total outstanding: {formatInrPrecise(total)}</span>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" className="h-8 cursor-pointer gap-1.5" onClick={() => exportApAgingCsv(buckets, asOf, vendorSummary)}>
            <Download className="size-3.5" /> CSV
          </Button>
          <Button type="button" variant="outline" size="sm" className="h-8 cursor-pointer gap-1.5" onClick={() => exportApAgingXlsx(buckets, asOf, vendorSummary)}>
            <FileSpreadsheet className="size-3.5" /> XLSX
          </Button>
          <Button type="button" variant="outline" size="sm" className="h-8 cursor-pointer gap-1.5" onClick={() => printApAgingTable(`AP Aging · ${asOf}`, buckets)}>
            <Printer className="size-3.5" /> Print
          </Button>
          <Button type="button" variant="outline" size="sm" className="h-8 cursor-pointer" onClick={() => setShowItems((v) => !v)}>
            {showItems ? "Hide items" : "Show items"}
          </Button>
        </div>
      </div>

      <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
        {buckets.length === 0 ? (
          <p className="col-span-full text-sm text-muted-foreground">No aging buckets to display.</p>
        ) : (
          buckets.map((b) => (
            <div key={b.bucket} className="rounded-lg border border-border/70 bg-muted/20 p-3">
              <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{b.bucket}</p>
              <p className="mt-1 font-mono text-lg tabular-nums">{formatInrPrecise(b.amount)}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{b.count} invoice{b.count === 1 ? "" : "s"}</p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-200"
                  style={{ width: `${Math.min(100, (b.amount / bucketMax) * 100)}%` }}
                />
              </div>
            </div>
          ))
        )}
      </div>

      {vendorSummary.length > 0 ? (
        <div className="border-t border-border/70">
          <div className="flex flex-wrap items-center gap-2 px-3 py-2">
            <h4 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Vendor Summary</h4>
            <div className="ml-auto flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" className="h-7 cursor-pointer gap-1.5 text-xs" onClick={() => exportApVendorSummaryCsv(vendorSummary, asOf)}>
                <Download className="size-3" /> CSV
              </Button>
              <Button type="button" variant="outline" size="sm" className="h-7 cursor-pointer gap-1.5 text-xs" onClick={() => exportApVendorSummaryXlsx(vendorSummary, asOf)}>
                <FileSpreadsheet className="size-3" /> XLSX
              </Button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b border-border/70 bg-muted/40 text-[11px] text-muted-foreground uppercase">
                  <th className="px-2 py-2 text-left">Vendor</th>
                  <th className="px-2 py-2 text-right">Total</th>
                  <th className="px-2 py-2 text-right">0-30</th>
                  <th className="px-2 py-2 text-right">31-60</th>
                  <th className="px-2 py-2 text-right">61-90</th>
                  <th className="px-2 py-2 text-right">90+</th>
                </tr>
              </thead>
              <tbody>
                {vendorSummary.map((row) => (
                  <tr key={row.vendor_id} className="border-b border-border/40 hover:bg-muted/40">
                    <td className="px-2 py-1.5 text-xs">
                      <Link href={`/finance/accounts-payable/vendors/${row.vendor_id}`} className="cursor-pointer hover:underline">
                        {row.vendor_name ?? row.vendor_code ?? row.vendor_id.slice(0, 8)}
                      </Link>
                    </td>
                    <td className="px-2 py-1.5 text-right font-mono text-xs tabular-nums">{formatInrPrecise(row.total)}</td>
                    <td className="px-2 py-1.5 text-right font-mono text-xs tabular-nums">{formatInrPrecise(row.bucket_0_30)}</td>
                    <td className="px-2 py-1.5 text-right font-mono text-xs tabular-nums">{formatInrPrecise(row.bucket_31_60)}</td>
                    <td className="px-2 py-1.5 text-right font-mono text-xs tabular-nums">{formatInrPrecise(row.bucket_61_90)}</td>
                    <td className="px-2 py-1.5 text-right font-mono text-xs tabular-nums">{formatInrPrecise(row.bucket_90_plus)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {showItems && report?.items && report.items.length > 0 ? (
        <div className="overflow-x-auto border-t border-border/70">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-border/70 bg-muted/40 text-[11px] text-muted-foreground uppercase">
                <th className="px-2 py-2 text-left">Invoice</th>
                <th className="px-2 py-2 text-left">Vendor</th>
                <th className="px-2 py-2 text-left">Due</th>
                <th className="px-2 py-2 text-left">Bucket</th>
                <th className="px-2 py-2 text-right">Balance</th>
                <th className="px-2 py-2 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {report.items.map((row) => (
                <tr key={row.id} className="border-b border-border/40 hover:bg-muted/40">
                  <td className="px-2 py-1.5 font-mono text-xs">
                    <Link href={`/finance/accounts-payable/invoices/${row.id}`} className="cursor-pointer hover:underline">
                      {row.document_number}
                    </Link>
                  </td>
                  <td className="px-2 py-1.5 text-xs">
                    <Link href={`/finance/accounts-payable/vendors/${row.vendor_id}`} className="cursor-pointer hover:underline">
                      {row.vendor_name ?? row.vendor_code ?? "—"}
                    </Link>
                  </td>
                  <td className="px-2 py-1.5 font-mono text-xs">{row.due_date}</td>
                  <td className="px-2 py-1.5 text-xs">{row.aging_bucket ?? "—"}</td>
                  <td className="px-2 py-1.5 text-right font-mono text-xs tabular-nums">{formatInrPrecise(row.balance_amount)}</td>
                  <td className="px-2 py-1.5"><FinanceStatusBadge status={row.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
