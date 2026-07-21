"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, RefreshCw } from "lucide-react";

import { FinanceStatusBadge } from "@/components/finance/finance-status-badge";
import {
  FinanceField,
  FinanceSelect,
} from "@/components/finance/journals/finance-form-field";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiClientError, resourceService } from "@/services/api-client";
import { formatInrPrecise } from "@/services/finance-service";
import {
  getAccountLedger,
  type GlAccountLedger,
} from "@/services/gl-service";

type Option = { id: string; label: string };

export function GlAccountLedgerPage({ accountId }: { accountId: string }) {
  const [ledger, setLedger] = useState<GlAccountLedger | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [fiscalYearId, setFiscalYearId] = useState("");
  const [periodId, setPeriodId] = useState("");
  const [fiscalYears, setFiscalYears] = useState<Option[]>([]);
  const [periods, setPeriods] = useState<Option[]>([]);

  const loadLookups = useCallback(async () => {
    const [fy, per] = await Promise.allSettled([
      resourceService.list("/finance/fiscal-years"),
      resourceService.list("/finance/periods"),
    ]);
    if (fy.status === "fulfilled") {
      const data = fy.value.data;
      const list = Array.isArray(data) ? data : (data as { items?: unknown[] })?.items ?? [];
      setFiscalYears(list.map((row) => {
        const r = row as Record<string, unknown>;
        return { id: String(r.id), label: String(r.fiscal_year_code ?? r.id) };
      }));
    }
    if (per.status === "fulfilled") {
      const data = per.value.data;
      const list = Array.isArray(data) ? data : (data as { items?: unknown[] })?.items ?? [];
      setPeriods(list.map((row) => {
        const r = row as Record<string, unknown>;
        return { id: String(r.id), label: String(r.period_name ?? r.id) };
      }));
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await loadLookups();
      const data = await getAccountLedger(accountId, {
        from_date: fromDate || undefined,
        to_date: toDate || undefined,
        fiscal_year_id: fiscalYearId || undefined,
        period_id: periodId || undefined,
      });
      setLedger(data);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to load account ledger");
    } finally {
      setLoading(false);
    }
  }, [accountId, fromDate, toDate, fiscalYearId, periodId, loadLookups]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !ledger) {
    return <div className="space-y-3"><div className="h-10 animate-pulse rounded-lg bg-muted/70" /><div className="h-64 animate-pulse rounded-xl bg-muted/70" /></div>;
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
        title={`${ledger.account_code} · ${ledger.account_name}`}
        description={`Account ledger · ${ledger.account_type} · ${ledger.normal_balance} balance`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/finance/gl" className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-border px-2.5 text-sm hover:bg-muted">
              <ArrowLeft className="size-3.5" /> GL
            </Link>
            <Link href={`/finance/chart-of-accounts/${ledger.account_id}`} className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-border px-2.5 text-sm hover:bg-muted">
              COA
            </Link>
            <Button type="button" variant="outline" size="sm" className="h-8 cursor-pointer gap-1.5" onClick={() => void load()}>
              <RefreshCw className="size-3.5" /> Refresh
            </Button>
            <FinanceStatusBadge status={ledger.status} />
          </div>
        }
      />

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <FinanceField label="From"><Input type="date" className="h-8 font-mono" value={fromDate} onChange={(e) => setFromDate(e.target.value)} /></FinanceField>
        <FinanceField label="To"><Input type="date" className="h-8 font-mono" value={toDate} onChange={(e) => setToDate(e.target.value)} /></FinanceField>
        <FinanceField label="Fiscal Year">
          <FinanceSelect value={fiscalYearId} onChange={(e) => setFiscalYearId(e.target.value)}>
            <option value="">All</option>
            {fiscalYears.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </FinanceSelect>
        </FinanceField>
        <FinanceField label="Period">
          <FinanceSelect value={periodId} onChange={(e) => setPeriodId(e.target.value)}>
            <option value="">All</option>
            {periods.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </FinanceSelect>
        </FinanceField>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border/80 bg-card p-3.5 shadow-sm">
          <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Opening Balance</p>
          <p className="mt-2 font-mono text-xl tabular-nums">{formatInrPrecise(ledger.opening_balance)}</p>
        </div>
        <div className="rounded-xl border border-border/80 bg-card p-3.5 shadow-sm">
          <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Debit Total</p>
          <p className="mt-2 font-mono text-xl tabular-nums">{formatInrPrecise(ledger.debit_total)}</p>
        </div>
        <div className="rounded-xl border border-border/80 bg-card p-3.5 shadow-sm">
          <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Credit Total</p>
          <p className="mt-2 font-mono text-xl tabular-nums">{formatInrPrecise(ledger.credit_total)}</p>
        </div>
        <div className="rounded-xl border border-border/80 bg-card p-3.5 shadow-sm">
          <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Closing Balance</p>
          <p className="mt-2 font-mono text-xl tabular-nums">{formatInrPrecise(ledger.closing_balance)}</p>
        </div>
      </div>

      <div className="rounded-xl border border-border/80 bg-card p-3.5 shadow-sm">
        <h3 className="text-sm font-medium tracking-tight">Monthly Summary</h3>
        {ledger.monthly_summary.length === 0 ? (
          <p className="mt-2 text-xs text-muted-foreground">No monthly activity in range.</p>
        ) : (
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className="border-b border-border/70 text-[11px] text-muted-foreground uppercase">
                  <th className="px-2 py-1.5 text-left">Month</th>
                  <th className="px-2 py-1.5 text-right">Debit</th>
                  <th className="px-2 py-1.5 text-right">Credit</th>
                  <th className="px-2 py-1.5 text-right">Net</th>
                </tr>
              </thead>
              <tbody>
                {ledger.monthly_summary.map((m) => (
                  <tr key={m.label} className="border-b border-border/40">
                    <td className="px-2 py-1.5">{m.label}</td>
                    <td className="px-2 py-1.5 text-right font-mono text-xs tabular-nums">{formatInrPrecise(m.debit_total)}</td>
                    <td className="px-2 py-1.5 text-right font-mono text-xs tabular-nums">{formatInrPrecise(m.credit_total)}</td>
                    <td className="px-2 py-1.5 text-right font-mono text-xs tabular-nums">{formatInrPrecise(m.net)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border/80 bg-card shadow-sm">
        <div className="border-b border-border/70 px-3 py-2.5">
          <h3 className="text-sm font-medium tracking-tight">Running Balance</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-sm">
            <thead>
              <tr className="border-b border-border/70 bg-muted/40 text-[11px] text-muted-foreground uppercase">
                <th className="px-2 py-2 text-left">Date</th>
                <th className="px-2 py-2 text-left">Voucher</th>
                <th className="px-2 py-2 text-left">Journal</th>
                <th className="px-2 py-2 text-left">Description</th>
                <th className="px-2 py-2 text-right">Debit</th>
                <th className="px-2 py-2 text-right">Credit</th>
                <th className="px-2 py-2 text-right">Balance</th>
              </tr>
            </thead>
            <tbody>
              {ledger.lines.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-muted-foreground">No movements in selected range.</td></tr>
              ) : (
                ledger.lines.map((line) => (
                  <tr key={line.id ?? `${line.entry_number}-${line.entry_date}`} className="border-b border-border/40 hover:bg-muted/40">
                    <td className="px-2 py-1.5 font-mono text-xs">{line.entry_date}</td>
                    <td className="px-2 py-1.5 font-mono text-xs">
                      {line.id ? <Link href={`/finance/general-ledger/${line.id}`} className="cursor-pointer hover:underline">{line.entry_number}</Link> : line.entry_number}
                    </td>
                    <td className="px-2 py-1.5 font-mono text-xs">
                      {line.journal_header_id ? (
                        <Link href={`/finance/journals/${line.journal_header_id}`} className="cursor-pointer hover:underline">{line.journal_number ?? "—"}</Link>
                      ) : (line.journal_number ?? "—")}
                    </td>
                    <td className="px-2 py-1.5 text-xs text-muted-foreground">{line.description ?? "—"}</td>
                    <td className="px-2 py-1.5 text-right font-mono text-xs tabular-nums">{formatInrPrecise(line.debit_amount)}</td>
                    <td className="px-2 py-1.5 text-right font-mono text-xs tabular-nums">{formatInrPrecise(line.credit_amount)}</td>
                    <td className="px-2 py-1.5 text-right font-mono text-xs tabular-nums">{formatInrPrecise(line.running_balance)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl border border-border/80 bg-card p-3.5 shadow-sm">
        <h3 className="text-sm font-medium tracking-tight">Related Journals</h3>
        {ledger.related_journal_ids.length === 0 ? (
          <p className="mt-2 text-xs text-muted-foreground">No related journals.</p>
        ) : (
          <ul className="mt-2 flex flex-wrap gap-2">
            {ledger.related_journal_ids.map((id) => (
              <li key={id}>
                <Link href={`/finance/journals/${id}`} className="cursor-pointer rounded-md border border-border/70 px-2 py-1 font-mono text-xs hover:bg-muted/50">
                  {id.slice(0, 8)}…
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
