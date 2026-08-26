"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Building2,
  ClipboardList,
  FileDown,
  Package,
  PauseCircle,
  Percent,
  RefreshCw,
  ShoppingCart,
  Truck,
  Wallet,
  type LucideIcon,
} from "lucide-react";

import { ScmCreatePoEntry } from "@/components/procurement/scm-create-po-entry";
import { ScmCommercialDocumentsPanel } from "@/components/procurement/scm-commercial-documents-panel";
import { ConfirmDialog } from "@/components/finance/journals/confirm-dialog";
import { FinanceStatusBadge } from "@/components/finance/finance-status-badge";
import { FinanceField } from "@/components/finance/journals/finance-form-field";
import { PageHeader } from "@/components/layout/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  scmHoldDayCountBetweenDisplay,
  scmHoldDayCountDisplay,
  scmHoldSinceDisplay,
} from "@/utils/scm-ovf-hold";
import { formatOvfDeliveryPeriodDisplay } from "@/utils/ovf-delivery-period";
import { downloadScmOvfPdf } from "@/utils/scm-ovf-pdf";
import {
  buildOvfFulfillmentRows,
  ovfChallanHref,
  ovfCreatePoRemainderHref,
  ovfFromStockHref,
  ovfHasInventoryShortfall,
  ovfRequiresInStockCreatePoApproval,
  type OvfChallanShipSource,
} from "@/utils/ovf-stock";
import { useProcurementApprovals } from "@/hooks/use-procurement-approvals";
import { useProcurementRole } from "@/hooks/use-procurement-role";
import {
  findLatestCreatePoInStockApprovalForOvf,
  PROCUREMENT_APPROVALS_EVENT,
} from "@/lib/procurement-approvals";
import { ApiClientError } from "@/services/api-client";
import {
  getScmOvfPreview,
  holdScmOvf,
  releaseScmOvfHold,
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

type ScmOvfQueueStatus = "open" | "close" | "hold" | "draft";

function deriveScmOvfQueueStatus(preview: ScmOvfPreview): ScmOvfQueueStatus {
  const poStatus = (preview.purchase_order_status || "").toLowerCase();
  if (poStatus === "draft" && preview.purchase_order_id && !preview.can_create_po) {
    return "draft";
  }
  if (preview.scm_on_hold || poStatus === "hold" || poStatus === "cancelled") return "hold";
  if (preview.stock_fulfillment_status === "complete" && !preview.can_create_po) return "close";
  if (!preview.purchase_order_id || preview.can_create_po) return "open";
  if (poStatus === "submitted" || poStatus === "") return "open";
  return "close";
}

function ScmOvfStatusBadge({ status }: { status: ScmOvfQueueStatus }) {
  const label =
    status === "open"
      ? "Open"
      : status === "close"
        ? "Close"
        : status === "draft"
          ? "Draft"
          : "Hold";
  return (
    <span
      className={cn(
        "inline-flex rounded-md border px-2 py-0.5 text-xs font-medium",
        status === "open" && "border-amber-300 bg-amber-50 text-amber-900",
        status === "close" && "border-emerald-300 bg-emerald-50 text-emerald-900",
        status === "draft" && "border-sky-300 bg-sky-50 text-sky-900",
        status === "hold" && "border-red-300 bg-red-50 text-red-800",
      )}
    >
      {label}
    </span>
  );
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
      <dt className="text-xs font-bold uppercase tracking-wide text-foreground">
        {label}
      </dt>
      <dd className="text-sm font-normal text-slate-600 break-words">{children}</dd>
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

  return (
    <div className="overflow-hidden rounded-md border border-border">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] table-fixed text-sm">
          <colgroup>
            <col className="w-12" />
            <col className="min-w-[120px]" />
            <col className="min-w-[140px]" />
            <col className="w-16" />
            <col className="w-[7.25rem]" />
            <col className="w-[7.25rem]" />
            <col className="w-[7.25rem]" />
            <col className="w-[8.5rem]" />
          </colgroup>
          <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left font-medium">S No.</th>
              <th className="px-3 py-2 text-left font-medium">Product name</th>
              <th className="px-3 py-2 text-left font-medium">Item description</th>
              <th className="px-3 py-2 text-right font-medium tabular-nums">Qty</th>
              <th className="px-3 py-2 text-right font-medium tabular-nums whitespace-nowrap">
                Unit (INR)
              </th>
              <th className="px-3 py-2 text-right font-medium tabular-nums whitespace-nowrap">
                Total (INR)
              </th>
              <th className="px-3 py-2 text-right font-medium tabular-nums whitespace-nowrap">
                Tax amount
              </th>
              <th className="px-3 py-2 text-right font-medium tabular-nums whitespace-nowrap">
                With GST (INR)
              </th>
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
                    {textOrDash(row.description)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{row.qty}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {moneyPrecise(row.unit_price)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {moneyPrecise(row.line_total)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">
                    {moneyPrecise(row.gst_amount)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap font-medium">
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
                <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">
                  {moneyPrecise(totals.total)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">
                  {moneyPrecise(totals.gst)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">
                  {moneyPrecise(totals.withGst)}
                </td>
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>
    </div>
  );
}

function VendorSourceBadge({
  source,
  distributorName,
}: {
  source?: string | null;
  distributorName?: string | null;
}) {
  const fromInventory =
    source === "inventory" ||
    ["in stock", "instock", "inventory"].includes(
      (distributorName || "").trim().toLowerCase().replace(/\s+/g, " "),
    );
  if (fromInventory) {
    return (
      <span className="inline-flex rounded-md border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-900">
        From inventory
      </span>
    );
  }
  return (
    <span className="inline-flex rounded-md border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-900">
      Create PO
    </span>
  );
}

function VendorPurchaseTable({
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

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Distributor comes from CRM Vendor Charges. <span className="font-medium text-foreground">IN STOCK</span>{" "}
        → fulfill from inventory. To create a PO for IN STOCK lines instead (stock short or by choice),
        request admin approval first. Any other distributor → create a purchase order.
      </p>
      <div className="overflow-hidden rounded-md border border-border">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] table-fixed text-sm">
            <colgroup>
              <col className="w-12" />
              <col className="min-w-[120px]" />
              <col className="min-w-[120px]" />
              <col className="w-16" />
              <col className="min-w-[120px]" />
              <col className="w-[7.5rem]" />
              <col className="w-[7.25rem]" />
              <col className="w-[7.25rem]" />
              <col className="w-[7.25rem]" />
              <col className="w-[8.5rem]" />
            </colgroup>
            <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">S No.</th>
                <th className="px-3 py-2 text-left font-medium">Product name</th>
                <th className="px-3 py-2 text-left font-medium">Item description</th>
                <th className="px-3 py-2 text-right font-medium tabular-nums">Qty</th>
                <th className="px-3 py-2 text-left font-medium">Distributor</th>
                <th className="px-3 py-2 text-left font-medium">Source</th>
                <th className="px-3 py-2 text-right font-medium tabular-nums whitespace-nowrap">
                  Unit (INR)
                </th>
                <th className="px-3 py-2 text-right font-medium tabular-nums whitespace-nowrap">
                  Total (INR)
                </th>
                <th className="px-3 py-2 text-right font-medium tabular-nums whitespace-nowrap">
                  Tax amount
                </th>
                <th className="px-3 py-2 text-right font-medium tabular-nums whitespace-nowrap">
                  With GST (INR)
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-3 py-6 text-center text-muted-foreground">
                    {emptyLabel}
                  </td>
                </tr>
              ) : (
                rows.map((row, index) => (
                  <tr key={row.line_id} className="border-b border-border/70">
                    <td className="px-3 py-2 tabular-nums text-muted-foreground">{index + 1}</td>
                    <td className="px-3 py-2 font-medium">{textOrDash(row.product_name)}</td>
                    <td className="max-w-[220px] px-3 py-2 text-muted-foreground">
                      {textOrDash(row.description)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{row.qty}</td>
                    <td className="px-3 py-2 font-medium text-slate-700">
                      {textOrDash(row.distributor_name)}
                    </td>
                    <td className="px-3 py-2">
                      <VendorSourceBadge
                        source={row.fulfillment_source}
                        distributorName={row.distributor_name}
                      />
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {moneyPrecise(row.unit_price)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {moneyPrecise(row.line_total)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">
                      {moneyPrecise(row.gst_amount)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap font-medium">
                      {moneyPrecise(row.total_with_gst)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {rows.length > 0 ? (
              <tfoot className="border-t border-border bg-muted/30 text-sm font-semibold">
                <tr>
                  <td colSpan={7} className="px-3 py-2 text-right">
                    Totals
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">
                    {moneyPrecise(totals.total)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">
                    {moneyPrecise(totals.gst)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">
                    {moneyPrecise(totals.withGst)}
                  </td>
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
      </div>
    </div>
  );
}

export function ScmOvfViewPage({ ovfId }: { ovfId: string }) {
  const router = useRouter();
  const { role } = useProcurementRole();
  const { submitCreatePoInStockRequest, refresh: refreshApprovals } = useProcurementApprovals();
  const [preview, setPreview] = useState<ScmOvfPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requestPoBusy, setRequestPoBusy] = useState(false);
  const [createPoApprovalStatus, setCreatePoApprovalStatus] = useState<
    "pending" | "accepted" | "rejected" | null
  >(null);
  const [chargesBusy, setChargesBusy] = useState(false);
  const [chargesBanner, setChargesBanner] = useState<string | null>(null);
  const [stockAllocatedBanner, setStockAllocatedBanner] = useState(false);
  const [shipDialogOpen, setShipDialogOpen] = useState(false);
  const [shipSource, setShipSource] = useState<OvfChallanShipSource>("inventory");
  const [holdDialogOpen, setHoldDialogOpen] = useState(false);
  const [unholdDialogOpen, setUnholdDialogOpen] = useState(false);
  const [unholdBusy, setUnholdBusy] = useState(false);
  const [holdBusy, setHoldBusy] = useState(false);
  const [holdRemark, setHoldRemark] = useState("");
  const [pdfBusy, setPdfBusy] = useState(false);
  const [freight, setFreight] = useState("0");
  const [financeCostPct, setFinanceCostPct] = useState("0");

  const syncChargesFromPreview = useCallback((row: ScmOvfPreview) => {
    setFreight(String(Number(row.freight) || 0));
    setFinanceCostPct(String(Number(row.finance_cost_pct) || 0));
  }, []);

  const load = useCallback(async (options?: { soft?: boolean }) => {
    const soft = Boolean(options?.soft);
    if (soft) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);
    if (!soft) {
      setChargesBanner(null);
    }
    try {
      const row = await getScmOvfPreview(ovfId);
      setPreview(row);
      syncChargesFromPreview(row);
    } catch (err) {
      if (!soft) {
        setPreview(null);
      }
      setError(err instanceof ApiClientError ? err.message : "Failed to load OVF from CRM");
    } finally {
      if (soft) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  }, [ovfId, syncChargesFromPreview]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const sync = () => {
      setCreatePoApprovalStatus(findLatestCreatePoInStockApprovalForOvf(ovfId)?.status ?? null);
    };
    sync();
    refreshApprovals();
    window.addEventListener(PROCUREMENT_APPROVALS_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(PROCUREMENT_APPROVALS_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, [ovfId, refreshApprovals]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("stockAllocated") !== "1") return;
    setStockAllocatedBanner(true);
    router.replace(`/procurement/scm/ovf/${ovfId}`, { scroll: false });
  }, [ovfId, router]);

  const requiresInStockCreatePoApproval = useMemo(
    () => (preview ? ovfRequiresInStockCreatePoApproval(preview) : false),
    [preview],
  );
  const stockShortForCreatePo = useMemo(
    () => (preview ? ovfHasInventoryShortfall(preview) : false),
    [preview],
  );

  function requestCreatePoApproval() {
    if (!preview) return;
    setRequestPoBusy(true);
    setError(null);
    try {
      submitCreatePoInStockRequest({
        ovfId,
        ovfNo: preview.ovf_no,
        customerName: preview.customer_name || preview.account_name,
        vendorName: preview.distributor_name || "IN STOCK",
        reason: stockShortForCreatePo ? "stock_short" : "user_choice",
      });
      setCreatePoApprovalStatus("pending");
      setChargesBanner(
        stockShortForCreatePo
          ? "Create PO request sent to admin — inventory is short or already used. You can create the PO after approval."
          : "Create PO request sent to admin. IN STOCK lines normally use inventory; you can create the PO after approval.",
      );
    } finally {
      setRequestPoBusy(false);
    }
  }

  async function saveCharges() {
    if (!preview || preview.purchase_order_id) return;
    if (preview.scm_on_hold) {
      setError("Unhold this OVF before changing freight and finance.");
      return;
    }
    setChargesBusy(true);
    setError(null);
    setChargesBanner(null);
    try {
      const row = await updateScmOvfCharges(ovfId, {
        freight: Number(freight) || 0,
        additional_charges: Number(preview.additional_charges) || 0,
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

  async function confirmHold() {
    const remark = holdRemark.trim();
    if (!remark) {
      setError("Please enter a hold remark.");
      return;
    }
    setHoldBusy(true);
    setError(null);
    try {
      const row = await holdScmOvf(ovfId, remark);
      setPreview(row);
      syncChargesFromPreview(row);
      setHoldDialogOpen(false);
      setHoldRemark("");
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to put OVF on hold");
      setHoldDialogOpen(false);
    } finally {
      setHoldBusy(false);
    }
  }

  async function confirmUnhold() {
    setUnholdBusy(true);
    setError(null);
    try {
      const row = await releaseScmOvfHold(ovfId);
      setPreview(row);
      syncChargesFromPreview(row);
      setUnholdDialogOpen(false);
      setChargesBanner("OVF unheld. You can edit freight and finance or put on hold again if needed.");
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to unhold OVF");
      setUnholdDialogOpen(false);
    } finally {
      setUnholdBusy(false);
    }
  }

  const vendorLabel = useMemo(() => {
    if (!preview) return "—";
    // Only CRM lead distributor / vendor field — never matched master vendor or PO vendor.
    return preview.distributor_name?.trim() || "—";
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
    const additionalAmount = Number(preview.additional_charges) || 0;
    const financePct = Number(financeCostPct) || 0;
    const financeAmount = (vendorTotal * financePct) / 100;
    const margin =
      customerTotal - vendorTotal - freightAmount - additionalAmount - financeAmount;
    const marginPct = customerTotal ? (margin / customerTotal) * 100 : 0;
    return { customerTotal, vendorTotal, margin, marginPct };
  }, [preview, freight, financeCostPct]);

  const queueStatus = preview ? deriveScmOvfQueueStatus(preview) : null;
  const chargesLockedByPo = Boolean(preview?.purchase_order_id);
  const chargesLockedByHold = Boolean(preview?.scm_on_hold || queueStatus === "hold");
  const chargesLocked = chargesLockedByPo || chargesLockedByHold;
  const canHoldOvf = Boolean(preview?.can_create_po && !preview?.scm_on_hold);
  const canUnholdOvf = Boolean(
    preview?.can_create_po && preview?.scm_on_hold && !chargesLockedByPo,
  );
  const canFulfillFromStock = Boolean(
    preview?.stock_availability?.some(
      (row) => Number(row.remaining_qty) > 0 && Number(row.on_hand_qty) > 0,
    ),
  );
  const fulfillmentRows = useMemo(
    () => (preview ? buildOvfFulfillmentRows(preview) : []),
    [preview],
  );
  const hasInventoryTaken = fulfillmentRows.some((row) => row.allocated_qty > 0);
  const canShipInventory = hasInventoryTaken;
  const canShipPo = Boolean(preview?.purchase_order_id);
  const canShipCombined = canShipInventory && canShipPo;
  const canCreateDeliveryChallan = canShipInventory || canShipPo;
  const showActiveHold = Boolean(preview?.scm_on_hold || queueStatus === "hold");
  const holdHistory = useMemo(() => {
    if (!preview?.scm_hold_history?.length) return [];
    return [...preview.scm_hold_history].sort(
      (a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime(),
    );
  }, [preview]);

  function openShipDialog() {
    const initial: OvfChallanShipSource = canShipInventory
      ? "inventory"
      : canShipPo
        ? "po"
        : "inventory";
    setShipSource(initial);
    setShipDialogOpen(true);
  }

  function confirmShipChallan() {
    if (!preview) return;
    const available =
      (shipSource === "inventory" && canShipInventory) ||
      (shipSource === "po" && canShipPo) ||
      (shipSource === "combined" && canShipCombined);
    if (!available) return;
    setShipDialogOpen(false);
    router.push(ovfChallanHref(ovfId, shipSource, preview.purchase_order_id));
  }

  async function downloadPdf() {
    if (!preview) return;
    setPdfBusy(true);
    setError(null);
    try {
      await downloadScmOvfPdf(preview);
    } catch {
      setError("Could not generate OVF PDF. Try again.");
    } finally {
      setPdfBusy(false);
    }
  }

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
              onClick={() => void load({ soft: Boolean(preview) })}
              disabled={loading || holdBusy || unholdBusy || refreshing || pdfBusy}
            >
              <RefreshCw
                className={`mr-1.5 size-3.5 ${loading || refreshing ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
            {preview ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="cursor-pointer transition-colors duration-200"
                disabled={loading || pdfBusy}
                onClick={() => void downloadPdf()}
              >
                <FileDown className={`mr-1.5 size-3.5 ${pdfBusy ? "opacity-50" : ""}`} />
                {pdfBusy ? "Preparing…" : "Download PDF"}
              </Button>
            ) : null}
            {canUnholdOvf ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="cursor-pointer border-amber-300 bg-amber-50 text-amber-900 transition-colors duration-200 hover:bg-amber-100"
                disabled={loading || unholdBusy}
                onClick={() => {
                  setError(null);
                  setUnholdDialogOpen(true);
                }}
              >
                Unhold
              </Button>
            ) : null}
            {canHoldOvf ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="cursor-pointer border-slate-300 bg-slate-50 text-slate-800 transition-colors duration-200 hover:bg-slate-100 hover:text-slate-900"
                disabled={loading || holdBusy}
                onClick={() => {
                  setError(null);
                  setHoldDialogOpen(true);
                }}
              >
                <PauseCircle className="mr-1.5 size-3.5" />
                Hold
              </Button>
            ) : null}
            {preview?.can_create_po ? (
              <ScmCreatePoEntry
                ovfId={ovfId}
                href={
                  preview.stock_fulfillment_status === "partial"
                    ? ovfCreatePoRemainderHref(ovfId)
                    : undefined
                }
                scmOnHold={Boolean(preview.scm_on_hold) || queueStatus === "hold"}
                scmOnHoldAt={preview.scm_on_hold_at}
                className="cursor-pointer transition-colors duration-200"
                icon={<ShoppingCart className="mr-1.5 size-3.5" />}
                requiresInStockApproval={requiresInStockCreatePoApproval}
                createPoApprovalStatus={createPoApprovalStatus}
                canCreateWithoutApproval={role === "admin"}
                onRequestCreatePoApproval={requestCreatePoApproval}
                requestBusy={requestPoBusy}
              />
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
            {canFulfillFromStock ? (
              <Link
                href={ovfFromStockHref(ovfId)}
                className={cn(
                  buttonVariants({ size: "sm", variant: "outline" }),
                  "cursor-pointer transition-colors duration-200",
                )}
              >
                <Package className="mr-1.5 size-3.5" />
                Fulfill from inventory
              </Link>
            ) : null}
            {canCreateDeliveryChallan ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="cursor-pointer transition-colors duration-200"
                disabled={loading}
                onClick={openShipDialog}
              >
                <Truck className="mr-1.5 size-3.5" />
                Create delivery challan
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

      {stockAllocatedBanner ? (
        <div className="rounded-md border border-emerald-300/60 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          Stock allocated only — no delivery challan was created. Use Create delivery challan when
          you are ready to ship.
          <button
            type="button"
            className="ml-2 cursor-pointer underline transition-colors duration-200"
            onClick={() => setStockAllocatedBanner(false)}
          >
            Dismiss
          </button>
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
              <DetailItem label="Project title">
                {textOrDash(preview.project_title)}
              </DetailItem>
              <DetailItem label="OEM / Brand name">
                {textOrDash(preview.oem_name)}
              </DetailItem>
              <DetailItem label="Customer pay terms">
                {preview.customer_payment_days
                  ? `Net ${preview.customer_payment_days} days`
                  : "—"}
              </DetailItem>
              <DetailItem label="Vendor name">{vendorLabel}</DetailItem>
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
            <dl
              className={cn(
                "mt-3 grid gap-3 border-t border-border/60 pt-3 sm:grid-cols-2",
                showActiveHold ? "lg:grid-cols-3" : "lg:grid-cols-4",
              )}
            >
              <DetailItem label="OVF status">
                {queueStatus ? <ScmOvfStatusBadge status={queueStatus} /> : "—"}
              </DetailItem>
              {showActiveHold ? (
                <>
                  <DetailItem label="Hold duration">
                    {scmHoldDayCountDisplay(preview.scm_on_hold_at)}
                  </DetailItem>
                  <DetailItem label="Hold since">
                    <span className="tabular-nums">
                      {scmHoldSinceDisplay(preview.scm_on_hold_at)}
                    </span>
                  </DetailItem>
                  {preview.scm_on_hold_remark?.trim() ? (
                    <DetailItem label="Hold remark" className="sm:col-span-2 lg:col-span-3">
                      <span className="whitespace-pre-wrap text-slate-600">
                        {preview.scm_on_hold_remark.trim()}
                      </span>
                    </DetailItem>
                  ) : null}
                </>
              ) : null}
            </dl>
            {holdHistory.length > 0 ? (
              <div className="mt-3 border-t border-border/60 pt-3">
                <p className="text-xs font-bold uppercase tracking-wide text-foreground">
                  Hold history
                </p>
                <div className="mt-2 overflow-hidden rounded-md border border-border">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 font-medium">#</th>
                        <th className="px-3 py-2 font-medium">Held since</th>
                        <th className="px-3 py-2 font-medium">Released on</th>
                        <th className="px-3 py-2 font-medium">Remark</th>
                        <th className="px-3 py-2 font-medium text-right">Days on hold</th>
                      </tr>
                    </thead>
                    <tbody>
                      {holdHistory.map((entry, index) => (
                        <tr key={`${entry.started_at}-${index}`} className="border-b border-border/70">
                          <td className="px-3 py-2 tabular-nums text-muted-foreground">
                            {index + 1}
                          </td>
                          <td className="px-3 py-2 tabular-nums">
                            {scmHoldSinceDisplay(entry.started_at)}
                          </td>
                          <td className="px-3 py-2 tabular-nums">
                            {scmHoldSinceDisplay(entry.released_at)}
                          </td>
                          <td className="px-3 py-2 max-w-[220px] text-muted-foreground">
                            <span className="line-clamp-2" title={entry.remark ?? ""}>
                              {entry.remark?.trim() || "—"}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {scmHoldDayCountBetweenDisplay(entry.started_at, entry.released_at)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
          </SectionCard>

          <SectionCard title="Customer details" icon={Building2}>
            <div className="space-y-4">
              <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
                <DetailItem label="Customer name">
                  {textOrDash(preview.customer_name || preview.account_name)}
                </DetailItem>
                <DetailItem label="Recipient / contact">
                  {textOrDash(preview.billing_contact_person || preview.shipping_contact_person)}
                </DetailItem>
                <DetailItem label="Customer PO number">{textOrDash(preview.po_number)}</DetailItem>
                <DetailItem label="Customer PO date">
                  {formatPoDate(preview.po_date)}
                </DetailItem>
                <DetailItem label="Delivery period">
                  {formatOvfDeliveryPeriodDisplay(preview.delivery_period)}
                </DetailItem>
              </dl>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-md border border-border/70 bg-muted/20 p-3 space-y-3">
                  <p className="text-xs font-bold uppercase tracking-wide text-foreground">
                    Bill to
                  </p>
                  <dl className="space-y-3">
                    <dd className="text-sm font-normal leading-relaxed text-slate-600 break-words whitespace-pre-wrap">
                      {textOrDash(preview.billing_address)}
                    </dd>
                    <DetailItem label="State">{textOrDash(preview.billing_state)}</DetailItem>
                  </dl>
                </div>
                <div className="rounded-md border border-border/70 bg-muted/20 p-3 space-y-3">
                  <p className="text-xs font-bold uppercase tracking-wide text-foreground">
                    Ship to
                  </p>
                  <dl className="space-y-3">
                    <dd className="text-sm font-normal leading-relaxed text-slate-600 break-words whitespace-pre-wrap">
                      {textOrDash(preview.shipping_address)}
                    </dd>
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
            <VendorPurchaseTable
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
              {chargesLockedByHold ? (
                <p className="mb-3 text-xs font-medium text-amber-900">
                  This OVF is on hold. Use <span className="font-semibold">Unhold</span> above
                  before editing freight and finance.
                </p>
              ) : null}
              <div className="grid gap-3 sm:grid-cols-2">
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

          <ScmCommercialDocumentsPanel
            ovfId={ovfId}
            branchId={preview.branch_id}
            companyId={preview.company_id}
            title="OVF documents"
            description="Files attached by sales on this OVF. They are included automatically when the PO is sent for admin approval."
            allowUpload={false}
          />
        </>
      ) : null}

      <ConfirmDialog
        open={shipDialogOpen}
        title="Create delivery challan"
        description="Choose which items to include. You can ship inventory and PO lines separately or together."
        confirmLabel="Continue"
        cancelLabel="Not now"
        contentClassName="max-w-lg"
        confirmDisabled={
          (shipSource === "inventory" && !canShipInventory) ||
          (shipSource === "po" && !canShipPo) ||
          (shipSource === "combined" && !canShipCombined)
        }
        onConfirm={confirmShipChallan}
        onCancel={() => setShipDialogOpen(false)}
      >
        <div className="mt-3 space-y-2">
          {(
            [
              {
                value: "inventory" as const,
                title: "Inventory items only",
                detail: "Ship quantities already taken from stock.",
                enabled: canShipInventory,
              },
              {
                value: "po" as const,
                title: "PO items only",
                detail: "Ship purchase-order lines (after vendor PO is created).",
                enabled: canShipPo,
              },
              {
                value: "combined" as const,
                title: "Combined",
                detail: "Include inventory allocations and PO lines on one challan.",
                enabled: canShipCombined,
              },
            ] as const
          ).map((option) => (
            <label
              key={option.value}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-md border px-3 py-2.5 transition-colors duration-200",
                option.enabled
                  ? "border-border hover:bg-muted/40 has-[:checked]:border-sky-400 has-[:checked]:bg-sky-50/70"
                  : "cursor-not-allowed border-border/60 bg-muted/20 opacity-60",
              )}
            >
              <input
                type="radio"
                name="ovf-ship-source"
                className="mt-0.5 cursor-pointer accent-sky-700 disabled:cursor-not-allowed"
                value={option.value}
                checked={shipSource === option.value}
                disabled={!option.enabled}
                onChange={() => setShipSource(option.value)}
              />
              <span className="min-w-0 space-y-0.5">
                <span className="block text-sm font-medium text-foreground">{option.title}</span>
                <span className="block text-xs text-muted-foreground">{option.detail}</span>
                {!option.enabled ? (
                  <span className="block text-xs text-amber-800">
                    {option.value === "inventory"
                      ? "Allocate stock first."
                      : option.value === "po"
                        ? "Create a purchase order first."
                        : "Need both stock allocation and a purchase order."}
                  </span>
                ) : null}
              </span>
            </label>
          ))}
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        open={holdDialogOpen}
        title="Put this OVF on hold?"
        description="Add a short remark so others know why this OVF is on hold."
        confirmLabel="Yes, put on hold"
        busy={holdBusy}
        contentClassName="max-w-lg"
        onConfirm={() => void confirmHold()}
        onCancel={() => {
          if (!holdBusy) {
            setHoldDialogOpen(false);
            setHoldRemark("");
          }
        }}
      >
        <div className="mt-3 space-y-1.5">
          <label htmlFor="scm-hold-remark" className="text-xs font-medium text-foreground">
            Hold remark <span className="text-destructive">*</span>
          </label>
          <Textarea
            id="scm-hold-remark"
            value={holdRemark}
            onChange={(e) => setHoldRemark(e.target.value)}
            placeholder="e.g. Waiting for customer confirmation on delivery date"
            rows={3}
            className="resize-y text-sm"
            disabled={holdBusy}
          />
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        open={unholdDialogOpen}
        title="Unhold this OVF?"
        confirmLabel="Unhold"
        busy={unholdBusy}
        onConfirm={() => void confirmUnhold()}
        onCancel={() => {
          if (!unholdBusy) setUnholdDialogOpen(false);
        }}
      >
        <div className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
          <p>After this, you can create the purchase order.</p>
        </div>
      </ConfirmDialog>
    </div>
  );
}
