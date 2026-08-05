"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  CircleDot,
  ClipboardList,
  PackageCheck,
  RefreshCw,
  ShoppingCart,
  X,
} from "lucide-react";

import { FinanceKpiCard } from "@/components/finance/finance-kpi-card";
import { FinanceStatusBadge } from "@/components/finance/finance-status-badge";
import { ProcurementPageHeader } from "@/components/procurement/procurement-page-header";
import { procurementUi } from "@/components/procurement/procurement-ui";
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
  formatInr,
  invalidateProcurementListCache,
  loadProcurementOverview,
  sumField,
  type ProcurementOverview,
  type ProcurementRow,
} from "@/services/procurement-service";
import { getUnseenScmOvfIds } from "@/utils/scm-queue-seen";

function recentByDate(rows: ProcurementRow[], limit = 6): ProcurementRow[] {
  return [...rows]
    .sort((a, b) => String(b.document_date ?? "").localeCompare(String(a.document_date ?? "")))
    .slice(0, limit);
}

/** Same rule as GrnsListPage — GRN stage = POs with partial/delivered receipt. */
function isReceiptPo(row: ProcurementRow): boolean {
  const status = asStatus(row.status);
  if (status === "draft" || status === "submitted" || status === "cancelled") return false;
  const grn = asStatus(row.grn_status);
  return grn === "partial" || grn === "closed" || grn === "delivered";
}

