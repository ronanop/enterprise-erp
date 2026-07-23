"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, RefreshCw } from "lucide-react";

import { FinanceStatusBadge } from "@/components/finance/finance-status-badge";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ApiClientError } from "@/services/api-client";
import {
  finalizeScmOrder,
  formatInr,
  getPurchaseOrder,
  listVendorOptions,
  updateLineReceipt,
  type ProcOrder,
} from "@/services/procurement-service";

function lineGrn(qty: number, received: number, status: string): string {
  if (status === "received" || status === "closed" || (qty > 0 && received >= qty)) return "delivered";
  if (received > 0) return "partial";
  return "pending";
}

export function OrderDetailPage({ orderId }: { orderId: string }) {
  const [order, setOrder] = useState<ProcOrder | null>(null);
  const [vendorName, setVendorName] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [qtyDraft, setQtyDraft] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [row, vendors] = await Promise.all([
        getPurchaseOrder(orderId),
        listVendorOptions().catch(() => []),
      ]);
      setOrder(row);
      setVendorName(vendors.find((v) => v.id === row.vendor_id)?.label || row.vendor_id);
      setQtyDraft(
        Object.fromEntries(
          (row.lines || []).map((ln) => [ln.id, String(ln.quantity_received ?? 0)]),
        ),
      );
    } catch (err) {
      setOrder(null);
      setError(err instanceof ApiClientError ? err.message : "Failed to load purchase order");
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onFinalize() {
    if (!order) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await finalizeScmOrder(order.id);
      setOrder(updated);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to finalize PO");
    } finally {
      setBusy(false);
    }
  }

  async function onReceipt(lineId: string, grnStatus: "pending" | "partial" | "delivered") {
    if (!order) return;
    const line = order.lines.find((ln) => ln.id === lineId);
    if (!line) return;
    let qty = Number(qtyDraft[lineId] ?? line.quantity_received ?? 0);
    if (grnStatus === "delivered") qty = line.quantity;
    if (grnStatus === "pending") qty = 0;
    if (grnStatus === "partial" && qty <= 0) {
      setError("Enter quantity received before marking partial");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const updated = await updateLineReceipt(order.id, lineId, {
        quantity_received: qty,
        grn_status: grnStatus,
      });
      setOrder(updated);
      setQtyDraft(
        Object.fromEntries(
          (updated.lines || []).map((ln) => [ln.id, String(ln.quantity_received ?? 0)]),
        ),
      );
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to update GRN");
    } finally {
      setBusy(false);
    }
  }

  const canReceipt =
    order &&
    !["draft", "submitted", "cancelled"].includes((order.status || "").toLowerCase());
  const canFinalize =
    order &&
    order.status === "draft" &&
    order.source_module === "crm" &&
    (order.lines?.length ?? 0) > 0;

  return (
    <div className="space-y-4">
      <PageHeader
        title={order ? order.document_number : "Purchase order"}
        description="Vendor PO detail and line-level goods receipt tracking."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/procurement/vendor-po"
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "cursor-pointer transition-colors duration-200",
              )}
            >
              <ArrowLeft className="mr-1.5 size-3.5" />
              Vendors &amp; PO
            </Link>
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
            {canFinalize ? (
              <Button
                type="button"
                size="sm"
                className="cursor-pointer transition-colors duration-200"
                disabled={busy}
                onClick={() => void onFinalize()}
              >
                Finalize &amp; issue
              </Button>
            ) : null}
          </div>
        }
      />

      {error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {loading && !order ? (
        <p className="text-sm text-muted-foreground">Loading purchase order…</p>
      ) : null}

      {order ? (
        <>
          <section className="grid gap-3 rounded-lg border border-border bg-card p-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <dt className="text-xs text-muted-foreground">Vendor</dt>
              <dd className="mt-1 text-sm font-medium">{vendorName}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Status</dt>
              <dd className="mt-1">
                <FinanceStatusBadge status={order.status} />
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Total</dt>
              <dd className="mt-1 text-sm font-medium tabular-nums">{formatInr(order.total_amount)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Payment terms</dt>
              <dd className="mt-1 text-sm font-medium">{order.payment_terms || "—"}</dd>
            </div>
          </section>

          <div className="overflow-hidden rounded-lg border border-border bg-card">
            <div className="border-b border-border px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Lines &amp; GRN
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[960px] text-left text-sm">
                <thead className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">#</th>
                    <th className="px-3 py-2 font-medium">Product</th>
                    <th className="px-3 py-2 font-medium">Ordered</th>
                    <th className="px-3 py-2 font-medium">Received</th>
                    <th className="px-3 py-2 font-medium">Unit cost</th>
                    <th className="px-3 py-2 font-medium">GRN</th>
                    <th className="px-3 py-2 font-medium">Update</th>
                  </tr>
                </thead>
                <tbody>
                  {(order.lines || []).map((ln) => {
                    const grn = lineGrn(ln.quantity, ln.quantity_received, ln.status);
                    return (
                      <tr key={ln.id} className="border-b border-border/70">
                        <td className="px-3 py-2 tabular-nums">{ln.line_number}</td>
                        <td className="px-3 py-2">{ln.product_name || ln.product_code || "—"}</td>
                        <td className="px-3 py-2 tabular-nums">{ln.quantity}</td>
                        <td className="px-3 py-2">
                          <Input
                            className="h-8 w-24"
                            value={qtyDraft[ln.id] ?? "0"}
                            disabled={!canReceipt || busy}
                            onChange={(e) =>
                              setQtyDraft((prev) => ({ ...prev, [ln.id]: e.target.value }))
                            }
                          />
                        </td>
                        <td className="px-3 py-2 tabular-nums">{formatInr(ln.unit_cost)}</td>
                        <td className="px-3 py-2">
                          <Badge variant="outline" className="uppercase">
                            {grn}
                          </Badge>
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap gap-1">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-7 cursor-pointer px-2 text-xs transition-colors duration-200"
                              disabled={!canReceipt || busy}
                              onClick={() => void onReceipt(ln.id, "pending")}
                            >
                              Pending
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-7 cursor-pointer px-2 text-xs transition-colors duration-200"
                              disabled={!canReceipt || busy}
                              onClick={() => void onReceipt(ln.id, "partial")}
                            >
                              Partial
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              className="h-7 cursor-pointer px-2 text-xs transition-colors duration-200"
                              disabled={!canReceipt || busy}
                              onClick={() => void onReceipt(ln.id, "delivered")}
                            >
                              Delivered
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
