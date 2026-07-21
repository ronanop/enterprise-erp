"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  Banknote,
  Clock,
  Coins,
  Plus,
  RefreshCw,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";

import { ApAgingPanel } from "@/components/finance/ap/ap-aging-panel";
import { ApAllocateDialog } from "@/components/finance/ap/ap-allocate-dialog";
import { ApInvoiceFormDialog } from "@/components/finance/ap/ap-invoice-form-dialog";
import { ApInvoiceTable, type ApSortKey } from "@/components/finance/ap/ap-invoice-table";
import { ApPaymentDialog } from "@/components/finance/ap/ap-payment-dialog";
import { FinanceKpiCard } from "@/components/finance/finance-kpi-card";
import {
  FinanceField,
  FinanceSelect,
} from "@/components/finance/journals/finance-form-field";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useApTablePrefs } from "@/hooks/use-ap-table-prefs";
import { useUserPermissions } from "@/hooks/use-user-permissions";
import { isAuthenticated } from "@/lib/auth";
import { ApiClientError, resourceService } from "@/services/api-client";
import {
  getApAging,
  getApSummary,
  listApEntries,
  type ApEntry,
  type ApSummary,
  type ApAgingReport,
} from "@/services/ap-service";
import { formatInrPrecise } from "@/services/finance-service";

type Option = { id: string; label: string };
type Tab = "dashboard" | "invoices" | "payments" | "aging";

