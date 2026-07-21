"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CalendarRange, Lock, Plus, RefreshCw, Unlock } from "lucide-react";

import { FiscalEnterpriseTable, type FiscalSortKey } from "@/components/finance/fiscal/fiscal-enterprise-table";
import { FiscalImportPanel } from "@/components/finance/fiscal/fiscal-import-panel";
import { PeriodCalendarView } from "@/components/finance/fiscal/period-calendar";
import { PeriodEnterpriseTable } from "@/components/finance/fiscal/period-enterprise-table";
import { FinanceKpiCard } from "@/components/finance/finance-kpi-card";
import { FinanceField, FinanceSelect } from "@/components/finance/journals/finance-form-field";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useFiscalTablePrefs } from "@/hooks/use-fiscal-table-prefs";
import { useUserDirectory } from "@/hooks/use-user-directory";
import { isAuthenticated } from "@/lib/auth";
import { ApiClientError } from "@/services/api-client";
import {
  bulkPeriodAction,
  getFiscalSummary,
  listFiscalYears,
  listPeriods,
  runPeriodAction,
  type AccountingPeriod,
  type FiscalSummary,
  type FiscalYear,
} from "@/services/fiscal-service";

type Tab = "dashboard" | "years" | "periods" | "calendar";

type Props = { initialTab?: Tab };

