"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  Building2,
  ClipboardList,
  Package,
  Percent,
  RefreshCw,
  ShoppingCart,
  Wallet,
  type LucideIcon,
} from "lucide-react";

import { FinanceStatusBadge } from "@/components/finance/finance-status-badge";
import { FinanceField } from "@/components/finance/journals/finance-form-field";
import { PageHeader } from "@/components/layout/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ApiClientError } from "@/services/api-client";
import {
  getScmOvfPreview,
  updateScmOvfCharges,
  type ScmOvfPreview,
  type ScmVendorLine,
} from "@/services/procurement-service";

function textOrDash(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  const text = String(value).trim();
  return text || "—";
}

function formatPoDate(value: string | null | undefined): string {
  if (!value) return "—";
  const raw = String(value).trim();
  if (!raw) return "—";
  const d = new Date(/^\d{4}-\d{2}-\d{2}/.test(raw) ? `${raw.slice(0, 10)}T00:00:00` : raw);
  if (Number.isNaN(d.getTime())) return raw.slice(0, 10);
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function moneyPrecise(value: number | null | undefined): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);
}

function pct(value: number | null | undefined): string {
  const n = Number(value) || 0;
  return `${n.toFixed(2)}%`;
}

const CHARGE_NO_SPINNER =
  "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";

function parseChargeInput(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed === "") return "";
  if (!/^\d*\.?\d*$/.test(trimmed)) return null;
  const cleaned = trimmed.replace(/^0+(?=\d)/, "");
  return cleaned === "" ? "0" : cleaned;
}

function normalizeChargeOnBlur(value: string): string {
  if (value.trim() === "" || value === ".") return "0";
  return value;
}

function DetailItem({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0 space-y-1", className)}>
      <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="text-sm font-medium text-foreground break-words">{children}</dd>
    </div>
  );
}

