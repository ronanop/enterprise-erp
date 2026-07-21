"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Cog,
  Factory,
  Layers,
  RefreshCw,
  Trash2,
} from "lucide-react";

import { FinanceKpiCard } from "@/components/finance/finance-kpi-card";
import { FinanceStatusBadge } from "@/components/finance/finance-status-badge";
import { ManufacturingPipelineFunnel } from "@/components/manufacturing/manufacturing-pipeline-funnel";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import {
  manufacturingQuickLinks,
  manufacturingWorkspaceGroups,
  resolveManufacturingGroupResources,
} from "@/config/manufacturing";
import { isAuthenticated } from "@/lib/auth";
import {
  asNumber,
  asStatus,
  countByStatus,
  countOpenDocs,
  formatInr,
  formatQty,
  loadManufacturingOverview,
  sumField,
  type ManufacturingOverview,
  type ManufacturingRow,
} from "@/services/manufacturing-service";

function recentOrders(rows: ManufacturingRow[], limit = 6): ManufacturingRow[] {
  return [...rows]
    .sort((a, b) =>
      String(b.created_at ?? b.planned_start ?? "").localeCompare(
        String(a.created_at ?? a.planned_start ?? ""),
      ),
    )
    .slice(0, limit);
}

export function ManufacturingDashboard() {
  const [data, setData] = useState<ManufacturingOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const authenticated = typeof window !== "undefined" ? isAuthenticated() : false;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await loadManufacturingOverview());
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
        openOrders: 0,
        plannedQty: 0,
        wipValue: 0,
        scrapQty: 0,
        idleMachines: 0,
        runningMachines: 0,
      };
    }
    return {
      openOrders: countOpenDocs(data.orders, ["completed", "closed", "cancelled"]),
      plannedQty: sumField(data.orders, "planned_qty"),
      wipValue: sumField(
        data.wip.filter((r) => asStatus(r.status) === "open" || !r.status),
        "total_cost",
      ),
      scrapQty: sumField(data.scrap, "quantity"),
      idleMachines: countByStatus(data.machines, ["idle"]),
      runningMachines: countByStatus(data.machines, ["running"]),
    };
  }, [data]);

  const pipelineCounts = useMemo(
    () => ({
      "production-orders": data?.orders.length ?? 0,
      "material-issues": data?.issues.length ?? 0,
      wip: data?.wip.length ?? 0,
      "production-receipts": data?.receipts.length ?? 0,
      scrap: data?.scrap.length ?? 0,
    }),
    [data],
  );

  const recent = useMemo(() => recentOrders(data?.orders ?? []), [data]);

  const scrapWatch = useMemo(() => {
    const rows = data?.scrap ?? [];
    return [...rows]
      .sort((a, b) => asNumber(b.quantity) - asNumber(a.quantity))
      .slice(0, 5);
  }, [data]);

  const wipCosts = useMemo(() => {
    const rows = data?.wip ?? [];
    const material = sumField(rows, "material_cost");
    const labor = sumField(rows, "labor_cost");
    const overhead = sumField(rows, "overhead_cost");
    const total = material + labor + overhead || 1;
    return {
      material,
      labor,
      overhead,
      materialPct: Math.round((material / total) * 100),
      laborPct: Math.round((labor / total) * 100),
      overheadPct: Math.round((overhead / total) * 100),
    };
  }, [data]);

  const authBlocked =
    Boolean(data?.statusCodes.includes(401)) ||
    (!authenticated && Boolean(data?.errors.length));

  return (
    <div className="space-y-5">
      <PageHeader
        title="Manufacturing"
        description="Production workspace — BOMs, routings, work orders, material issues, FG receipts, WIP, scrap, and variances."
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
              href="/manufacturing/production-orders"
              className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground shadow-sm transition-opacity duration-200 hover:opacity-90"
            >
              <Factory className="size-3.5" />
              Orders
            </Link>
            <Link
              href="/manufacturing/wip"
              className="inline-flex h-8 cursor-pointer items-center rounded-lg border border-border/80 bg-card px-3 text-sm font-medium shadow-sm transition-colors duration-200 hover:bg-muted"
            >
              WIP
            </Link>
          </div>
        }
      />

      {authBlocked ? (
        <div className="rounded-xl border border-dashed border-amber-300/80 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Sign in to load live manufacturing data.{" "}
          <Link href="/login" className="cursor-pointer font-medium underline underline-offset-2">
            Go to login
          </Link>
        </div>
      ) : null}

      {data?.partial && !authBlocked ? (
        <div className="rounded-xl border border-border/80 bg-muted/40 px-4 py-2.5 text-xs text-muted-foreground">
          Some manufacturing endpoints returned errors. Showing available records.
        </div>
      ) : null}

      <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
        <FinanceKpiCard
          label="Open production orders"
          value={loading ? "—" : String(kpis.openOrders)}
          hint={`${formatQty(kpis.plannedQty)} planned qty · ${data?.orders.length ?? 0} total`}
          icon={Factory}
          tone={kpis.openOrders > 0 ? "warning" : "success"}
        />
        <FinanceKpiCard
          label="Open WIP value"
          value={loading ? "—" : formatInr(kpis.wipValue)}
          hint={`${countByStatus(data?.wip ?? [], ["open"])} open · ${data?.wip.length ?? 0} balances`}
          icon={Layers}
          tone={kpis.wipValue > 0 ? "default" : "success"}
        />
        <FinanceKpiCard
          label="Scrap quantity"
          value={loading ? "—" : formatQty(kpis.scrapQty)}
          hint={`${data?.scrap.length ?? 0} scrap docs · ${countByStatus(data?.variances ?? [], ["open"])} open variances`}
          icon={Trash2}
          tone={kpis.scrapQty > 0 ? "danger" : "success"}
        />
        <FinanceKpiCard
          label="Idle machines"
          value={loading ? "—" : String(kpis.idleMachines)}
          hint={`${kpis.runningMachines} running · ${data?.machines.length ?? 0} machines`}
          icon={Cog}
          tone={kpis.idleMachines > 0 ? "warning" : "success"}
        />
      </div>

      <ManufacturingPipelineFunnel counts={pipelineCounts} loading={loading} />

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {manufacturingQuickLinks.map((link) => {
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
          <Badge variant="secondary">{manufacturingWorkspaceGroups.length} areas</Badge>
        </div>
        <div className="grid gap-3 lg:grid-cols-3">
          {manufacturingWorkspaceGroups.map((group) => {
            const Icon = group.icon;
            const resources = resolveManufacturingGroupResources(group);
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
                        href={`/manufacturing/${resource.key}`}
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

      <div className="grid gap-3 xl:grid-cols-[1.3fr_1fr_1fr]">
        <div className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm">
          <div className="flex items-center justify-between gap-2 border-b border-border/70 px-4 py-3">
            <div>
              <h2 className="text-sm font-medium tracking-tight">Recent production orders</h2>
              <p className="text-[11px] text-muted-foreground">Work order book</p>
            </div>
            <Link
              href="/manufacturing/production-orders"
              className="cursor-pointer text-xs font-medium text-primary transition-opacity duration-200 hover:opacity-80"
            >
              View all
            </Link>
          </div>
          <div className="erp-scroll overflow-x-auto">
            <table className="w-full min-w-[440px] text-left text-sm">
              <thead>
                <tr className="border-b border-border/70 bg-muted/40 text-[11px] tracking-wide text-muted-foreground uppercase">
                  <th className="px-4 py-2.5 font-medium">Order</th>
                  <th className="px-4 py-2.5 font-medium">Planned</th>
                  <th className="px-4 py-2.5 font-medium">Scrap</th>
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
                ) : recent.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">
                      No production orders yet.
                    </td>
                  </tr>
                ) : (
                  recent.map((row, idx) => (
                    <tr
                      key={String(row.id ?? idx)}
                      className="border-b border-border/50 transition-colors duration-150 last:border-0 hover:bg-accent/30"
                    >
                      <td className="max-w-[180px] truncate px-4 py-2.5">
                        <p className="font-medium text-foreground">
                          {String(row.document_number ?? "—")}
                        </p>
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs tabular-nums text-foreground">
                        {formatQty(asNumber(row.planned_qty))}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs tabular-nums text-muted-foreground">
                        {formatQty(asNumber(row.scrapped_qty))}
                      </td>
                      <td className="px-4 py-2.5">
                        <FinanceStatusBadge
                          status={asStatus(row.status) || String(row.status ?? "")}
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm">
          <div className="flex items-center justify-between gap-2 border-b border-border/70 px-4 py-3">
            <div>
              <h2 className="text-sm font-medium tracking-tight">Scrap watch</h2>
              <p className="text-[11px] text-muted-foreground">Highest scrap quantities</p>
            </div>
            <Link
              href="/manufacturing/scrap"
              className="cursor-pointer text-xs font-medium text-primary transition-opacity duration-200 hover:opacity-80"
            >
              View all
            </Link>
          </div>
          <ul className="divide-y divide-border/60">
            {loading ? (
              <li className="px-4 py-8 text-center text-sm text-muted-foreground">Loading…</li>
            ) : scrapWatch.length === 0 ? (
              <li className="px-4 py-8 text-center text-sm text-muted-foreground">
                No scrap records.
              </li>
            ) : (
              scrapWatch.map((row, idx) => (
                <li
                  key={String(row.id ?? idx)}
                  className="px-4 py-2.5 transition-colors duration-150 hover:bg-accent/30"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium">
                      {String(row.document_number ?? "—")}
                    </p>
                    <FinanceStatusBadge status={String(row.status ?? "draft")} />
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {String(row.scrap_type ?? "process").replaceAll("_", " ")} · Qty{" "}
                    {formatQty(asNumber(row.quantity))}
                    {row.total_cost != null ? ` · ${formatInr(asNumber(row.total_cost))}` : ""}
                  </p>
                </li>
              ))
            )}
          </ul>
        </div>

        <div className="rounded-xl border border-border/80 bg-card p-4 shadow-sm">
          <div className="mb-3">
            <h2 className="text-sm font-medium tracking-tight">WIP cost mix</h2>
            <p className="text-[11px] text-muted-foreground">Material / labor / overhead</p>
          </div>
          {loading ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>
          ) : (
            <div className="space-y-3">
              <CostBar
                label="Material"
                amount={wipCosts.material}
                pct={wipCosts.materialPct}
                barClass="bg-sky-600"
              />
              <CostBar
                label="Labor"
                amount={wipCosts.labor}
                pct={wipCosts.laborPct}
                barClass="bg-teal-600"
              />
              <CostBar
                label="Overhead"
                amount={wipCosts.overhead}
                pct={wipCosts.overheadPct}
                barClass="bg-slate-500"
              />
              <p className="pt-1 text-[11px] text-muted-foreground">
                Active BOMs {countByStatus(data?.boms ?? [], ["active"])} · Routings{" "}
                {data?.routings.length ?? 0} · Work centers {data?.workCenters.length ?? 0}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CostBar({
  label,
  amount,
  pct,
  barClass,
}: {
  label: string;
  amount: number;
  pct: number;
  barClass: string;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2 text-xs">
        <span className="font-medium text-foreground">{label}</span>
        <span className="font-mono tabular-nums text-muted-foreground">
          {formatInr(amount)} · {pct}%
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full transition-[width] duration-300 ${barClass}`}
          style={{ width: `${Math.max(4, pct)}%` }}
          role="presentation"
        />
      </div>
    </div>
  );
}