export function FiscalHubPage({ initialTab = "dashboard" }: Props) {
  const { resolve } = useUserDirectory();
  const { prefs, setPrefs } = useFiscalTablePrefs();
  const [tab, setTab] = useState<Tab>(initialTab);
  const [summary, setSummary] = useState<FiscalSummary | null>(null);
  const [years, setYears] = useState<FiscalYear[]>([]);
  const [total, setTotal] = useState(0);
  const [periods, setPeriods] = useState<AccountingPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(prefs.pageSize || 25);
  const [q, setQ] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [status, setStatus] = useState("");
  const [fyFilter, setFyFilter] = useState("");
  const [sortBy, setSortBy] = useState<FiscalSortKey>("start_date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [selectedYearIds, setSelectedYearIds] = useState<Set<string>>(new Set());
  const [selectedPeriodIds, setSelectedPeriodIds] = useState<Set<string>>(new Set());
  const [periodBusy, setPeriodBusy] = useState(false);

  const authenticated = typeof window !== "undefined" ? isAuthenticated() : false;

  const loadSummary = useCallback(async () => {
    setSummary(await getFiscalSummary());
  }, []);

  const loadYears = useCallback(async () => {
    const data = await listFiscalYears({
      page,
      page_size: pageSize,
      q: q || undefined,
      status: status || undefined,
      sort_by: sortBy,
      sort_dir: sortDir,
      paged: true,
    });
    setYears(data.items);
    setTotal(data.total);
  }, [page, pageSize, q, status, sortBy, sortDir]);

  const loadPeriods = useCallback(async () => {
    const data = await listPeriods({
      fiscal_year_id: fyFilter || undefined,
      paged: false,
      page_size: 100,
    });
    setPeriods(data.items);
  }, [fyFilter]);

  const load = useCallback(async () => {
    if (!authenticated) {
      setLoading(false);
      setError("Sign in to manage fiscal calendar.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const tasks: Promise<unknown>[] = [loadSummary()];
      if (tab === "dashboard" || tab === "years") tasks.push(loadYears());
      if (tab === "dashboard" || tab === "periods" || tab === "calendar") tasks.push(loadPeriods());
      await Promise.all(tasks);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to load fiscal data");
    } finally {
      setLoading(false);
    }
  }, [authenticated, tab, loadSummary, loadYears, loadPeriods]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { setPrefs((p) => ({ ...p, pageSize })); }, [pageSize, setPrefs]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "/" && !(e.target instanceof HTMLInputElement)) {
        e.preventDefault();
        document.getElementById("fiscal-search")?.focus();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "n") {
        e.preventDefault();
        window.location.href = "/finance/fiscal-years/new";
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const fyOptions = useMemo(() => years.map((y) => ({ id: y.id, label: `${y.fiscal_year_code} · ${y.fiscal_year_name}` })), [years]);

  const handlePeriodAction = async (action: string, ids: string[]) => {
    setPeriodBusy(true);
    try {
      if (ids.length === 1) await runPeriodAction(ids[0], action as "open" | "close" | "lock" | "unlock" | "reopen");
      else await bulkPeriodAction(ids, action as "open" | "close" | "lock" | "unlock" | "reopen");
      await load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Period action failed");
    } finally {
      setPeriodBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Fiscal Calendar"
        description="Enterprise fiscal years and accounting period management."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" className="h-8 cursor-pointer gap-1.5" onClick={() => void load()}><RefreshCw className="size-3.5" /> Refresh</Button>
            <Link href="/finance/fiscal-years/new" className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/80"><Plus className="size-3.5" /> New Fiscal Year</Link>
          </div>
        }
      />

      <div className="flex flex-wrap gap-1 rounded-lg border border-border/70 bg-muted/30 p-1">
        {([["dashboard", "Dashboard"], ["years", "Fiscal Years"], ["periods", "Periods"], ["calendar", "Calendar"]] as const).map(([key, label]) => (
          <button key={key} type="button" className={`h-8 cursor-pointer rounded-md px-3 text-xs font-medium transition-colors ${tab === key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`} onClick={() => setTab(key)}>{label}</button>
        ))}
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <FinanceField label="Search" className="sm:col-span-2">
          <div className="flex gap-2">
            <Input id="fiscal-search" className="h-8" value={searchInput} placeholder="Code or name… (/) " onChange={(e) => setSearchInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { setPage(1); setQ(searchInput.trim()); } }} />
            <Button type="button" size="sm" className="h-8 cursor-pointer" onClick={() => { setPage(1); setQ(searchInput.trim()); }}>Search</Button>
          </div>
        </FinanceField>
        <FinanceField label="Year Status">
          <FinanceSelect value={status} onChange={(e) => { setPage(1); setStatus(e.target.value); }}>
            <option value="">All</option>
            <option value="open">Open</option>
            <option value="closed">Closed</option>
            <option value="archived">Archived</option>
          </FinanceSelect>
        </FinanceField>
        <FinanceField label="Fiscal Year (Periods)">
          <FinanceSelect value={fyFilter} onChange={(e) => setFyFilter(e.target.value)}>
            <option value="">All years</option>
            {fyOptions.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </FinanceSelect>
        </FinanceField>
      </div>

      {error ? (
        <div className="flex items-center justify-between rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          <span>{error}</span>
          <Button type="button" size="sm" variant="outline" className="h-8 cursor-pointer" onClick={() => void load()}>Retry</Button>
        </div>
      ) : null}

      {tab === "dashboard" ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <FinanceKpiCard label="Active Fiscal Year" value={summary?.active_fiscal_year?.fiscal_year_code ?? "—"} icon={CalendarRange} />
            <FinanceKpiCard label="Total Fiscal Years" value={String(summary?.total_fiscal_years ?? "—")} icon={CalendarRange} />
            <FinanceKpiCard label="Open Periods" value={String(summary?.open_periods ?? "—")} icon={Unlock} tone="success" />
            <FinanceKpiCard label="Closed Periods" value={String(summary?.closed_periods ?? "—")} icon={Lock} tone="warning" />
            <FinanceKpiCard label="Locked Periods" value={String(summary?.locked_periods ?? "—")} icon={Lock} tone="danger" />
            <FinanceKpiCard label="Current Period" value={summary?.current_period?.period_name ?? "—"} icon={CalendarRange} hint={summary?.current_period ? `${summary.current_period.start_date} – ${summary.current_period.end_date}` : undefined} />
            <FinanceKpiCard label="Year Close Progress" value={`${summary?.year_close_progress_pct ?? 0}%`} icon={CalendarRange} />
          </div>
          <div className="rounded-xl border border-border/80 bg-card p-3.5 shadow-sm">
            <h3 className="text-sm font-medium">Recently Closed Periods</h3>
            {(summary?.recently_closed_periods ?? []).length === 0 ? (
              <p className="mt-2 text-xs text-muted-foreground">None recently closed.</p>
            ) : (
              <ul className="mt-2 divide-y divide-border/60">
                {summary!.recently_closed_periods.map((p) => (
                  <li key={p.id} className="flex justify-between py-1.5 text-sm">
                    <span>{p.period_name} · {p.fiscal_year_code}</span>
                    <span className="text-xs text-muted-foreground capitalize">{p.status.replace("_", " ")}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <FiscalImportPanel onImported={() => void load()} />
          <PeriodCalendarView periods={periods} loading={loading} onPeriodAction={(id, action) => void handlePeriodAction(action, [id])} />
        </div>
      ) : null}

      {tab === "years" ? (
        <FiscalEnterpriseTable
          rows={years}
          loading={loading}
          selectedIds={selectedYearIds}
          onToggleSelect={(id) => setSelectedYearIds((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; })}
          onToggleSelectAll={(ids) => setSelectedYearIds((prev) => ids.every((id) => prev.has(id)) ? new Set() : new Set(ids))}
          sortBy={sortBy}
          sortDir={sortDir}
          onSort={(key) => { if (sortBy === key) setSortDir((d) => d === "asc" ? "desc" : "asc"); else { setSortBy(key); setSortDir("asc"); } }}
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={setPage}
          onPageSizeChange={(s) => { setPage(1); setPageSize(s); }}
          resolveUser={resolve}
        />
      ) : null}

      {tab === "periods" ? (
        <PeriodEnterpriseTable
          rows={periods}
          loading={loading}
          selectedIds={selectedPeriodIds}
          onToggleSelect={(id) => setSelectedPeriodIds((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; })}
          onToggleSelectAll={(ids) => setSelectedPeriodIds((prev) => ids.every((id) => prev.has(id)) ? new Set() : new Set(ids))}
          onAction={(action, ids) => void handlePeriodAction(action, ids)}
          busy={periodBusy}
        />
      ) : null}

      {tab === "calendar" ? (
        <PeriodCalendarView periods={periods} loading={loading} onPeriodAction={(id, action) => void handlePeriodAction(action, [id])} />
      ) : null}
    </div>
  );
}