function SectionCard({
  title,
  icon: Icon,
  subtitle,
  children,
}: {
  title: string;
  icon?: LucideIcon;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4 rounded-lg border-2 border-foreground/20 bg-card p-4 shadow-sm">
      <div className="text-center">
        <h2 className="inline-flex items-center justify-center gap-2 text-base font-semibold tracking-tight text-foreground sm:text-lg">
          {Icon ? (
            <Icon className="size-5 shrink-0 text-[#0369A1]" aria-hidden />
          ) : null}
          {title}
        </h2>
        <div className="mx-auto mt-2.5 flex w-36 flex-col gap-1.5" aria-hidden>
          <span className="h-0.5 w-full rounded-full bg-foreground/55" />
          <span className="h-0.5 w-full rounded-full bg-foreground/35" />
        </div>
        {subtitle ? (
          <p className="mt-2 text-xs text-muted-foreground">{subtitle}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function ChargeTable({
  rows,
  emptyLabel,
}: {
  rows: ScmVendorLine[];
  emptyLabel: string;
}) {
  const totals = useMemo(() => {
    return rows.reduce(
      (acc, row) => {
        acc.total += Number(row.line_total) || 0;
        acc.gst += Number(row.gst_amount) || 0;
        acc.withGst += Number(row.total_with_gst) || 0;
        return acc;
      },
      { total: 0, gst: 0, withGst: 0 },
    );
  }, [rows]);

  const gstLabel =
    rows.length > 0 ? `GST (${Number(rows[0]?.gst_pct || 18).toFixed(0)}%)` : "GST";

  return (
    <div className="overflow-hidden rounded-md border border-border">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">S No.</th>
              <th className="px-3 py-2 font-medium">Product</th>
              <th className="px-3 py-2 font-medium">Description</th>
              <th className="px-3 py-2 font-medium text-right">Qty</th>
              <th className="px-3 py-2 font-medium text-right">Unit (INR)</th>
              <th className="px-3 py-2 font-medium text-right">Total (INR)</th>
              <th className="px-3 py-2 font-medium text-right">{gstLabel}</th>
              <th className="px-3 py-2 font-medium text-right">With GST (INR)</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-muted-foreground">
                  {emptyLabel}
                </td>
              </tr>
            ) : (
              rows.map((row, index) => (
                <tr key={row.line_id} className="border-b border-border/70">
                  <td className="px-3 py-2 tabular-nums text-muted-foreground">{index + 1}</td>
                  <td className="px-3 py-2 font-medium">{textOrDash(row.product_name)}</td>
                  <td className="max-w-[280px] px-3 py-2 text-muted-foreground">
                    {textOrDash(row.description || row.product_name)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{row.qty}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {moneyPrecise(row.unit_price)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {moneyPrecise(row.line_total)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {moneyPrecise(row.gst_amount)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums font-medium">
                    {moneyPrecise(row.total_with_gst)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {rows.length > 0 ? (
            <tfoot className="border-t border-border bg-muted/30 text-sm font-semibold">
              <tr>
                <td colSpan={5} className="px-3 py-2 text-right">
                  Totals
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{moneyPrecise(totals.total)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{moneyPrecise(totals.gst)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{moneyPrecise(totals.withGst)}</td>
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>
    </div>
  );
}

export function ScmOvfViewPage({ ovfId }: { ovfId: string }) {
  const [preview, setPreview] = useState<ScmOvfPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chargesBusy, setChargesBusy] = useState(false);
  const [chargesBanner, setChargesBanner] = useState<string | null>(null);
  const [freight, setFreight] = useState("0");
  const [additionalCharges, setAdditionalCharges] = useState("0");
  const [financeCostPct, setFinanceCostPct] = useState("0");

  const syncChargesFromPreview = useCallback((row: ScmOvfPreview) => {
    setFreight(String(Number(row.freight) || 0));
    setAdditionalCharges(String(Number(row.additional_charges) || 0));
    setFinanceCostPct(String(Number(row.finance_cost_pct) || 0));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setChargesBanner(null);
    try {
      const row = await getScmOvfPreview(ovfId);
      setPreview(row);
      syncChargesFromPreview(row);
    } catch (err) {
      setPreview(null);
      setError(err instanceof ApiClientError ? err.message : "Failed to load OVF from CRM");
    } finally {
      setLoading(false);
    }
  }, [ovfId, syncChargesFromPreview]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveCharges() {
    if (!preview || preview.purchase_order_id) return;
    setChargesBusy(true);
    setError(null);
    setChargesBanner(null);
    try {
      const row = await updateScmOvfCharges(ovfId, {
        freight: Number(freight) || 0,
        additional_charges: Number(additionalCharges) || 0,
        finance_cost_pct: Number(financeCostPct) || 0,
      });
      setPreview(row);
      syncChargesFromPreview(row);
      setChargesBanner("Freight & finance saved. Sales will see these values on the OVF.");
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : "Failed to update freight and finance",
      );
    } finally {
      setChargesBusy(false);
    }
  }

  const vendorLabel = useMemo(() => {
    if (!preview) return "—";
    const oem = preview.oem_name?.trim() || "";
    const vendor = preview.vendor_name?.trim() || "";
    if (vendor && oem && vendor.toLowerCase() !== oem.toLowerCase()) {
      return `${vendor} (${oem})`;
    }
    return vendor || oem || "—";
  }, [preview]);

  const marginSummary = useMemo(() => {
    if (!preview) {
      return { customerTotal: 0, vendorTotal: 0, margin: 0, marginPct: 0 };
    }
    const customerTotal = (preview.customer_lines || []).reduce(
      (sum, row) => sum + (Number(row.line_total) || 0),
      0,
    );
    const vendorTotal = (preview.vendor_lines || []).reduce(
      (sum, row) => sum + (Number(row.line_total) || 0),
      0,
    );
    const freightAmount = Number(freight) || 0;
    const additionalAmount = Number(additionalCharges) || 0;
    const financePct = Number(financeCostPct) || 0;
    const financeAmount = (vendorTotal * financePct) / 100;
    const margin =
      customerTotal - vendorTotal - freightAmount - additionalAmount - financeAmount;
    const marginPct = customerTotal ? (margin / customerTotal) * 100 : 0;
    return { customerTotal, vendorTotal, margin, marginPct };
  }, [preview, freight, additionalCharges, financeCostPct]);

  const chargesLocked = Boolean(preview?.purchase_order_id);

  return (
    <div className="space-y-4">
      <PageHeader
        title={preview ? preview.ovf_no : "View OVF"}
        backHref="/procurement/scm"
        backLabel="SCM Queue"
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
            {preview?.can_create_po ? (
              <Link
                href={`/procurement/scm/ovf/${ovfId}/po`}
                className={cn(
                  buttonVariants({ size: "sm" }),
                  "cursor-pointer transition-colors duration-200",
                )}
              >
                <ShoppingCart className="mr-1.5 size-3.5" />
                Create PO
              </Link>
            ) : preview?.purchase_order_id ? (
              <Link
                href={`/procurement/orders/${preview.purchase_order_id}`}
                className={cn(
                  buttonVariants({ size: "sm", variant: "outline" }),
                  "cursor-pointer transition-colors duration-200",
                )}
              >
                Open purchase order
              </Link>
            ) : null}
          </div>
        }
      />

      {error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {loading && !preview ? (
        <div className="rounded-lg border border-border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
          Loading OVF from CRM…
        </div>
      ) : null}

      {preview ? (
        <>
          <SectionCard title="OVF overview" icon={ClipboardList}>
            <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <DetailItem label="Customer">
                {textOrDash(preview.customer_name || preview.account_name)}
              </DetailItem>
              <DetailItem label="Customer pay terms">
                {preview.customer_payment_days
                  ? `Net ${preview.customer_payment_days} days`
                  : "—"}
              </DetailItem>
              <DetailItem label="Vendor">{vendorLabel}</DetailItem>
              <DetailItem label="Vendor pay terms">
                {preview.vendor_payment_days
                  ? `Net ${preview.vendor_payment_days} days`
                  : "—"}
              </DetailItem>
              <DetailItem label="Approved by / owner">{textOrDash(preview.ovf_approver)}</DetailItem>
              <DetailItem label="Approval status">
                <FinanceStatusBadge status={preview.approval_status || "pending"} />
              </DetailItem>
              <DetailItem label="Margin (total)">{moneyPrecise(preview.total_margin_amount)}</DetailItem>
              <DetailItem label="Margin %">{pct(preview.total_margin_pct)}</DetailItem>
            </dl>
          </SectionCard>

          <SectionCard title="Customer details" icon={Building2}>
            <div className="space-y-4">
              <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
                <DetailItem label="Customer (company name)">
                  {textOrDash(preview.customer_name || preview.account_name)}
                </DetailItem>
                <DetailItem label="Recipient / contact">
                  {textOrDash(preview.billing_contact_person || preview.shipping_contact_person)}
                </DetailItem>
                <DetailItem label="Customer PO number">{textOrDash(preview.po_number)}</DetailItem>
                <DetailItem label="Customer PO date">{formatPoDate(preview.po_date)}</DetailItem>
              </dl>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-md border border-border/70 bg-muted/20 p-3 space-y-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground">
                    Billing
                  </p>
                  <dl className="space-y-3">
                    <DetailItem label="Address">
                      <span className="whitespace-pre-wrap font-medium leading-relaxed text-foreground">
                        {textOrDash(preview.billing_address)}
                      </span>
                    </DetailItem>
                    <DetailItem label="State">{textOrDash(preview.billing_state)}</DetailItem>
                  </dl>
                </div>
                <div className="rounded-md border border-border/70 bg-muted/20 p-3 space-y-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground">
                    Shipping
                  </p>
                  <dl className="space-y-3">
                    <DetailItem label="Address">
                      <span className="whitespace-pre-wrap font-medium leading-relaxed text-foreground">
                        {textOrDash(preview.shipping_address)}
                      </span>
                    </DetailItem>
                    <DetailItem label="State">{textOrDash(preview.shipping_state)}</DetailItem>
                  </dl>
                </div>
              </div>
              <ChargeTable
                rows={preview.customer_lines || []}
                emptyLabel="No customer charge lines on this OVF."
              />
            </div>
          </SectionCard>

          <SectionCard title="Vendor purchase" icon={Package}>
            <ChargeTable
              rows={preview.vendor_lines || []}
              emptyLabel="No vendor purchase lines on this OVF."
            />
          </SectionCard>

          <SectionCard title="Margin" icon={Percent}>
            <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
              <DetailItem label="Customer total">
                {moneyPrecise(marginSummary.customerTotal)}
              </DetailItem>
              <DetailItem label="Vendor total">
                {moneyPrecise(marginSummary.vendorTotal)}
              </DetailItem>
              <DetailItem label="Margin">{moneyPrecise(marginSummary.margin)}</DetailItem>
              <DetailItem label="Margin %">{pct(marginSummary.marginPct)}</DetailItem>
            </dl>
          </SectionCard>

          <SectionCard title="Freight & finance" icon={Wallet}>
            <div className="rounded-md border border-sky-200 bg-sky-50/60 p-3">
              <div className="grid gap-3 sm:grid-cols-3">
                <FinanceField label="Freight charges (₹)">
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={freight}
                    onFocus={(e) => e.currentTarget.select()}
                    onChange={(e) => {
                      const next = parseChargeInput(e.target.value);
                      if (next === null) return;
                      setFreight(next);
                    }}
                    onBlur={() => setFreight((v) => normalizeChargeOnBlur(v))}
                    disabled={chargesBusy || chargesLocked}
                    readOnly={chargesLocked}
                    className={cn("h-8 tabular-nums", CHARGE_NO_SPINNER)}
                  />
                </FinanceField>
                <FinanceField label="Additional charges (₹)">
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={additionalCharges}
                    onFocus={(e) => e.currentTarget.select()}
                    onChange={(e) => {
                      const next = parseChargeInput(e.target.value);
                      if (next === null) return;
                      setAdditionalCharges(next);
                    }}
                    onBlur={() => setAdditionalCharges((v) => normalizeChargeOnBlur(v))}
                    disabled={chargesBusy || chargesLocked}
                    readOnly={chargesLocked}
                    className={cn("h-8 tabular-nums", CHARGE_NO_SPINNER)}
                  />
                </FinanceField>
                <FinanceField label="Finance cost (%)">
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={financeCostPct}
                    onFocus={(e) => e.currentTarget.select()}
                    onChange={(e) => {
                      const next = parseChargeInput(e.target.value);
                      if (next === null) return;
                      setFinanceCostPct(next);
                    }}
                    onBlur={() => setFinanceCostPct((v) => normalizeChargeOnBlur(v))}
                    disabled={chargesBusy || chargesLocked}
                    readOnly={chargesLocked}
                    className={cn("h-8 tabular-nums", CHARGE_NO_SPINNER)}
                  />
                </FinanceField>
              </div>
              {!chargesLocked ? (
                <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
                  <Button
                    type="button"
                    size="sm"
                    className="cursor-pointer transition-colors duration-200"
                    disabled={chargesBusy}
                    onClick={() => void saveCharges()}
                  >
                    {chargesBusy ? "Saving…" : "Save charges"}
                  </Button>
                </div>
              ) : null}
              {chargesBanner ? (
                <p className="mt-2 text-xs font-medium text-sky-900">{chargesBanner}</p>
              ) : null}
            </div>
          </SectionCard>
        </>
      ) : null}
    </div>
  );
}
