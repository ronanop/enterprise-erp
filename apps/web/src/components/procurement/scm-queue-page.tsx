"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ClipboardList,
  IndianRupee,
  PackageCheck,
  RefreshCw,
  ShoppingCart,
} from "lucide-react";

import { FinanceKpiCard } from "@/components/finance/finance-kpi-card";
import { FinanceStatusBadge } from "@/components/finance/finance-status-badge";
import { PageHeader } from "@/components/layout/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ApiClientError } from "@/services/api-client";
import {
  formatInr,
  listScmQueue,
  type ScmQueueItem,
} from "@/services/procurement-service";

export function ScmQueuePage() {
  const [rows, setRows] = useState<ScmQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await listScmQueue());
    } catch (err) {
      setRows([]);
      setError(err instanceof ApiClientError ? err.message : "Failed to load SCM queue");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const kpis = useMemo(() => {
    const awaiting = rows.filter((r) => r.can_create_po).length;
    const withPo = rows.filter((r) => !r.can_create_po).length;
    const vendorTotal = rows.reduce((sum, r) => sum + (r.vendor_total || 0), 0);
    return { awaiting, withPo, vendorTotal, total: rows.length };
  }, [rows]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="SCM Queue"
        description="Finance-approved OVFs shared to SCM — create vendor purchase orders."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="cursor-pointer transition-colors duration-200"
              onClick={() => void load()}
              disabled={loading}
            >
              <RefreshCw className={`mr-1.5 size-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Link
              href="/procurement/vendor-po"
              className={cn(
                buttonVariants({ size: "sm" }),
                "cursor-pointer transition-colors duration-200",
              )}
            >
              <ShoppingCart className="mr-1.5 size-3.5" />
              Vendors &amp; PO
            </Link>
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <FinanceKpiCard label="Shared OVFs" value={String(kpis.total)} icon={ClipboardList} />
        <FinanceKpiCard
          label="Awaiting PO"
          value={String(kpis.awaiting)}
          tone="warning"
          icon={ShoppingCart}
        />
        <FinanceKpiCard
          label="PO created"
          value={String(kpis.withPo)}
          tone="success"
          icon={PackageCheck}
        />
        <FinanceKpiCard
          label="Vendor buy total"
          value={formatInr(kpis.vendorTotal)}
          icon={IndianRupee}
        />
      </div>

      {error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] text-left text-sm">
            <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">OVF #</th>
                <th className="px-3 py-2 font-medium">Customer</th>
                <th className="px-3 py-2 font-medium">Quote / Account</th>
                <th className="px-3 py-2 font-medium">Vendor lines</th>
                <th className="px-3 py-2 font-medium">Buy total</th>
                <th className="px-3 py-2 font-medium">PO status</th>
                <th className="px-3 py-2 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading && rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                    Loading SCM queue…
                  </td>
                </tr>
              ) : null}
              {!loading && rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                    No OVFs shared to SCM yet. Share an approved OVF from CRM Sales.
                  </td>
                </tr>
              ) : null}
              {rows.map((row) => (
                <tr
                  key={row.ovf_id}
                  className="border-b border-border/70 transition-colors duration-150 hover:bg-muted/30"
                >
                  <td className="px-3 py-2 font-medium tabular-nums">{row.ovf_no}</td>
                  <td className="px-3 py-2">{row.customer_name || "—"}</td>
                  <td className="px-3 py-2">
                    <div className="text-foreground">{row.quote_name || "—"}</div>
                    <div className="text-xs text-muted-foreground">{row.account_name || ""}</div>
                  </td>
                  <td className="px-3 py-2 tabular-nums">{row.vendor_line_count}</td>
                  <td className="px-3 py-2 tabular-nums">{formatInr(row.vendor_total)}</td>
                  <td className="px-3 py-2">
                    {row.purchase_order_number ? (
                      <div className="space-y-1">
                        <FinanceStatusBadge status={row.purchase_order_status || "draft"} />
                        <div className="text-xs text-muted-foreground">{row.purchase_order_number}</div>
                      </div>
                    ) : (
                      <FinanceStatusBadge status="pending" />
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {row.can_create_po ? (
                      <Link
                        href={`/procurement/scm/ovf/${row.ovf_id}/po`}
                        className={cn(
                          buttonVariants({ size: "sm" }),
                          "cursor-pointer transition-colors duration-200",
                        )}
                      >
                        Create PO
                      </Link>
                    ) : row.purchase_order_id ? (
                      <Link
                        href={`/procurement/orders/${row.purchase_order_id}`}
                        className={cn(
                          buttonVariants({ size: "sm", variant: "outline" }),
                          "cursor-pointer transition-colors duration-200",
                        )}
                      >
                        Open PO
                      </Link>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
