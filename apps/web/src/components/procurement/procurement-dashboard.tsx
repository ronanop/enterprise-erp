"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  ClipboardList,
  PackageCheck,
  Receipt,
  RefreshCw,
  ShoppingCart,
} from "lucide-react";

import { FinanceKpiCard } from "@/components/finance/finance-kpi-card";
import { FinanceStatusBadge } from "@/components/finance/finance-status-badge";
import { PageHeader } from "@/components/layout/page-header";
import { ProcurementPipelineFunnel } from "@/components/procurement/procurement-pipeline-funnel";
import { Badge } from "@/components/ui/badge";
import {
  procurementQuickLinks,
  procurementWorkspaceGroups,
  resolveProcurementGroupResources,
} from "@/config/procurement";
import { isAuthenticated } from "@/lib/auth";
import {
  asNumber,
  asStatus,
  averageScore,
  countOpenDocs,
  formatInr,
  loadProcurementOverview,
  sumField,
  type ProcurementOverview,
  type ProcurementRow,
} from "@/services/procurement-service";

function recentByDate(rows: ProcurementRow[], limit = 6): ProcurementRow[] {
  return [...rows]
    .sort((a, b) => String(b.document_date ?? "").localeCompare(String(a.document_date ?? "")))
    .slice(0, limit);
}

function scoreTone(score: number): "success" | "warning" | "danger" | "default" {
  if (score <= 0) return "default";
  if (score >= 80) return "success";
  if (score >= 60) return "warning";
  return "danger";
}

