"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, RefreshCw } from "lucide-react";

import { FinanceStatusBadge } from "@/components/finance/finance-status-badge";
import { FinanceField } from "@/components/finance/journals/finance-form-field";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiClientError } from "@/services/api-client";
import { getVendorLedger, type ApVendorLedger } from "@/services/ap-service";
import { formatInrPrecise } from "@/services/finance-service";

export function ApVendorLedgerPage({ vendorId }: { vendorId: string }) {
  const [ledger, setLedger] = useState<ApVendorLedger | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getVendorLedger(vendorId, {
        from_date: fromDate || undefined,
        to_date: toDate || undefined,
      });
      setLedger(data);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to load vendor ledger");
    } finally {
      setLoading(false);
    }
  }, [vendorId, fromDate, toDate]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !ledger) {
    return (
      <div className="space-y-3">
        <div className="h-10 animate-pulse rounded-lg bg-muted/70" />
        <div className="h-64 animate-pulse rounded-xl bg-muted/70" />
      </div>
    );
  }

  if (error && !ledger) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-destructive">{error}</p>
        <Button type="button" variant="outline" className="cursor-pointer" onClick={() => void load()}>Retry</Button>
      </div>
    );
  }

  if (!ledger) return null;

  return (
    <div className="space-y-4">
      <PageHeader
        title={ledger.vendor_name ?? ledger.vendor_code ?? "Vendor ledger"}
        description={`Vendor ledger · ${ledger.vendor_code ?? vendorId.slice(0, 8)}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/finance/ap" className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-border px-2.5 text-sm hover:bg-muted">
              <ArrowLeft className="size-3.5" /> AP
            </Link>
            <Button type="button" variant="outline" size="sm" className="h-8 cursor-pointer gap-1.5" onClick={() => void load()}>
              <RefreshCw className="size-3.5" /> Refresh
            </Button>
          </div>
        }
      />

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <FinanceField label="From">
          <Input type="date" className="h-8 font-mono" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
        </FinanceField>
        <FinanceField label="To">
          <Input type="date" className="h-8 font-mono" value={toDate} onChange={(e) => setToDate(e.target.value)} />
        </FinanceField>
        <FinanceField label="Apply">
          <Button type="button" size="sm" className="h-8 cursor-pointer" onClick={() => void load()}>Apply filters</Button>
        </FinanceField>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-xl border border-border/80 bg-card p-3.5 shadow-sm">
          <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Opening</p>
          <p className="mt-2 font-mono text-lg tabular-nums">{formatInrPrecise(ledger.opening_balance)}</p>
        </div>
        <div className="rounded-xl border border-border/80 bg-card p-3.5 shadow-sm">
          <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Invoices</p>
          <p className="mt-2 font-mono text-lg tabular-nums">{formatInrPrecise(ledger.invoice_total)}</p>
        </div>
        <div className="rounded-xl border border-border/80 bg-card p-3.5 shadow-sm">
          <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Payments</p>
          <p className="mt-2 font-mono text-lg tabular-nums">{formatInrPrecise(ledger.payment_total)}</p>
        </div>
        <div className="rounded-xl border border-border/80 bg-card p-3.5 shadow-sm">
          <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Adjustments</p>
          <p className="mt-2 font-mono text-lg tabular-nums">{formatInrPrecise(ledger.adjustment_total)}</p>
        </div>
        <div className="rounded-xl border border-border/80 bg-card p-3.5 shadow-sm">
          <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Closing</p>
          <p className="mt-2 font-mono text-lg tabular-nums">{formatInrPrecise(ledger.closing_balance)}</p>
        </div>
      </div>

      <div className="rounded-xl border border-border/80 bg-card shadow-sm">
        <div className="border-b border-border/70 px-3 py-2.5">
          <h3 className="text-sm font-medium tracking-tight">Ledger Lines</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border/70 bg-muted/40 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                <th className="px-2 py-2 text-left">Document</th>
                <th className="px-2 py-2 text-left">Date</th>
                <th className="px-2 py-2 text-left">Due</th>
                <th className="px-2 py-2 text-left">Type</th>
                <th className="px-2 py-2 text-right">Debit</th>
                <th className="px-2 py-2 text-right">Credit</th>
                <th className="px-2 py-2 text-right">Balance</th>
                <th className="px-2 py-2 text-right">Running</th>
                <th className="px-2 py-2 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}><td colSpan={9} className="px-2 py-2"><div className="h-6 animate-pulse rounded bg-muted/70" /></td></tr>
                ))
              ) : ledger.lines.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-10 text-center text-sm text-muted-foreground">No ledger activity in this period.</td></tr>
              ) : (
                ledger.lines.map((line) => (
                  <tr key={line.id} className="border-b border-border/50 transition-colors duration-150 hover:bg-muted/40">
                    <td className="px-2 py-1.5 font-mono text-xs">
                      <Link href={`/finance/accounts-payable/invoices/${line.id}`} className="cursor-pointer hover:underline">
                        {line.document_number}
                      </Link>
                    </td>
                    <td className="px-2 py-1.5 font-mono text-xs">{line.document_date}</td>
                    <td className="px-2 py-1.5 font-mono text-xs">{line.due_date ?? "—"}</td>
                    <td className="px-2 py-1.5 text-xs capitalize">{line.document_type}</td>
                    <td className="px-2 py-1.5 text-right font-mono text-xs tabular-nums">{formatInrPrecise(line.debit_amount)}</td>
                    <td className="px-2 py-1.5 text-right font-mono text-xs tabular-nums">{formatInrPrecise(line.credit_amount)}</td>
                    <td className="px-2 py-1.5 text-right font-mono text-xs tabular-nums">{formatInrPrecise(line.balance_amount)}</td>
                    <td className="px-2 py-1.5 text-right font-mono text-xs tabular-nums">{formatInrPrecise(line.running_balance)}</td>
                    <td className="px-2 py-1.5"><FinanceStatusBadge status={line.status} /></td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot>
              <tr className="sticky bottom-0 border-t border-border/80 bg-muted/50 text-xs font-medium">
                <td colSpan={4} className="px-2 py-2">Period totals</td>
                <td className="px-2 py-2 text-right font-mono tabular-nums">{formatInrPrecise(ledger.payment_total)}</td>
                <td className="px-2 py-2 text-right font-mono tabular-nums">{formatInrPrecise(ledger.invoice_total + ledger.adjustment_total)}</td>
                <td className="px-2 py-2 text-right font-mono tabular-nums">{formatInrPrecise(ledger.closing_balance)}</td>
                <td className="px-2 py-2 text-right font-mono tabular-nums">{formatInrPrecise(ledger.closing_balance)}</td>
                <td className="px-2 py-2" />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
