"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  ClipboardList,
  Package,
  RefreshCw,
  Scale,
  Shuffle,
} from "lucide-react";

import { FinanceKpiCard } from "@/components/finance/finance-kpi-card";
import { FinanceStatusBadge } from "@/components/finance/finance-status-badge";
import { InventoryStockComposition } from "@/components/inventory/inventory-stock-composition";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import {
  inventoryQuickLinks,
  inventoryWorkspaceGroups,
  resolveInventoryGroupResources,
} from "@/config/inventory";
import { isAuthenticated } from "@/lib/auth";
import {
  asNumber,
  asStatus,
  countOpenDocs,
  formatInr,
  formatQty,
  loadInventoryOverview,
  sumField,
  valuationTotal,
  type InventoryOverview,
  type InventoryRow,
} from "@/services/inventory-service";

function recentByDoc(rows: InventoryRow[], limit = 6): InventoryRow[] {
  return [...rows]
    .sort((a, b) =>
      String(b.document_number ?? b.id ?? "").localeCompare(String(a.document_number ?? a.id ?? "")),
    )
    .slice(0, limit);
}

export function InventoryDashboard() {
  const [data, setData] = useState<InventoryOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const authenticated = typeof window !== "undefined" ? isAuthenticated() : false;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await loadInventoryOverview());
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
        onHand: 0,
        available: 0,
        reserved: 0,
        openTransfers: 0,
        openAdjustments: 0,
        valuation: 0,
        skuCount: 0,
      };
    }
    return {
      onHand: sumField(data.stock, "on_hand_qty"),
      available: sumField(data.stock, "available_qty"),
      reserved: sumField(data.stock, "reserved_qty"),
      openTransfers: countOpenDocs(data.transfers, ["received", "closed", "cancelled", "completed"]),
      openAdjustments: countOpenDocs(data.adjustments, ["posted", "closed", "cancelled"]),
      valuation: valuationTotal(data.valuation),
      skuCount: data.stock.length,
    };
  }, [data]);

  const recentTransfers = useMemo(() => recentByDoc(data?.transfers ?? []), [data]);
  const recentAdjustments = useMemo(() => recentByDoc(data?.adjustments ?? []), [data]);

  const lowStock = useMemo(() => {
    if (!data) return [];
    const policyByKey = new Map<string, number>();
    for (const p of data.policies) {
      policyByKey.set(`${String(p.warehouse_id)}:${String(p.product_id)}`, asNumber(p.reorder_point));
    }

    type LowStockRow = {
      id: unknown;
      quality_status: unknown;
      status: unknown;
      available_qty: number;
      reorder_point: number;
      gap: number;
    };

    const items: LowStockRow[] = [];
    for (const row of data.stock) {
      const key = `${String(row.warehouse_id)}:${String(row.product_id)}`;
      const reorder = policyByKey.get(key) ?? 0;
      const available = asNumber(row.available_qty);
      if (reorder <= 0 || available > reorder) continue;
      items.push({
        id: row.id,
        quality_status: row.quality_status,
        status: row.status,
        available_qty: available,
        reorder_point: reorder,
        gap: reorder - available,
      });
    }
    return items.sort((a, b) => b.gap - a.gap).slice(0, 5);
  }, [data]);

  const authBlocked =
    Boolean(data?.statusCodes.includes(401)) ||
    (!authenticated && Boolean(data?.errors.length));

  return (
    <div className="space-y-5">
      <PageHeader
        title="Inventory"
        description="Warehouse stock, bins, batches, serials, transfers, adjustments, cycle counts, valuation, and reports."
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
              href="/inventory/stock"
              className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground shadow-sm transition-opacity duration-200 hover:opacity-90"
            >
              <Package className="size-3.5" />
              Stock
            </Link>
            <Link
              href="/inventory/transfers"
              className="inline-flex h-8 cursor-pointer items-center rounded-lg border border-border/80 bg-card px-3 text-sm font-medium shadow-sm transition-colors duration-200 hover:bg-muted"
            >
              Transfers
            </Link>
          </div>
        }
      />

      {authBlocked ? (
        <div className="rounded-xl border border-dashed border-amber-300/80 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Sign in to load live inventory data.{" "}
          <Link href="/login" className="cursor-pointer font-medium underline underline-offset-2">
            Go to login
          </Link>
        </div>
      ) : null}

      {data?.partial && !authBlocked ? (
        <div className="rounded-xl border border-border/80 bg-muted/40 px-4 py-2.5 text-xs text-muted-foreground">
          Some inventory endpoints returned errors. Showing available records.
        </div>
      ) : null}

      <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
        <FinanceKpiCard
          label="On hand qty"
          value={loading ? "—" : formatQty(kpis.onHand)}
          hint={`${kpis.skuCount} stock balances`}
          icon={Package}
          tone="default"
        />
        <FinanceKpiCard
          label="Available qty"
          value={loading ? "—" : formatQty(kpis.available)}
          hint={`${formatQty(kpis.reserved)} reserved`}
          icon={Scale}
          tone="success"
        />
        <FinanceKpiCard
          label="Open transfers"
          value={loading ? "—" : String(kpis.openTransfers)}
          hint={`${kpis.openAdjustments} open adjustments`}
          icon={Shuffle}
          tone={kpis.openTransfers > 0 ? "warning" : "success"}
        />
        <FinanceKpiCard
          label="Valuation layers"
          value={loading ? "—" : formatInr(kpis.valuation)}
          hint={`${data?.valuation.length ?? 0} cost layers`}
          icon={ClipboardList}
          tone="default"
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-[1.1fr_0.9fr]">
        <InventoryStockComposition
          onHand={kpis.onHand}
          reserved={kpis.reserved}
          available={kpis.available}
          loading={loading}
        />
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
          {[
            { label: "Bins", value: data?.bins.length ?? 0, href: "/inventory/bins" },
            { label: "Batches", value: data?.batches.length ?? 0, href: "/inventory/batches" },
            { label: "Serials", value: data?.serials.length ?? 0, href: "/inventory/serials" },
            {
              label: "Reservations",
              value: data?.reservations.length ?? 0,
              href: "/inventory/reservations",
            },
            {
              label: "Cycle counts",
              value: data?.cycleCounts.length ?? 0,
              href: "/inventory/cycle-counts",
            },
            { label: "Policies", value: data?.policies.length ?? 0, href: "/inventory/policies" },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex cursor-pointer items-center justify-between gap-2 rounded-xl border border-border/80 bg-card px-3.5 py-2.5 shadow-sm transition-[border-color,box-shadow] duration-200 hover:border-primary/25 hover:shadow-md"
            >
              <span className="text-xs font-medium text-muted-foreground">{item.label}</span>
              <span className="font-mono text-sm font-medium tabular-nums">
                {loading ? "—" : item.value}
              </span>
            </Link>
          ))}
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {inventoryQuickLinks.map((link) => {
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
          <Badge variant="secondary">{inventoryWorkspaceGroups.length} areas</Badge>
        </div>
        <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-4">
          {inventoryWorkspaceGroups.map((group) => {
            const Icon = group.icon;
            const resources = resolveInventoryGroupResources(group);
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
                        href={`/inventory/${resource.key}`}
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
          title="Recent transfers"
          subtitle="Warehouse stock moves"
          href="/inventory/transfers"
          loading={loading}
          rows={recentTransfers}
          empty="No transfers yet."
        />
        <DocTable
          title="Recent adjustments"
          subtitle="Quantity corrections"
          href="/inventory/adjustments"
          loading={loading}
          rows={recentAdjustments}
          empty="No adjustments yet."
        />
        <div className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm">
          <div className="flex items-center justify-between gap-2 border-b border-border/70 px-4 py-3">
            <div>
              <h2 className="text-sm font-medium tracking-tight">Low stock watch</h2>
              <p className="text-[11px] text-muted-foreground">At or below reorder point</p>
            </div>
            <Link
              href="/inventory/policies"
              className="cursor-pointer text-xs font-medium text-primary transition-opacity duration-200 hover:opacity-80"
            >
              Policies
            </Link>
          </div>
          <ul className="divide-y divide-border/60">
            {loading ? (
              <li className="px-4 py-8 text-center text-sm text-muted-foreground">Loading…</li>
            ) : lowStock.length === 0 ? (
              <li className="px-4 py-8 text-center text-sm text-muted-foreground">
                No reorder breaches.
              </li>
            ) : (
              lowStock.map((row, idx) => {
                const available = asNumber(row.available_qty);
                const reorder = asNumber(row.reorder_point);
                const pct = reorder > 0 ? Math.min(100, Math.round((available / reorder) * 100)) : 0;
                return (
                  <li
                    key={String(row.id ?? idx)}
                    className="px-4 py-2.5 transition-colors duration-150 hover:bg-accent/30"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-medium">SKU balance</p>
                      <FinanceStatusBadge status={String(row.quality_status ?? row.status ?? "")} />
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Available {formatQty(available)} · Reorder {formatQty(reorder)}
                    </p>
                    <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className={`h-full rounded-full transition-[width] duration-300 ${
                          pct <= 40 ? "bg-red-600" : pct <= 80 ? "bg-amber-500" : "bg-emerald-600"
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
  rows: InventoryRow[];
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
        <table className="w-full min-w-[360px] text-left text-sm">
          <thead>
            <tr className="border-b border-border/70 bg-muted/40 text-[11px] tracking-wide text-muted-foreground uppercase">
              <th className="px-4 py-2.5 font-medium">Document</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={2} className="px-4 py-10 text-center text-muted-foreground">
                  Loading…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={2} className="px-4 py-10 text-center text-muted-foreground">
                  {empty}
                </td>
              </tr>
            ) : (
              rows.map((row, idx) => (
                <tr
                  key={String(row.id ?? idx)}
                  className="border-b border-border/50 transition-colors duration-150 last:border-0 hover:bg-accent/30"
                >
                  <td className="px-4 py-2.5 font-medium text-foreground">
                    {String(row.document_number ?? "—")}
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