export function ApHubPage() {
  const { prefs, setPrefs } = useApTablePrefs();
  const { can } = useUserPermissions();
  const canCreate = can("finance.ap:create");
  const canPayment = can("finance.ap:payment");

  const [tab, setTab] = useState<Tab>("dashboard");
  const [summary, setSummary] = useState<ApSummary | null>(null);
  const [agingReport, setAgingReport] = useState<ApAgingReport | null>(null);
  const [rows, setRows] = useState<ApEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [totalOutstanding, setTotalOutstanding] = useState(0);
  const [totalPaid, setTotalPaid] = useState(0);
  const [totalBalance, setTotalBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [agingLoading, setAgingLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(prefs.pageSize || 25);
  const [q, setQ] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [status, setStatus] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [currency, setCurrency] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [dueFrom, setDueFrom] = useState("");
  const [dueTo, setDueTo] = useState("");
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [sortBy, setSortBy] = useState<ApSortKey>("document_date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [asOf, setAsOf] = useState(new Date().toISOString().slice(0, 10));
  const [vendors, setVendors] = useState<Option[]>([]);

  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [allocateDialogOpen, setAllocateDialogOpen] = useState(false);

  const authenticated = typeof window !== "undefined" ? isAuthenticated() : false;

  const loadLookups = useCallback(async () => {
    const res = await resourceService.list("/vendors").catch(() => ({ data: [] }));
    const data = res.data;
    const list = Array.isArray(data) ? data : (data as { items?: unknown[] })?.items ?? [];
    setVendors(
      list.map((row) => {
        const r = row as Record<string, unknown>;
        return { id: String(r.id), label: String(r.vendor_name ?? r.name ?? r.vendor_code ?? r.id) };
      }),
    );
  }, []);

  const listDocumentType = tab === "payments" ? "payment" : tab === "invoices" ? "invoice" : undefined;

  const loadList = useCallback(async () => {
    const data = await listApEntries({
      page,
      page_size: pageSize,
      q: q || undefined,
      status: status || undefined,
      vendor_id: vendorId || undefined,
      currency_code: currency || undefined,
      from_date: fromDate || undefined,
      to_date: toDate || undefined,
      due_from: dueFrom || undefined,
      due_to: dueTo || undefined,
      overdue_only: overdueOnly || undefined,
      document_type: listDocumentType,
      sort_by: sortBy,
      sort_dir: sortDir,
      paged: true,
    });
    setRows(data.items);
    setTotal(data.total);
    setTotalOutstanding(data.total_outstanding);
    setTotalPaid(data.total_paid);
    setTotalBalance(data.total_balance);
  }, [page, pageSize, q, status, vendorId, currency, fromDate, toDate, dueFrom, dueTo, overdueOnly, listDocumentType, sortBy, sortDir]);

  const loadSummary = useCallback(async () => {
    setSummary(await getApSummary());
  }, []);

  const loadAging = useCallback(async () => {
    setAgingLoading(true);
    try {
      setAgingReport(await getApAging(asOf));
    } catch {
      setAgingReport(null);
    } finally {
      setAgingLoading(false);
    }
  }, [asOf]);

  const load = useCallback(async () => {
    if (!authenticated) {
      setLoading(false);
      setError("Sign in to view accounts payable.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await loadLookups();
      const tasks: Promise<unknown>[] = [loadSummary()];
      if (tab === "dashboard" || tab === "invoices" || tab === "payments") tasks.push(loadList());
      if (tab === "dashboard" || tab === "aging") tasks.push(loadAging());
      await Promise.all(tasks);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to load accounts payable");
    } finally {
      setLoading(false);
    }
  }, [authenticated, tab, loadLookups, loadSummary, loadList, loadAging]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPrefs((p) => ({ ...p, pageSize }));
  }, [pageSize, setPrefs]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isInput = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
      if ((e.key === "/" || e.key === "i") && !isInput) {
        e.preventDefault();
        document.getElementById("ap-search")?.focus();
      }
      if (e.key === "n" && !isInput && canCreate) {
        e.preventDefault();
        setInvoiceDialogOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canCreate]);

  const refreshAll = () => void load();

  return (
    <div className="space-y-4">
      <PageHeader
        title="Accounts Payable"
        description="Vendor invoices, payments, aging, and cash requirements."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" className="h-8 cursor-pointer gap-1.5" onClick={refreshAll}>
              <RefreshCw className="size-3.5" /> Refresh
            </Button>
            {canCreate ? (
              <Button type="button" size="sm" className="h-8 cursor-pointer gap-1.5" onClick={() => setInvoiceDialogOpen(true)}>
                <Plus className="size-3.5" /> Invoice
              </Button>
            ) : null}
            {canPayment ? (
              <>
                <Button type="button" variant="outline" size="sm" className="h-8 cursor-pointer gap-1.5" onClick={() => setPaymentDialogOpen(true)}>
                  <Banknote className="size-3.5" /> Payment
                </Button>
                <Button type="button" variant="outline" size="sm" className="h-8 cursor-pointer gap-1.5" onClick={() => setAllocateDialogOpen(true)}>
                  Allocate
                </Button>
              </>
            ) : null}
            <Link href="/finance/journals" className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-border px-2.5 text-sm hover:bg-muted">
              Journals
            </Link>
          </div>
        }
      />

      <div className="flex flex-wrap gap-1 rounded-lg border border-border/70 bg-muted/30 p-1">
        {([["dashboard", "Dashboard"], ["invoices", "Invoices"], ["payments", "Payments"], ["aging", "Aging"]] as const).map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={`h-8 cursor-pointer rounded-md px-3 text-xs font-medium transition-colors duration-200 ${tab === key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {(tab === "invoices" || tab === "payments" || tab === "dashboard") ? (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
          <FinanceField label="Search" className="sm:col-span-2">
            <div className="flex gap-2">
              <Input
                id="ap-search"
                className="h-8"
                value={searchInput}
                placeholder="Invoice, vendor… (i or /)"
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    setPage(1);
                    setQ(searchInput.trim());
                  }
                }}
              />
              <Button type="button" size="sm" className="h-8 cursor-pointer" onClick={() => { setPage(1); setQ(searchInput.trim()); }}>Search</Button>
            </div>
          </FinanceField>
          <FinanceField label="Vendor">
            <FinanceSelect value={vendorId} onChange={(e) => { setPage(1); setVendorId(e.target.value); }}>
              <option value="">All</option>
              {vendors.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </FinanceSelect>
          </FinanceField>
          <FinanceField label="From">
            <Input type="date" className="h-8 font-mono" value={fromDate} onChange={(e) => { setPage(1); setFromDate(e.target.value); }} />
          </FinanceField>
          <FinanceField label="To">
            <Input type="date" className="h-8 font-mono" value={toDate} onChange={(e) => { setPage(1); setToDate(e.target.value); }} />
          </FinanceField>
          <FinanceField label="Due from">
            <Input type="date" className="h-8 font-mono" value={dueFrom} onChange={(e) => { setPage(1); setDueFrom(e.target.value); }} />
          </FinanceField>
          <FinanceField label="Due to">
            <Input type="date" className="h-8 font-mono" value={dueTo} onChange={(e) => { setPage(1); setDueTo(e.target.value); }} />
          </FinanceField>
          <FinanceField label="Currency">
            <Input className="h-8 font-mono uppercase" maxLength={3} value={currency} onChange={(e) => { setPage(1); setCurrency(e.target.value.toUpperCase()); }} placeholder="INR" />
          </FinanceField>
          <FinanceField label="Status">
            <FinanceSelect value={status} onChange={(e) => { setPage(1); setStatus(e.target.value); }}>
              <option value="">All</option>
              <option value="draft">Draft</option>
              <option value="open">Open</option>
              <option value="partial">Partial</option>
              <option value="paid">Paid</option>
              <option value="cancelled">Cancelled</option>
              <option value="reversed">Reversed</option>
            </FinanceSelect>
          </FinanceField>
          <FinanceField label="Overdue only">
            <label className="flex h-8 cursor-pointer items-center gap-2 text-sm">
              <input type="checkbox" checked={overdueOnly} onChange={(e) => { setPage(1); setOverdueOnly(e.target.checked); }} />
              Overdue
            </label>
          </FinanceField>
        </div>
      ) : null}

      {tab === "aging" ? (
        <FinanceField label="As of date" className="max-w-xs">
          <Input type="date" className="h-8 font-mono" value={asOf} onChange={(e) => setAsOf(e.target.value)} />
        </FinanceField>
      ) : null}

      {error ? (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          <span>{error}</span>
          <Button type="button" size="sm" variant="outline" className="h-8 cursor-pointer" onClick={refreshAll}>Retry</Button>
        </div>
      ) : null}

      {tab === "dashboard" ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <FinanceKpiCard label="Outstanding Payables" value={summary ? formatInrPrecise(summary.outstanding_payables) : "—"} icon={Wallet} />
            <FinanceKpiCard
              label="Payments Due Today"
              value={summary ? formatInrPrecise(summary.payments_due_today) : "—"}
              icon={Banknote}
              hint={summary ? `${summary.payments_due_today_count} bills` : undefined}
            />
            <FinanceKpiCard label="Overdue Bills" value={String(summary?.overdue_bills ?? "—")} icon={AlertCircle} hint={summary ? formatInrPrecise(summary.overdue_amount) : undefined} />
            <FinanceKpiCard label="Current Month Payments" value={summary ? formatInrPrecise(summary.current_month_payments) : "—"} icon={TrendingUp} />
            <FinanceKpiCard label="Vendor Count" value={String(summary?.vendor_count ?? "—")} icon={Users} />
            <FinanceKpiCard label="Payment Efficiency" value={summary ? `${summary.payment_efficiency.toFixed(1)}%` : "—"} icon={Clock} />
            <FinanceKpiCard label="Cash Requirement" value={summary ? formatInrPrecise(summary.cash_requirement) : "—"} icon={Coins} />
            <FinanceKpiCard label="Open Invoices" value={String(summary?.open_invoice_count ?? "—")} icon={Wallet} />
            <FinanceKpiCard label="Payments" value={String(summary?.payment_count ?? "—")} icon={Banknote} />
          </div>

          {summary?.aging && summary.aging.length > 0 ? (
            <div className="rounded-xl border border-border/80 bg-card p-3.5 shadow-sm">
              <h3 className="text-sm font-medium tracking-tight">Aging Summary</h3>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {summary.aging.map((b) => (
                  <div key={b.bucket} className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
                    <p className="text-[11px] text-muted-foreground uppercase">{b.bucket}</p>
                    <p className="font-mono text-sm tabular-nums">{formatInrPrecise(b.amount)}</p>
                    <p className="text-xs text-muted-foreground">{b.count} items</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <ApAgingPanel report={agingReport} loading={agingLoading} />

          <div className="rounded-xl border border-border/80 bg-card p-3.5 shadow-sm">
            <h3 className="text-sm font-medium tracking-tight">Recent Invoices</h3>
            {loading && rows.length === 0 ? (
              <div className="mt-3 space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-8 animate-pulse rounded bg-muted/70" />)}</div>
            ) : rows.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">No AP invoices yet.</p>
            ) : (
              <ul className="mt-3 divide-y divide-border/60">
                {rows.slice(0, 8).map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                    <Link href={`/finance/accounts-payable/invoices/${r.id}`} className="cursor-pointer hover:underline">
                      <span className="font-mono text-xs text-muted-foreground">{r.document_number}</span>
                      <span className="mx-1.5 text-muted-foreground/40">·</span>
                      {r.vendor_name ?? r.vendor_code ?? "Vendor"}
                    </Link>
                    <span className="font-mono text-xs tabular-nums text-muted-foreground">
                      {formatInrPrecise(r.balance_amount)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}

      {tab === "invoices" || tab === "payments" ? (
        <ApInvoiceTable
          rows={rows}
          loading={loading}
          sortBy={sortBy}
          sortDir={sortDir}
          onSort={(key) => {
            if (sortBy === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
            else {
              setSortBy(key);
              setSortDir("asc");
            }
          }}
          page={page}
          pageSize={pageSize}
          total={total}
          totalOutstanding={totalOutstanding}
          totalPaid={totalPaid}
          totalBalance={totalBalance}
          onPageChange={setPage}
          onPageSizeChange={(s) => { setPage(1); setPageSize(s); }}
          exportTitle={tab === "payments" ? "AP Payments" : "AP Invoices"}
        />
      ) : null}

      {tab === "aging" ? (
        <ApAgingPanel report={agingReport} loading={agingLoading || loading} />
      ) : null}

      <ApInvoiceFormDialog open={invoiceDialogOpen} onClose={() => setInvoiceDialogOpen(false)} onSaved={refreshAll} />
      <ApPaymentDialog open={paymentDialogOpen} onClose={() => setPaymentDialogOpen(false)} onSaved={refreshAll} />
      <ApAllocateDialog open={allocateDialogOpen} onClose={() => setAllocateDialogOpen(false)} onSaved={refreshAll} />
    </div>
  );
}
