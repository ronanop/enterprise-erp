"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  BookOpen,
  CalendarRange,
  Landmark,
  Receipt,
  RefreshCw,
  Wallet,
} from "lucide-react";

import { FinanceAgingBars } from "@/components/finance/finance-aging-bars";
import { FinanceKpiCard } from "@/components/finance/finance-kpi-card";
import { FinanceStatusBadge } from "@/components/finance/finance-status-badge";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  financeQuickLinks,
  financeWorkspaceGroups,
  resolveFinanceGroupResources,
} from "@/config/finance";
import { isAuthenticated } from "@/lib/auth";
import {
  asNumber,
  asStatus,
  countByStatus,
  formatInr,
  loadFinanceOverview,
  openPeriodCount,
  sumBalances,
  summarizeAging,
  type FinanceOverview,
  type FinanceRow,
} from "@/services/finance-service";

function recentJournals(rows: FinanceRow[], limit = 8): FinanceRow[] {
  return [...rows]
    .sort((a, b) => String(b.journal_date ?? "").localeCompare(String(a.journal_date ?? "")))
    .slice(0, limit);
}

function periodClosingLabel(row: FinanceRow): string {
  const flags = [
    row.ar_closed ? "AR" : null,
    row.ap_closed ? "AP" : null,
    row.gl_closed ? "GL" : null,
  ].filter(Boolean);
  return flags.length ? flags.join(" · ") : "None closed";
}

