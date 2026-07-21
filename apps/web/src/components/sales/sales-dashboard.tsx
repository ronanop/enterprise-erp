"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  FileText,
  Receipt,
  RefreshCw,
  ShoppingCart,
  WalletCards,
} from "lucide-react";

import { FinanceKpiCard } from "@/components/finance/finance-kpi-card";
import { FinanceStatusBadge } from "@/components/finance/finance-status-badge";
import { SalesPipelineFunnel } from "@/components/sales/sales-pipeline-funnel";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import {
  resolveSalesGroupResources,
  salesQuickLinks,
  salesWorkspaceGroups,
} from "@/config/sales";
import { isAuthenticated } from "@/lib/auth";
import {
  asNumber,
  asStatus,
  countByStatus,
  countOpenDocs,
  creditHoldCount,
  formatInr,
  loadSalesOverview,
  sumField,
  type SalesOverview,
  type SalesRow,
} from "@/services/sales-service";

function recentByDate(rows: SalesRow[], limit = 6): SalesRow[] {
  return [...rows]
    .sort((a, b) => String(b.document_date ?? "").localeCompare(String(a.document_date ?? "")))
    .slice(0, limit);
}

export function SalesDashboard() {
  const [data, setData] = useState<SalesOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const authenticated = typeof window !== "undefined" ? isAuthenticated() : false;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await loadSalesOverview());
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
        openQuotes: 0,
        openOrders: 0,
        invoiceOutstanding: 0,
        creditHolds: 0,
        quoteValue: 0,
        orderValue: 0,
      };
    }
    return {
      openQuotes: countOpenDocs(data.quotations, ["accepted", "rejected", "expired", "cancelled"]),
      openOrders: countOpenDocs(data.orders, ["delivered", "closed", "cancelled"]),
      invoiceOutstanding: sumField(data.invoices, "balance_due"),
      creditHolds: creditHoldCount(data.customerCredit),
      quoteValue: sumField(data.quotations, "total_amount"),
      orderValue: sumField(data.orders, "total_amount"),
    };
  }, [data]);

  const pipelineCounts = useMemo(
    () => ({
      quotations: data?.quotations.length ?? 0,
      orders: data?.orders.length ?? 0,
      deliveries: data?.deliveries.length ?? 0,
      invoices: data?.invoices.length ?? 0,
      returns: data?.returns.length ?? 0,
    }),
    [data],
  );

  const recentOrders = useMemo(() => recentByDate(data?.orders ?? []), [data]);
  const recentQuotes = useMemo(() => recentByDate(data?.quotations ?? []), [data]);
  const creditWatch = useMemo(() => {
    const rows = data?.customerCredit ?? [];
    return [...rows]
      .sort((a, b) => {
        const hold = Number(b.credit_hold === true) - Number(a.credit_hold === true);
        if (hold !== 0) return hold;
        return asNumber(b.credit_used) - asNumber(a.credit_used);
      })
      .slice(0, 5);
  }, [data]);

  const authBlocked =
    Boolean(data?.statusCodes.includes(401)) ||
    (!authenticated && Boolean(data?.errors.length));

  return (
    <div className="space-y-5">
      <PageHeader
        title="Sales"
        description="Order-to-cash workspace — quotations, orders, deliveries, invoices, returns, pricing, and customer credit."
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
              href="/sales/orders"
              className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground shadow-sm transition-opacity duration-200 hover:opacity-90"
            >
              <ShoppingCart className="size-3.5" />
              Orders
            </Link>
            <Link
              href="/sales/invoices"
              className="inline-flex h-8 cursor-pointer items-center rounded-lg border border-border/80 bg-card px-3 text-sm font-medium shadow-sm transition-colors duration-200 hover:bg-muted"
            >
              Invoices
            </Link>
          </div>
        }
      />

      {authBlocked ? (
        <div className="rounded-xl border border-dashed border-amber-300/80 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Sign in to load live sales data.{" "}
          <Link href="/login" className="cursor-pointer font-medium underline underline-offset-2">
            Go to login
          </Link>
        </div>
      ) : null}

      {data?.partial && !authBlocked ? (
        <div className="rounded-xl border border-border/80 bg-muted/40 px-4 py-2.5 text-xs text-muted-foreground">
          Some sales endpoints returned errors. Showing available records.
        </div>
      ) : null}

      <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
        <FinanceKpiCard
          label="Open quotations"
          value={loading ? "—" : String(kpis.openQuotes)}
          hint={`${formatInr(kpis.quoteValue)} total quote value`}
          icon={FileText}
          tone={kpis.openQuotes > 0 ? "warning" : "success"}
        />
        <FinanceKpiCard
          label="Open orders"
          value={loading ? "—" : String(kpis.openOrders)}
          hint={`${formatInr(kpis.orderValue)} order book`}
          icon={ShoppingCart}
          tone="default"
        />
        <FinanceKpiCard
          label="Invoice outstanding"
          value={loading ? "—" : formatInr(kpis.invoiceOutstanding)}
          hint={`${data?.invoices.length ?? 0} invoices · ${countByStatus(data?.invoices ?? [], ["posted", "approved", "paid"])} posted/paid`}
          icon={Receipt}
          tone={kpis.invoiceOutstanding > 0 ? "warning" : "success"}
        />
        <FinanceKpiCard
          label="Credit holds"
          value={loading ? "—" : String(kpis.creditHolds)}
          hint={`${data?.customerCredit.length ?? 0} credit accounts`}
          icon={WalletCards}
          tone={kpis.creditHolds > 0 ? "danger" : "success"}
        />
      </div>

      <SalesPipelineFunnel counts={pipelineCounts} loading={loading} />

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {salesQuickLinks.map((link) => {
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
          <Badge variant="secondary">{salesWorkspaceGroups.length} areas</Badge>
        </div>
        <div className="grid gap-3 lg:grid-cols-3">
          {salesWorkspaceGroups.map((group) => {
            const Icon = group.icon;
            const resources = resolveSalesGroupResources(group);
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
                        href={`/sales/${resource.key}`}
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
          title="Recent orders"
          subtitle="Latest sales orders"
          href="/sales/orders"
          loading={loading}
          rows={recentOrders}
          empty="No sales orders yet."
        />
        <DocTable
          title="Recent quotations"
          subtitle="Latest customer proposals"
          href="/sales/quotations"
          loading={loading}
          rows={recentQuotes}
          empty="No quotations yet."
          showCustomer
        />
        <div className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm">
          <div className="flex items-center justify-between gap-2 border-b border-border/70 px-4 py-3">
            <div>
              <h2 className="text-sm font-medium tracking-tight">Credit watch</h2>
              <p className="text-[11px] text-muted-foreground">Holds and utilization</p>
            </div>
            <Link
              href="/sales/customer-credit"
              className="cursor-pointer text-xs font-medium text-primary transition-opacity duration-200 hover:opacity-80"
            >
              View all
            </Link>
          </div>
          <ul className="divide-y divide-border/60">
            {loading ? (
              <li className="px-4 py-8 text-center text-sm text-muted-foreground">Loading…</li>
            ) : creditWatch.length === 0 ? (
              <li className="px-4 py-8 text-center text-sm text-muted-foreground">
                No credit records.
              </li>
            ) : (
              creditWatch.map((row, idx) => {
                const used = asNumber(row.credit_used);
                const limit = asNumber(row.credit_limit);
                const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
                return (
                  <li
                    key={String(row.id ?? idx)}
                    className="px-4 py-2.5 transition-colors duration-150 hover:bg-accent/30"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-medium">
                        Limit {formatInr(limit)}
                      </p>
                      {row.credit_hold === true ? (
                        <FinanceStatusBadge status="credit_hold" />
                      ) : (
                        <FinanceStatusBadge status={String(row.status ?? "active")} />
                      )}
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Used {formatInr(used)} · Available {formatInr(asNumber(row.credit_available))}
                    </p>
                    <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className={`h-full rounded-full transition-[width] duration-300 ${
                          pct >= 90 ? "bg-red-600" : pct >= 70 ? "bg-amber-500" : "bg-sky-600"
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
  showCustomer = false,
}: {
  title: string;
  subtitle: string;
  href: string;
  loading: boolean;
  rows: SalesRow[];
  empty: string;
  showCustomer?: boolean;
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
                  <td className="max-w-[180px] truncate px-4 py-2.5">
                    <p className="font-medium text-foreground">
                      {String(row.document_number ?? "—")}
                    </p>
                    {showCustomer ? (
                      <p className="truncate text-[11px] text-muted-foreground">
                        {String(row.customer_name ?? "")}
                      </p>
                    ) : null}
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