export function ProcurementDashboard() {
  const [data, setData] = useState<ProcurementOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [dismissedArrivalKey, setDismissedArrivalKey] = useState<string | null>(null);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    setAuthenticated(isAuthenticated());
  }, []);

  const load = useCallback(async (force = false) => {
    if (force) invalidateProcurementListCache();
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

  // Light poll so newly shared OVFs surface without a manual refresh.
  useEffect(() => {
    if (!authenticated) return;
    const id = window.setInterval(() => {
      void loadProcurementOverview().then(setData).catch(() => undefined);
    }, 45_000);
    return () => window.clearInterval(id);
  }, [authenticated]);

  const [newQueueItems, setNewQueueItems] = useState<ProcurementRow[]>([]);

  useEffect(() => {
    const queue = data?.scmQueue ?? [];
    const ids = queue.map((row) => String(row.ovf_id ?? "")).filter(Boolean);
    const unseen = new Set(getUnseenScmOvfIds(ids));
    setNewQueueItems(queue.filter((row) => unseen.has(String(row.ovf_id ?? ""))));
  }, [data]);

  const arrivalKey = useMemo(
    () =>
      newQueueItems
        .map((row) => String(row.ovf_id ?? ""))
        .filter(Boolean)
        .sort()
        .join(","),
    [newQueueItems],
  );

  const showArrivalPopup =
    newQueueItems.length > 0 && dismissedArrivalKey !== arrivalKey;

  const kpis = useMemo(() => {
    if (!data) {
      return {
        scmPending: 0,
        openPos: 0,
        draftPos: 0,
        draftValue: 0,
        deliveredPos: 0,
        poValue: 0,
      };
    }
    const scmPending = data.scmQueue.filter((row) => !row.purchase_order_id).length;
    const closedStatuses = new Set([
      "draft",
      "received",
      "delivered",
      "closed",
      "cancelled",
      "completed",
    ]);
    const deliveredStatuses = new Set(["received", "delivered", "closed"]);
    const openOrders = data.orders.filter((row) => {
      const status = asStatus(row.status);
      if (!status) return false;
      return !closedStatuses.has(status);
    });
    const draftOrders = data.orders.filter((row) => {
      if (asStatus(row.status) !== "draft") return false;
      // SCM dashboard: only CRM OVF-sourced drafts (ignore seed / non-SCM demos).
      return asStatus(row.source_module) === "crm";
    });
    const deliveredOrders = data.orders.filter((row) => {
      const status = asStatus(row.status);
      if (!status || !deliveredStatuses.has(status)) return false;
      return asStatus(row.source_module) === "crm";
    });
    return {
      scmPending,
      openPos: openOrders.length,
      draftPos: draftOrders.length,
      draftValue: sumField(draftOrders, "total_amount"),
      deliveredPos: deliveredOrders.length,
      poValue: sumField(openOrders, "total_amount"),
    };
  }, [data]);

  const crmOrders = useMemo(
    () => (data?.orders ?? []).filter((row) => asStatus(row.source_module) === "crm"),
    [data],
  );

  const receiptPos = useMemo(
    () => (data?.vendorPos ?? []).filter(isReceiptPo),
    [data],
  );

  const pipelineCounts = useMemo(
    () => ({
      scm: data?.scmQueue.length ?? 0,
      // SCM pipeline: only CRM OVF-sourced POs (exclude seed / non-SCM demos).
      orders: crmOrders.length,
      // Align with /procurement/grns — receipt POs, not legacy GRN documents.
      grns: receiptPos.length,
      "delivery-challan": 0,
      "delivery-status": 0,
    }),
    [data, crmOrders, receiptPos],
  );

  const recentOrders = useMemo(() => recentByDate(crmOrders), [crmOrders]);
  const recentGrns = useMemo(
    () =>
      recentByDate(receiptPos).map((row) => ({
        ...row,
        status: row.grn_status ?? row.status,
        subtotal_amount: row.total_amount,
      })),
    [receiptPos],
  );
  const recentInvoices = useMemo(() => recentByDate(data?.invoices ?? []), [data]);

  const authBlocked =
    Boolean(data?.statusCodes.includes(401)) ||
    (!authenticated && Boolean(data?.errors.length));

  return (
    <div className={procurementUi.page}>
      <ProcurementPageHeader
        title="Procurement"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void load(true)}
              disabled={loading}
              className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-border/80 bg-card px-3 text-sm font-medium shadow-sm transition-colors duration-200 hover:bg-muted disabled:opacity-60"
            >
              <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
            <div className="relative">
              <Link
                href="/procurement/scm"
                className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground shadow-sm transition-opacity duration-200 hover:opacity-90"
              >
                <ClipboardList className="size-3.5" />
                SCM Queue
                {newQueueItems.length > 0 ? (
                  <span className="ml-0.5 inline-flex min-w-5 items-center justify-center rounded-md bg-amber-400 px-1.5 py-0.5 text-[10px] font-semibold text-slate-900 tabular-nums">
                    {newQueueItems.length}
                  </span>
                ) : null}
              </Link>
              {showArrivalPopup ? (
                <div
                  role="status"
                  className="absolute right-0 top-[calc(100%+0.5rem)] z-30 w-[min(22rem,calc(100vw-2rem))] rounded-lg border border-sky-200 bg-card p-3 shadow-md"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">
                        {newQueueItems.length === 1
                          ? "New PO arrived in SCM Queue"
                          : `${newQueueItems.length} new POs arrived in SCM Queue`}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {(() => {
                          const first = newQueueItems[0];
                          const label =
                            String(first?.customer_name ?? first?.ovf_no ?? "OVF").trim() || "OVF";
                          return newQueueItems.length === 1
                            ? `${label} is ready for purchase order.`
                            : `Including ${label} — open the queue to review.`;
                        })()}
                      </p>
                    </div>
                    <button
                      type="button"
                      aria-label="Dismiss notification"
                      onClick={() => setDismissedArrivalKey(arrivalKey)}
                      className="cursor-pointer rounded-md p-1 text-muted-foreground transition-colors duration-200 hover:bg-muted hover:text-foreground"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                  <Link
                    href="/procurement/scm"
                    className="mt-2.5 inline-flex cursor-pointer text-xs font-medium text-sky-700 transition-opacity duration-200 hover:opacity-80"
                  >
                    Open SCM Queue →
                  </Link>
                </div>
              ) : null}
            </div>
            <Link
              href="/procurement/orders"
              className="inline-flex h-8 cursor-pointer items-center rounded-lg border border-border/80 bg-card px-3 text-sm font-medium shadow-sm transition-colors duration-200 hover:bg-muted"
            >
              Purchase Orders
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
          label="OVFs awaiting PO"
          value={loading ? "—" : String(kpis.scmPending)}
          hint={`${data?.scmQueue.length ?? 0} in SCM queue`}
          icon={ClipboardList}
          tone={kpis.scmPending > 0 ? "warning" : "success"}
          href="/procurement/scm?filter=open"
        />
        <FinanceKpiCard
          label="Open purchase orders"
          value={loading ? "—" : String(kpis.openPos)}
          hint={`${formatInr(kpis.poValue)} committed spend`}
          icon={ShoppingCart}
          tone="default"
          href="/procurement/orders?filter=open"
        />
        <FinanceKpiCard
          label="Delivered POs"
          value={loading ? "—" : String(kpis.deliveredPos)}
          hint="Fully received purchase orders"
          icon={PackageCheck}
          tone={kpis.deliveredPos > 0 ? "success" : "default"}
          href="/procurement/orders?filter=delivered"
        />
        <FinanceKpiCard
          label="Draft purchase orders"
          value={loading ? "—" : String(kpis.draftPos)}
          hint={`${formatInr(kpis.draftValue)} draft value`}
          icon={CircleDot}
          tone={kpis.draftPos > 0 ? "warning" : "success"}
          href="/procurement/orders?filter=draft"
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
        <div className="grid gap-3 lg:grid-cols-2">
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

      <div className="grid gap-3 xl:grid-cols-3">
        <DocTable
          title="Recent purchase orders"
          subtitle="Latest committed spend"
          href="/procurement/orders"
          loading={loading}
          rows={recentOrders}
          empty="No purchase orders yet."
          numberField="total_amount"
        />
        <DocTable
          title="Recent GRNs"
          subtitle="Latest goods receipts"
          href="/procurement/grns"
          loading={loading}
          rows={recentGrns}
          empty="No GRNs yet."
          numberField="subtotal_amount"
        />
        <DocTable
          title="Recent vendor invoices"
          subtitle="Latest payables"
          href="/procurement/invoices"
          loading={loading}
          rows={recentInvoices}
          empty="No vendor invoices yet."
          numberField="total_amount"
        />
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
  numberField,
}: {
  title: string;
  subtitle: string;
  href: string;
  loading: boolean;
  rows: ProcurementRow[];
  empty: string;
  numberField: string;
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
                    {String(row.document_number ?? row.ovf_no ?? "—")}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {String(row.document_date ?? "—")}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs tabular-nums text-foreground">
                    {formatInr(asNumber(row[numberField]))}
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