export function FinanceDashboard() {
  const [data, setData] = useState<FinanceOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const authenticated = typeof window !== "undefined" ? isAuthenticated() : false;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const overview = await loadFinanceOverview();
      setData(overview);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const kpis = useMemo(() => {
    if (!data) {
      return {
        openJournals: 0,
        postedJournals: 0,
        arOutstanding: 0,
        apOutstanding: 0,
        openPeriods: 0,
        accounts: 0,
      };
    }
    return {
      openJournals: countByStatus(data.journals, ["draft", "pending", "in_review", "submitted"]),
      postedJournals: countByStatus(data.journals, ["posted", "approved"]),
      arOutstanding: sumBalances(data.ar),
      apOutstanding: sumBalances(data.ap),
      openPeriods: openPeriodCount(data.periods),
      accounts: data.accounts.length,
    };
  }, [data]);

  const arAging = useMemo(() => summarizeAging(data?.ar ?? []), [data]);
  const apAging = useMemo(() => summarizeAging(data?.ap ?? []), [data]);
  const journals = useMemo(() => recentJournals(data?.journals ?? []), [data]);
  const periods = useMemo(() => (data?.periods ?? []).slice(0, 6), [data]);

  const authBlocked =
    Boolean(data?.statusCodes.includes(401)) ||
    (!authenticated && Boolean(data?.errors.length));

  return (
    <div className="space-y-5">
      <PageHeader
        title="Finance"
        description="General ledger, journals, AR/AP subledgers, fiscal periods, and financial reports — double-entry accounting workspace."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="cursor-pointer shadow-none"
              onClick={() => void load()}
              disabled={loading}
            >
              <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Link
              href="/finance/journals"
              className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground shadow-sm transition-opacity duration-200 hover:opacity-90"
            >
              <BookOpen className="size-3.5" />
              Journals
            </Link>
            <Link
              href="/finance/reports"
              className="inline-flex h-8 cursor-pointer items-center rounded-lg border border-border/80 bg-card px-3 text-sm font-medium shadow-sm transition-colors duration-200 hover:bg-muted"
            >
              Trial Balance
            </Link>
          </div>
        }
      />

      {authBlocked ? (
        <div className="rounded-xl border border-dashed border-amber-300/80 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Sign in to load live finance data.{" "}
          <Link href="/login" className="cursor-pointer font-medium underline underline-offset-2">
            Go to login
          </Link>
        </div>
      ) : null}

      {data?.partial && !authBlocked ? (
        <div className="rounded-xl border border-border/80 bg-muted/40 px-4 py-2.5 text-xs text-muted-foreground">
          Some finance endpoints returned errors. Showing available records.
        </div>
      ) : null}

      <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
        <FinanceKpiCard
          label="Open journals"
          value={loading ? "—" : String(kpis.openJournals)}
          hint={`${kpis.postedJournals} posted / approved`}
          icon={BookOpen}
          tone={kpis.openJournals > 0 ? "warning" : "success"}
        />
        <FinanceKpiCard
          label="AR outstanding"
          value={loading ? "—" : formatInr(kpis.arOutstanding)}
          hint={`${data?.ar.length ?? 0} customer documents`}
          icon={Receipt}
          tone="default"
        />
        <FinanceKpiCard
          label="AP outstanding"
          value={loading ? "—" : formatInr(kpis.apOutstanding)}
          hint={`${data?.ap.length ?? 0} vendor documents`}
          icon={Wallet}
          tone="default"
        />
        <FinanceKpiCard
          label="Open periods"
          value={loading ? "—" : String(kpis.openPeriods)}
          hint={`${kpis.accounts} COA accounts`}
          icon={CalendarRange}
          tone={kpis.openPeriods > 0 ? "success" : "warning"}
        />
      </div>

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {financeQuickLinks.map((link) => {
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              className="group flex cursor-pointer items-center gap-3 rounded-xl border border-border/80 bg-card px-3.5 py-3 shadow-sm transition-[border-color,box-shadow] duration-200 hover:border-primary/25 hover:shadow-md"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                <Icon className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1 text-sm font-medium tracking-tight">
                  {link.title}
                  <ArrowUpRight className="size-3 text-muted-foreground opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
                </span>
                <span className="block text-[11px] text-muted-foreground">{link.description}</span>
              </span>
            </Link>
          );
        })}
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-medium tracking-tight">Workspace</h2>
          <Badge variant="secondary">{financeWorkspaceGroups.length} areas</Badge>
        </div>
        <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
          {financeWorkspaceGroups.map((group) => {
            const Icon = group.icon;
            const resources = resolveFinanceGroupResources(group);
            return (
              <div
                key={group.key}
                className="rounded-xl border border-border/80 bg-card p-4 shadow-sm"
              >
                <div className="mb-3 flex items-start gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
                    <Icon className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-sm font-medium tracking-tight">{group.title}</h3>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                      {group.description}
                    </p>
                  </div>
                </div>
                <ul className="space-y-1">
                  {resources.map((resource) => (
                    <li key={resource.key}>
                      <Link
                        href={`/finance/${resource.key}`}
                        className="flex cursor-pointer items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-xs transition-colors duration-200 hover:bg-accent/50"
                      >
                        <span className="font-medium text-foreground">{resource.title}</span>
                        <span className="truncate text-[10px] text-muted-foreground">
                          {resource.description}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </section>

      <div className="grid gap-3 xl:grid-cols-[1.4fr_1fr]">
        <div className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm">
          <div className="flex items-center justify-between gap-2 border-b border-border/70 px-4 py-3">
            <div>
              <h2 className="text-sm font-medium tracking-tight">Recent journals</h2>
              <p className="text-[11px] text-muted-foreground">Latest entries from the journal book</p>
            </div>
            <Link
              href="/finance/journals"
              className="cursor-pointer text-xs font-medium text-primary transition-opacity duration-200 hover:opacity-80"
            >
              View all
            </Link>
          </div>
          <div className="erp-scroll overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="border-b border-border/70 bg-muted/40 text-[11px] tracking-wide text-muted-foreground uppercase">
                  <th className="px-4 py-2.5 font-medium">Journal</th>
                  <th className="px-4 py-2.5 font-medium">Date</th>
                  <th className="px-4 py-2.5 font-medium">Debit</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">
                      Loading journals…
                    </td>
                  </tr>
                ) : journals.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">
                      No journal entries yet.
                    </td>
                  </tr>
                ) : (
                  journals.map((row, idx) => (
                    <tr
                      key={String(row.id ?? idx)}
                      className="border-b border-border/50 transition-colors duration-150 last:border-0 hover:bg-accent/30"
                    >
                      <td className="max-w-[220px] truncate px-4 py-2.5">
                        <p className="font-medium text-foreground">
                          {String(row.journal_number ?? "—")}
                        </p>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {String(row.description ?? row.journal_type ?? "")}
                        </p>
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {String(row.journal_date ?? "—")}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs tabular-nums text-foreground">
                        {formatInr(asNumber(row.total_debit))}
                      </td>
                      <td className="px-4 py-2.5">
                        <FinanceStatusBadge status={asStatus(row.status) || String(row.status ?? "")} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-3">
          <div className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm">
            <div className="flex items-center gap-2 border-b border-border/70 px-4 py-3">
              <Landmark className="size-3.5 text-muted-foreground" />
              <div>
                <h2 className="text-sm font-medium tracking-tight">Period closing</h2>
                <p className="text-[11px] text-muted-foreground">AR · AP · GL close flags</p>
              </div>
            </div>
            <ul className="divide-y divide-border/60">
              {loading ? (
                <li className="px-4 py-8 text-center text-sm text-muted-foreground">Loading periods…</li>
              ) : periods.length === 0 ? (
                <li className="px-4 py-8 text-center text-sm text-muted-foreground">No periods found.</li>
              ) : (
                periods.map((row, idx) => (
                  <li
                    key={String(row.id ?? idx)}
                    className="flex items-center justify-between gap-3 px-4 py-2.5 transition-colors duration-150 hover:bg-accent/30"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {String(row.period_name ?? `Period ${row.period_number ?? idx + 1}`)}
                      </p>
                      <p className="text-[11px] text-muted-foreground">{periodClosingLabel(row)}</p>
                    </div>
                    <FinanceStatusBadge status={String(row.status ?? "")} />
                  </li>
                ))
              )}
            </ul>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <FinanceAgingBars title="AR aging" summary={arAging} />
            <FinanceAgingBars title="AP aging" summary={apAging} />
          </div>
        </div>
      </div>
    </div>
  );
}