export function ProcurementDashboard() {
  const [data, setData] = useState<ProcurementOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const authenticated = typeof window !== "undefined" ? isAuthenticated() : false;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await loadProcurementOverview());
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
        openPrs: 0,
        openPos: 0,
        apOutstanding: 0,
        avgScore: 0,
        prValue: 0,
        poValue: 0,
        activeContracts: 0,
      };
    }
    return {
      openPrs: countOpenDocs(data.requisitions, [
        "approved",
        "rejected",
        "converted",
        "converted_to_rfq",
        "cancelled",
        "closed",
      ]),
      openPos: countOpenDocs(data.orders, ["received", "closed", "cancelled", "completed"]),
      apOutstanding: sumField(data.invoices, "balance_due"),
      avgScore: averageScore(data.performance),
      prValue: sumField(data.requisitions, "total_amount"),
      poValue: sumField(data.orders, "total_amount"),
      activeContracts: countOpenDocs(data.contracts, ["expired", "cancelled", "terminated"]),
    };
  }, [data]);

  const pipelineCounts = useMemo(
    () => ({
      requisitions: data?.requisitions.length ?? 0,
      rfqs: data?.rfqs.length ?? 0,
      orders: data?.orders.length ?? 0,
      grns: data?.grns.length ?? 0,
      invoices: data?.invoices.length ?? 0,
    }),
    [data],
  );

  const recentOrders = useMemo(() => recentByDate(data?.orders ?? []), [data]);
  const recentRequisitions = useMemo(() => recentByDate(data?.requisitions ?? []), [data]);
  const topVendors = useMemo(() => {
    const rows = data?.performance ?? [];
    return [...rows]
      .sort((a, b) => asNumber(b.overall_score) - asNumber(a.overall_score))
      .slice(0, 5);
  }, [data]);

  const authBlocked =
    Boolean(data?.statusCodes.includes(401)) ||
    (!authenticated && Boolean(data?.errors.length));

  return (
    <div className="space-y-5">
      <PageHeader
        title="Procurement"
        description="Procure-to-pay workspace — requisitions, RFQs, purchase orders, GRNs, vendor invoices, contracts, and supplier performance."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-border/80 bg-card px-3 text-sm font-medium shadow-sm transition-colors duration-200 hover:bg-muted disabled:opacity-60"
            >
              <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
            <Link
              href="/procurement/orders"
              className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground shadow-sm transition-opacity duration-200 hover:opacity-90"
            >
              <ShoppingCart className="size-3.5" />
              Orders
            </Link>
            <Link
              href="/procurement/invoices"
              className="inline-flex h-8 cursor-pointer items-center rounded-lg border border-border/80 bg-card px-3 text-sm font-medium shadow-sm transition-colors duration-200 hover:bg-muted"
            >
              Invoices
            </Link>
          </div>
        }
      />

      {authBlocked ? (
        <div className="rounded-xl border border-dashed border-amber-300/80 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Sign in to load live procurement data.{" "}
          <Link href="/login" className="cursor-pointer font-medium underline underline-offset-2">
            Go to login
          </Link>
        </div>
      ) : null}

      {data?.partial && !authBlocked ? (
        <div className="rounded-xl border border-border/80 bg-muted/40 px-4 py-2.5 text-xs text-muted-foreground">
          Some procurement endpoints returned errors. Showing available records.
        </div>
      ) : null}

      <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
        <FinanceKpiCard
          label="Open requisitions"
          value={loading ? "—" : String(kpis.openPrs)}
          hint={`${formatInr(kpis.prValue)} requested value`}
          icon={ClipboardList}
          tone={kpis.openPrs > 0 ? "warning" : "success"}
        />
        <FinanceKpiCard
          label="Open purchase orders"
          value={loading ? "—" : String(kpis.openPos)}
          hint={`${formatInr(kpis.poValue)} committed spend`}
          icon={ShoppingCart}
          tone="default"
        />
        <FinanceKpiCard
          label="AP outstanding"
          value={loading ? "—" : formatInr(kpis.apOutstanding)}
          hint={`${data?.invoices.length ?? 0} vendor invoices`}
          icon={Receipt}
          tone={kpis.apOutstanding > 0 ? "warning" : "success"}
        />
        <FinanceKpiCard
          label="Avg vendor score"
          value={loading ? "—" : kpis.avgScore > 0 ? kpis.avgScore.toFixed(1) : "—"}
          hint={`${kpis.activeContracts} active contracts · ${data?.performance.length ?? 0} scored`}
          icon={PackageCheck}
          tone={scoreTone(kpis.avgScore)}
        />
      </div>

      <ProcurementPipelineFunnel counts={pipelineCounts} loading={loading} />

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {procurementQuickLinks.map((link) => {
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
          <Badge variant="secondary">{procurementWorkspaceGroups.length} areas</Badge>
        </div>
        <div className="grid gap-3 lg:grid-cols-3">
          {procurementWorkspaceGroups.map((group) => {
            const Icon = group.icon;
            const resources = resolveProcurementGroupResources(group);
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
                        href={`/procurement/${resource.key}`}
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

      <div className="grid gap-3 xl:grid-cols-[1.2fr_1.2fr_0.9fr]">
        <DocTable
          title="Recent purchase orders"
          subtitle="Latest committed spend"
          href="/procurement/orders"
          loading={loading}
          rows={recentOrders}
          empty="No purchase orders yet."
        />
        <DocTable
          title="Recent requisitions"
          subtitle="Latest purchase needs"
          href="/procurement/requisitions"
          loading={loading}
          rows={recentRequisitions}
          empty="No requisitions yet."
        />
        <div className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm">
          <div className="flex items-center justify-between gap-2 border-b border-border/70 px-4 py-3">
            <div>
              <h2 className="text-sm font-medium tracking-tight">Vendor performance</h2>
              <p className="text-[11px] text-muted-foreground">Top overall scores</p>
            </div>
            <Link
              href="/procurement/performance"
              className="cursor-pointer text-xs font-medium text-primary transition-opacity duration-200 hover:opacity-80"
            >
              View all
            </Link>
          </div>
          <ul className="divide-y divide-border/60">
            {loading ? (
              <li className="px-4 py-8 text-center text-sm text-muted-foreground">Loading…</li>
            ) : topVendors.length === 0 ? (
              <li className="px-4 py-8 text-center text-sm text-muted-foreground">
                No performance scores.
              </li>
            ) : (
              topVendors.map((row, idx) => {
                const score = asNumber(row.overall_score);
                const pct = Math.min(100, Math.round(score));
                return (
                  <li
                    key={String(row.id ?? idx)}
                    className="px-4 py-2.5 transition-colors duration-150 hover:bg-accent/30"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-medium">
                        {String(row.period_code ?? `Vendor ${idx + 1}`)}
                      </p>
                      <span className="font-mono text-xs font-medium tabular-nums">
                        {score.toFixed(1)}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      OTD {asNumber(row.on_time_delivery_pct).toFixed(0)}% · Quality{" "}
                      {asNumber(row.quality_rating).toFixed(1)}
                    </p>
                    <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className={`h-full rounded-full transition-[width] duration-300 ${
                          pct >= 80 ? "bg-emerald-600" : pct >= 60 ? "bg-amber-500" : "bg-red-600"
                        }`}
                        style={{ width: `${Math.max(4, pct)}%` }}
                        role="presentation"
                      />
                    </div>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}

function DocTable({
  title,
  subtitle,
  href,
  loading,
  rows,
  empty,
}: {
  title: string;
  subtitle: string;
  href: string;
  loading: boolean;
  rows: ProcurementRow[];
  empty: string;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm">
      <div className="flex items-center justify-between gap-2 border-b border-border/70 px-4 py-3">
        <div>
          <h2 className="text-sm font-medium tracking-tight">{title}</h2>
          <p className="text-[11px] text-muted-foreground">{subtitle}</p>
        </div>
        <Link
          href={href}
          className="cursor-pointer text-xs font-medium text-primary transition-opacity duration-200 hover:opacity-80"
        >
          View all
        </Link>
      </div>
      <div className="erp-scroll overflow-x-auto">
        <table className="w-full min-w-[420px] text-left text-sm">
          <thead>
            <tr className="border-b border-border/70 bg-muted/40 text-[11px] tracking-wide text-muted-foreground uppercase">
              <th className="px-4 py-2.5 font-medium">Document</th>
              <th className="px-4 py-2.5 font-medium">Date</th>
              <th className="px-4 py-2.5 font-medium">Amount</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">
                  Loading…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">
                  {empty}
                </td>
              </tr>
            ) : (
              rows.map((row, idx) => (
                <tr
                  key={String(row.id ?? idx)}
                  className="border-b border-border/50 transition-colors duration-150 last:border-0 hover:bg-accent/30"
                >
                  <td className="max-w-[180px] truncate px-4 py-2.5 font-medium text-foreground">
                    {String(row.document_number ?? "—")}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {String(row.document_date ?? "—")}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs tabular-nums text-foreground">
                    {formatInr(asNumber(row.total_amount))}
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
  );
}
