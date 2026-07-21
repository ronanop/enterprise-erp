"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Package,
  RefreshCw,
  ShoppingBag,
  Store,
  Truck,
} from "lucide-react";

import { EcommercePipelineFunnel } from "@/components/ecommerce/ecommerce-pipeline-funnel";
import { FinanceKpiCard } from "@/components/finance/finance-kpi-card";
import { FinanceStatusBadge } from "@/components/finance/finance-status-badge";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import {
  ecommerceQuickLinks,
  ecommerceWorkspaceGroups,
  resolveEcommerceGroupResources,
} from "@/config/ecommerce";
import { isAuthenticated } from "@/lib/auth";
import {
  asNumber,
  asStatus,
  countByStatus,
  countOpenDocs,
  loadEcommerceOverview,
  type EcommerceOverview,
  type EcommerceRow,
} from "@/services/ecommerce-service";

function recentOrders(rows: EcommerceRow[], limit = 6): EcommerceRow[] {
  return [...rows]
    .sort((a, b) =>
      String(b.placed_at ?? b.order_number ?? "").localeCompare(
        String(a.placed_at ?? a.order_number ?? ""),
      ),
    )
    .slice(0, limit);
}

function channelTypeOf(row: EcommerceRow): string {
  const raw = row.channel_type ?? "";
  return typeof raw === "string" ? raw.toLowerCase() : "";
}

function formatMoney(row: EcommerceRow): string {
  const amount = asNumber(row.grand_total ?? row.amount);
  const currency = typeof row.currency === "string" ? row.currency : "INR";
  return `${currency} ${amount.toLocaleString()}`;
}

