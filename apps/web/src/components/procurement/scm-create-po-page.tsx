"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, RefreshCw } from "lucide-react";

import { FinanceSelect } from "@/components/finance/journals/finance-form-field";
import { PageHeader } from "@/components/layout/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ApiClientError } from "@/services/api-client";
import {
  createPoFromOvf,
  formatInr,
  getScmOvfPreview,
  listVendorOptions,
  type ScmOvfPreview,
  type VendorOption,
} from "@/services/procurement-service";

export function ScmCreatePoPage({ ovfId }: { ovfId: string }) {
  const router = useRouter();
  const [preview, setPreview] = useState<ScmOvfPreview | null>(null);
  const [vendors, setVendors] = useState<VendorOption[]>([]);
  const [vendorId, setVendorId] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [ovf, vendorRows] = await Promise.all([
        getScmOvfPreview(ovfId),
        listVendorOptions().catch(() => [] as VendorOption[]),
      ]);
      setPreview(ovf);
      setVendors(vendorRows);
      if (ovf.vendor_payment_days > 0) {
        setPaymentTerms(`Net ${ovf.vendor_payment_days} days`);
      }
      if (!ovf.can_create_po && ovf.purchase_order_id) {
        setBanner(`PO ${ovf.purchase_order_number} already exists for this OVF.`);
      }
    } catch (err) {
      setPreview(null);
      setError(err instanceof ApiClientError ? err.message : "Failed to load OVF");
    } finally {
      setLoading(false);
    }
  }, [ovfId]);

  useEffect(() => {
    void load();
  }, [load]);

  const vendorTotal = useMemo(
    () => (preview?.vendor_lines ?? []).reduce((sum, ln) => sum + (ln.line_total || 0), 0),
    [preview],
  );

  async function submit(finalize: boolean) {
    if (!preview?.can_create_po) return;
    if (!vendorId) {
      setError("Select a vendor before creating the purchase order");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const order = await createPoFromOvf(ovfId, {
        vendor_id: vendorId,
        payment_terms: paymentTerms || null,
        finalize,
      });
      router.push(`/procurement/orders/${order.id}`);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to create purchase order");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={preview ? `Create PO · ${preview.ovf_no}` : "Create vendor PO"}
        description="Raise a vendor purchase order from the Finance-approved OVF commercial lock."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/procurement/scm"
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "cursor-pointer transition-colors duration-200",
              )}
            >
              <ArrowLeft className="mr-1.5 size-3.5" />
              Queue
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
          </div>
        }
      />

      {banner ? (
        <div className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900">
          {banner}{" "}
          {preview?.purchase_order_id ? (
            <Link
              href={`/procurement/orders/${preview.purchase_order_id}`}
              className="cursor-pointer font-medium underline-offset-2 hover:underline"
            >
              Open PO
            </Link>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {loading && !preview ? (
        <p className="text-sm text-muted-foreground">Loading OVF preview…</p>
      ) : null}

      {preview ? (
        <>
          <section className="grid gap-3 rounded-lg border border-border bg-card p-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <dt className="text-xs text-muted-foreground">Customer</dt>
              <dd className="mt-1 text-sm font-medium">{preview.customer_name || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Customer PO #</dt>
              <dd className="mt-1 text-sm font-medium">{preview.po_number || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Quote</dt>
              <dd className="mt-1 text-sm font-medium">{preview.quote_name || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Vendor buy total</dt>
              <dd className="mt-1 text-sm font-medium tabular-nums">{formatInr(vendorTotal)}</dd>
            </div>
          </section>

          <section className="grid gap-3 rounded-lg border border-border bg-card p-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="scm-vendor">
                Vendor
              </label>
              <FinanceSelect
                id="scm-vendor"
                value={vendorId}
                onChange={(e) => setVendorId(e.target.value)}
                disabled={!preview.can_create_po || busy}
              >
                <option value="">Select vendor…</option>
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label}
                  </option>
                ))}
              </FinanceSelect>
              {vendors.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No vendors found. Create vendors in Master Data first.
                </p>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="scm-terms">
                Payment terms
              </label>
              <Input
                id="scm-terms"
                value={paymentTerms}
                onChange={(e) => setPaymentTerms(e.target.value)}
                disabled={!preview.can_create_po || busy}
                className="h-9"
                placeholder="Net 30 days"
              />
            </div>
          </section>

          <div className="overflow-hidden rounded-lg border border-border bg-card">
            <div className="border-b border-border px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Vendor lines (from OVF)
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">#</th>
                    <th className="px-3 py-2 font-medium">Product</th>
                    <th className="px-3 py-2 font-medium">Qty</th>
                    <th className="px-3 py-2 font-medium">Unit cost</th>
                    <th className="px-3 py-2 font-medium">Line total</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.vendor_lines.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
                        No vendor-side lines on this OVF.
                      </td>
                    </tr>
                  ) : null}
                  {preview.vendor_lines.map((ln) => (
                    <tr key={ln.line_id} className="border-b border-border/70">
                      <td className="px-3 py-2 tabular-nums">{ln.line_no}</td>
                      <td className="px-3 py-2">{ln.product_name}</td>
                      <td className="px-3 py-2 tabular-nums">{ln.qty}</td>
                      <td className="px-3 py-2 tabular-nums">{formatInr(ln.unit_price)}</td>
                      <td className="px-3 py-2 tabular-nums">{formatInr(ln.line_total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {preview.can_create_po ? (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                className="cursor-pointer transition-colors duration-200"
                disabled={busy}
                onClick={() => void submit(false)}
              >
                Save draft PO
              </Button>
              <Button
                type="button"
                className="cursor-pointer transition-colors duration-200"
                disabled={busy}
                onClick={() => void submit(true)}
              >
                Finalize &amp; issue PO
              </Button>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
