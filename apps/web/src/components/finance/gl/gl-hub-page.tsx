"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  CalendarRange,
  Landmark,
  RefreshCw,
  Scale,
  Wallet,
} from "lucide-react";

import { GlEnterpriseTable, type GlSortKey } from "@/components/finance/gl/gl-enterprise-table";
import { GlTrialBalancePreviewPanel } from "@/components/finance/gl/gl-tb-preview";
import { FinanceKpiCard } from "@/components/finance/finance-kpi-card";
import {
  FinanceField,
  FinanceSelect,
} from "@/components/finance/journals/finance-form-field";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useGlTablePrefs } from "@/hooks/use-gl-table-prefs";
import { isAuthenticated } from "@/lib/auth";
import { ApiClientError, resourceService } from "@/services/api-client";
import { formatInrPrecise } from "@/services/finance-service";
import {
  getGlSummary,
  getTrialBalancePreview,
  listGlEntries,
  type GlEntry,
  type GlSummary,
  type GlTrialBalancePreview,
} from "@/services/gl-service";

type Option = { id: string; label: string };
type Tab = "dashboard" | "inquiry";

export function GlHubPage() {
  const { prefs, setPrefs } = useGlTablePrefs();
  const [tab, setTab] = useState<Tab>("dashboard");
  const [summary, setSummary] = useState<GlSummary | null>(null);
  const [rows, setRows] = useState<GlEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [totalDebit, setTotalDebit] = useState(0);
  const [totalCredit, setTotalCredit] = useState(0);
  const [preview, setPreview] = useState<GlTrialBalancePreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(prefs.pageSize || 25);
  const [q, setQ] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [status, setStatus] = useState("");
  const [fiscalYearId, setFiscalYearId] = useState("");
  const [periodId, setPeriodId] = useState("");
  const [accountId, setAccountId] = useState("");
  const [currency, setCurrency] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [sortBy, setSortBy] = useState<GlSortKey>("entry_date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [fiscalYears, setFiscalYears] = useState<Option[]>([]);
  const [periods, setPeriods] = useState<Option[]>([]);
  const [accounts, setAccounts] = useState<Option[]>([]);

  const authenticated = typeof window !== "undefined" ? isAuthenticated() : false;

  const loadLookups = useCallback(async () => {
    const results = await Promise.allSettled([
      resourceService.list("/finance/fiscal-years"),
      resourceService.list("/finance/periods"),
      resourceService.list("/finance/chart-of-accounts"),
    ]);
    if (results[0].status === "fulfilled") {
      const data = results[0].value.data;
      const list = Array.isArray(data) ? data : (data as { items?: unknown[] })?.items ?? [];
      setFiscalYears(
        list.map((row) => {
          const r = row as Record<string, unknown>;
          return { id: String(r.id), label: String(r.fiscal_year_code ?? r.id) };
        }),
      );
    }
    if (results[1].status === "fulfilled") {
      const data = results[1].value.data;
      const list = Array.isArray(data) ? data : (data as { items?: unknown[] })?.items ?? [];
      setPeriods(
        list.map((row) => {
          const r = row as Record<string, unknown>;
          return { id: String(r.id), label: String(r.period_name ?? r.period_number ?? r.id) };
        }),
      );
    }
    if (results[2].status === "fulfilled") {
      const data = results[2].value.data;
      const list = Array.isArray(data) ? data : (data as { items?: unknown[] })?.items ?? [];
      setAccounts(
        list.map((row) => {
          const r = row as Record<string, unknown>;
          return { id: String(r.id), label: `${r.account_code} · ${r.account_name}` };
        }),
      );
    }
  }, []);

  const loadSummary = useCallback(async () => {
    setSummary(await getGlSummary());
  }, []);

  const loadList = useCallback(async () => {
    const data = await listGlEntries({
      page,
      page_size: pageSize,
      q: q || undefined,
      status: status || undefined,
      fiscal_year_id: fiscalYearId || undefined,
      period_id: periodId || undefined,
      account_id: accountId || undefined,
      currency_code: currency || undefined,
      from_date: fromDate || undefined,
      to_date: toDate || undefined,
      sort_by: sortBy,
      sort_dir: sortDir,
      paged: true,
      running_balance: Boolean(accountId),
    });
    setRows(data.items);
    setTotal(data.total);
    setTotalDebit(data.total_debit);
    setTotalCredit(data.total_credit);
  }, [page, pageSize, q, status, fiscalYearId, periodId, accountId, currency, fromDate, toDate, sortBy, sortDir]);

  const loadPreview = useCallback(async () => {
    if (!fiscalYearId && !periodId && !fromDate) {
      setPreview(null);
      return;
    }
    setPreviewLoading(true);
    try {
      setPreview(
        await getTrialBalancePreview({
          fiscal_year_id: fiscalYearId || undefined,
          period_id: periodId || undefined,
          from_date: fromDate || undefined,
          to_date: toDate || undefined,
        }),
      );
    } catch {
      setPreview(null);
    } finally {
      setPreviewLoading(false);
    }
  }, [fiscalYearId, periodId, fromDate, toDate]);

  const load = useCallback(async () => {
    if (!authenticated) {
      setLoading(false);
      setError("Sign in to view the general ledger.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await loadLookups();
      const tasks: Promise<unknown>[] = [loadSummary()];
      if (tab === "inquiry" || tab === "dashboard") tasks.push(loadList());
      await Promise.all(tasks);
      await loadPreview();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to load general ledger");
    } finally {
      setLoading(false);
    }
  }, [authenticated, tab, loadLookups, loadSummary, loadList, loadPreview]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPrefs((p) => ({ ...p, pageSize }));
  }, [pageSize, setPrefs]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "/" && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        document.getElementById("gl-search")?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const filteredPeriods = fiscalYearId
    ? periods
    : periods;

  return (
    <div className="space-y-4">
      <PageHeader
        title="General Ledger"
        description="Enterprise posted ledger inquiry with account drill-down."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" className="h-8 cursor-pointer gap-1.5" onClick={() => void load()}>
              <RefreshCw className="size-3.5" /> Refresh
            </Button>
            <Link href="/finance/journals" className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-border px-2.5 text-sm hover:bg-muted">
              Journals
            </Link>
          </div>
        }
      />

      <div className="flex flex-wrap gap-1 rounded-lg border border-border/70 bg-muted/30 p-1">
        {([["dashboard", "Dashboard"], ["inquiry", "Ledger Inquiry"]] as const).map(([key, label]) => (
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

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
        <FinanceField label="Search" className="sm:col-span-2">
          <div className="flex gap-2">
            <Input
              id="gl-search"
              className="h-8"
              value={searchInput}
              placeholder="Voucher, account, description… (/)"
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
        <FinanceField label="From">
          <Input type="date" className="h-8 font-mono" value={fromDate} onChange={(e) => { setPage(1); setFromDate(e.target.value); }} />
        </FinanceField>
        <FinanceField label="To">
          <Input type="date" className="h-8 font-mono" value={toDate} onChange={(e) => { setPage(1); setToDate(e.target.value); }} />
        </FinanceField>
        <FinanceField label="Fiscal Year">
          <FinanceSelect value={fiscalYearId} onChange={(e) => { setPage(1); setFiscalYearId(e.target.value); }}>
            <option value="">All</option>
            {fiscalYears.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </FinanceSelect>
        </FinanceField>
        <FinanceField label="Period">
          <FinanceSelect value={periodId} onChange={(e) => { setPage(1); setPeriodId(e.target.value); }}>
            <option value="">All</option>
            {filteredPeriods.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </FinanceSelect>
        </FinanceField>
        <FinanceField label="Account" className="sm:col-span-2">
          <FinanceSelect value={accountId} onChange={(e) => { setPage(1); setAccountId(e.target.value); }}>
            <option value="">All accounts</option>
            {accounts.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </FinanceSelect>
        </FinanceField>
        <FinanceField label="Currency">
          <Input className="h-8 font-mono uppercase" maxLength={3} value={currency} onChange={(e) => { setPage(1); setCurrency(e.target.value.toUpperCase()); }} placeholder="INR" />
        </FinanceField>
        <FinanceField label="Journal Status">
          <FinanceSelect value={status} onChange={(e) => { setPage(1); setStatus(e.target.value); }}>
            <option value="">All</option>
            <option value="posted">Posted</option>
            <option value="draft">Draft</option>
            <option value="submitted">Submitted</option>
            <option value="approved">Approved</option>
            <option value="reversed">Reversed</option>
            <option value="cancelled">Cancelled</option>
          </FinanceSelect>
        </FinanceField>
      </div>

      {error ? (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          <span>{error}</span>
          <Button type="button" size="sm" variant="outline" className="h-8 cursor-pointer" onClick={() => void load()}>Retry</Button>
        </div>
      ) : null}

      {tab === "dashboard" ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <FinanceKpiCard label="Total Accounts" value={String(summary?.total_accounts ?? "—")} icon={Landmark} />
            <FinanceKpiCard label="Active Ledger Accounts" value={String(summary?.active_ledger_accounts ?? "—")} icon={BookOpen} tone="success" />
            <FinanceKpiCard label="Total Debits" value={summary ? formatInrPrecise(summary.total_debits) : "—"} icon={Wallet} />
            <FinanceKpiCard label="Total Credits" value={summary ? formatInrPrecise(summary.total_credits) : "—"} icon={Wallet} />
            <FinanceKpiCard label="Current Balance" value={summary ? formatInrPrecise(summary.current_balance) : "—"} icon={Scale} hint="Debits − Credits (posted GL)" />
            <FinanceKpiCard label="Today's Transactions" value={String(summary?.todays_transactions ?? "—")} icon={BookOpen} />
            <FinanceKpiCard label="Current Fiscal Year" value={summary?.current_fiscal_year_code ?? "—"} icon={CalendarRange} />
            <FinanceKpiCard label="Current Period" value={summary?.current_period_name ?? "—"} icon={CalendarRange} />
          </div>
          <GlTrialBalancePreviewPanel preview={preview} loading={previewLoading} />
          <div className="rounded-xl border border-border/80 bg-card p-3.5 shadow-sm">
            <h3 className="text-sm font-medium tracking-tight">Recent Ledger Activity</h3>
            {loading && rows.length === 0 ? (
              <div className="mt-3 space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-8 animate-pulse rounded bg-muted/70" />)}</div>
            ) : rows.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">No posted GL entries yet.</p>
            ) : (
              <ul className="mt-3 divide-y divide-border/60">
                {rows.slice(0, 8).map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                    <Link href={`/finance/general-ledger/${r.id}`} className="cursor-pointer hover:underline">
                      <span className="font-mono text-xs text-muted-foreground">{r.entry_number}</span>
                      <span className="mx-1.5 text-muted-foreground/40">·</span>
                      {r.account_code} {r.account_name ? `· ${r.account_name}` : ""}
                    </Link>
                    <span className="font-mono text-xs tabular-nums text-muted-foreground">
                      {formatInrPrecise(r.base_debit_amount || r.base_credit_amount)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}

      {tab === "inquiry" ? (
        <div className="space-y-4">
          <GlEnterpriseTable
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
            totalDebit={totalDebit}
            totalCredit={totalCredit}
            onPageChange={setPage}
            onPageSizeChange={(s) => { setPage(1); setPageSize(s); }}
          />
          <GlTrialBalancePreviewPanel preview={preview} loading={previewLoading} />
        </div>
      ) : null}
    </div>
  );
}