export function EcommerceDashboard() {
  const [data, setData] = useState<EcommerceOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const authenticated = typeof window !== "undefined" ? isAuthenticated() : false;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await loadEcommerceOverview());
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
        activeStores: 0,
        openCarts: 0,
        processingOrders: 0,
        shipments: 0,
      };
    }
    return {
      activeStores: countByStatus(data.stores, ["active", "approved"]),
      openCarts: countByStatus(data.carts, ["open", "active"]),
      processingOrders: countOpenDocs(data.orders, [
        "delivered",
        "cancelled",
        "returned",
        "closed",
      ]),
      shipments: data.shipments.length,
    };
  }, [data]);

  const pipelineCounts = useMemo(
    () => ({
      "product-listings": data?.listings.length ?? 0,
      "customer-carts": data?.carts.length ?? 0,
      orders: data?.orders.length ?? 0,
      payments: data?.payments.length ?? 0,
      shipments: data?.shipments.length ?? 0,
      "return-requests": data?.returns.length ?? 0,
    }),
    [data],
  );

  const recent = useMemo(() => recentOrders(data?.orders ?? []), [data]);

  const shipmentWatch = useMemo(() => {
    const rows = data?.shipments ?? [];
    return [...rows]
      .sort((a, b) =>
        String(b.shipment_number ?? b.shipped_at ?? "").localeCompare(
          String(a.shipment_number ?? a.shipped_at ?? ""),
        ),
      )
      .slice(0, 5);
  }, [data]);

  const channelTypeMix = useMemo(() => {
    const rows = data?.channels ?? [];
    const stages = [
      { key: "website", label: "Website", barClass: "bg-sky-600" },
      { key: "marketplace", label: "Marketplace", barClass: "bg-teal-600" },
      { key: "mobile", label: "Mobile", barClass: "bg-amber-500" },
      { key: "b2b", label: "B2B", barClass: "bg-slate-500" },
      { key: "other", label: "Other", barClass: "bg-slate-400" },
    ] as const;
    const total = rows.length || 1;
    const known = new Set(["website", "marketplace", "mobile", "b2b"]);
    return stages.map((s) => {
      const count =
        s.key === "other"
          ? rows.filter((row) => !known.has(channelTypeOf(row))).length
          : rows.filter((row) => channelTypeOf(row) === s.key).length;
      return { ...s, count, pct: Math.round((count / total) * 100) };
    });
  }, [data]);

  const authBlocked =
    Boolean(data?.statusCodes.includes(401)) ||
    (!authenticated && Boolean(data?.errors.length));

  return (
    <div className="space-y-5">
      <PageHeader
        title="Ecommerce"
        description="External channel commerce — stores, listings, carts, orders, payments, shipments, returns, and promotions."
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
              href="/ecommerce/orders"
              className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground shadow-sm transition-opacity duration-200 hover:opacity-90"
            >
              <ShoppingBag className="size-3.5" />
              Orders
            </Link>
            <Link
              href="/ecommerce/shipments"
              className="inline-flex h-8 cursor-pointer items-center rounded-lg border border-border/80 bg-card px-3 text-sm font-medium shadow-sm transition-colors duration-200 hover:bg-muted"
            >
              Shipments
            </Link>
          </div>
        }
      />

      {authBlocked ? (
        <div className="rounded-xl border border-dashed border-amber-300/80 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Sign in to load live ecommerce data.{" "}
          <Link href="/login" className="cursor-pointer font-medium underline underline-offset-2">
            Go to login
          </Link>
        </div>
      ) : null}

      {data?.partial && !authBlocked ? (
        <div className="rounded-xl border border-border/80 bg-muted/40 px-4 py-2.5 text-xs text-muted-foreground">
          Some ecommerce endpoints returned errors. Showing available records.
        </div>
      ) : null}

      <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
        <FinanceKpiCard
          label="Active stores"
          value={loading ? "—" : String(kpis.activeStores)}
          hint={`${data?.stores.length ?? 0} stores · ${data?.channels.length ?? 0} channels`}
          icon={Store}
          tone={kpis.activeStores > 0 ? "success" : "default"}
        />
        <FinanceKpiCard
          label="Open carts"
          value={loading ? "—" : String(kpis.openCarts)}
          hint={`${data?.carts.length ?? 0} carts · ${data?.listings.length ?? 0} listings`}
          icon={Package}
          tone={kpis.openCarts > 0 ? "default" : "success"}
        />
        <FinanceKpiCard
          label="Open orders"
          value={loading ? "—" : String(kpis.processingOrders)}
          hint={`${data?.orders.length ?? 0} orders · ${countByStatus(data?.payments ?? [], ["captured", "paid"])} paid`}
          icon={ShoppingBag}
          tone={kpis.processingOrders > 0 ? "warning" : "success"}
        />
        <FinanceKpiCard
          label="Shipments"
          value={loading ? "—" : String(kpis.shipments)}
          hint={`${countByStatus(data?.shipments ?? [], ["shipped", "delivered"])} in transit · ${data?.returns.length ?? 0} returns`}
          icon={Truck}
          tone={kpis.shipments > 0 ? "default" : "success"}
        />
      </div>

      <EcommercePipelineFunnel counts={pipelineCounts} loading={loading} />

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {ecommerceQuickLinks.map((link) => {
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
                <span className="block text-[11px] text-muted-foreground">
                  {link.description}
                </span>
              </span>
            </Link>
          );
        })}
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-medium tracking-tight">Workspace</h2>
          <Badge variant="secondary">{ecommerceWorkspaceGroups.length} areas</Badge>
        </div>
        <div className="grid gap-3 lg:grid-cols-3">
          {ecommerceWorkspaceGroups.map((group) => {
            const Icon = group.icon;
            const resources = resolveEcommerceGroupResources(group);
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
                        href={`/ecommerce/${resource.key}`}
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
              <h2 className="text-sm font-medium tracking-tight">Recent orders</h2>
              <p className="text-[11px] text-muted-foreground">Channel intake</p>
            </div>
            <Link
              href="/ecommerce/orders"
              className="cursor-pointer text-xs font-medium text-primary transition-opacity duration-200 hover:opacity-80"
            >
              View all
            </Link>
          </div>
          <div className="erp-scroll overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead>
                <tr className="border-b border-border/70 bg-muted/40 text-[11px] tracking-wide text-muted-foreground uppercase">
                  <th className="px-4 py-2.5 font-medium">Order</th>
                  <th className="px-4 py-2.5 font-medium">Total</th>
                  <th className="px-4 py-2.5 font-medium">Currency</th>
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
                      No orders yet.
                    </td>
                  </tr>
                ) : (
                  recent.map((row, idx) => (
                    <tr
                      key={String(row.id ?? idx)}
                      className="border-b border-border/50 transition-colors duration-150 last:border-0 hover:bg-accent/30"
                    >
                      <td className="max-w-[220px] truncate px-4 py-2.5">
                        <p className="font-medium text-foreground">
                          {String(row.order_number ?? "—")}
                        </p>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {String(row.placed_at ?? "").slice(0, 19).replace("T", " ")}
                        </p>
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs tabular-nums text-muted-foreground">
                        {formatMoney(row)}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground">
                        {String(row.currency ?? "—")}
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
              <h2 className="text-sm font-medium tracking-tight">Shipment watch</h2>
              <p className="text-[11px] text-muted-foreground">Fulfillment tracking</p>
            </div>
            <Link
              href="/ecommerce/shipments"
              className="cursor-pointer text-xs font-medium text-primary transition-opacity duration-200 hover:opacity-80"
            >
              View all
            </Link>
          </div>
          <ul className="divide-y divide-border/60">
            {loading ? (
              <li className="px-4 py-8 text-center text-sm text-muted-foreground">Loading…</li>
            ) : shipmentWatch.length === 0 ? (
              <li className="px-4 py-8 text-center text-sm text-muted-foreground">
                No shipments yet.
              </li>
            ) : (
              shipmentWatch.map((row, idx) => (
                <li
                  key={String(row.id ?? idx)}
                  className="px-4 py-2.5 transition-colors duration-150 hover:bg-accent/30"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium">
                      {String(row.shipment_number ?? "—")}
                    </p>
                    <FinanceStatusBadge
                      status={asStatus(row.status) || String(row.status ?? "")}
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {String(row.carrier_code ?? "carrier")} ·{" "}
                    {String(row.tracking_number ?? "—")}
                  </p>
                </li>
              ))
            )}
          </ul>
        </div>

        <div className="rounded-xl border border-border/80 bg-card p-4 shadow-sm">
          <div className="mb-3">
            <h2 className="text-sm font-medium tracking-tight">Channel type mix</h2>
            <p className="text-[11px] text-muted-foreground">FRD-22 §9–§13</p>
          </div>
          {loading ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>
          ) : (
            <div className="space-y-3">
              {channelTypeMix.map((s) => (
                <div key={s.key}>
                  <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                    <span className="font-medium text-foreground">{s.label}</span>
                    <span className="font-mono tabular-nums text-muted-foreground">
                      {s.count} · {s.pct}%
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full transition-[width] duration-300 ${s.barClass}`}
                      style={{ width: `${Math.max(4, s.pct)}%` }}
                      role="presentation"
                    />
                  </div>
                </div>
              ))}
              <p className="pt-1 text-[11px] text-muted-foreground">
                Coupons {data?.coupons.length ?? 0} · Promotions{" "}
                {data?.promotions.length ?? 0} · Marketplaces{" "}
                {data?.marketplaceConnectors.length ?? 0}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
