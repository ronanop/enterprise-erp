"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Building2,
  ClipboardList,
  FileDown,
  Package,
  PackageCheck,
  PauseCircle,
  Percent,
  RefreshCw,
  ShoppingCart,
  Truck,
  Wallet,
  type LucideIcon,
} from "lucide-react";

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
import { downloadScmOvfPdf } from "@/utils/scm-ovf-pdf";
import { ApiClientError } from "@/services/api-client";
import {
  getScmOvfPreview,
  holdScmOvf,
  listProcurementInventory,
  releaseScmOvfHold,
  updateScmOvfCharges,
  type ProcurementInventoryRow,
  type ScmOvfPreview,
  type ScmVendorLine,
} from "@/services/procurement-service";
import {
  buildGrnPoInventoryShipLines,
  buildOvfBookedInventoryShipLines,
  buildOvfFulfillmentRows,
  ovfChallanHref,
  ovfCreatePoHref,
  ovfDistributorKey,
  ovfGrnStockChallanHref,
  ovfItemPlanHref,
  poAllowsGrnRecording,
  resolvePoForDistributor,
  setOvfInventoryShipSelection,
  type OvfInventoryShipLine,
  type OvfShipDocumentKind,
} from "@/utils/ovf-stock";
import {
  deriveScmOvfQueueStatus,
  type ScmOvfQueueStatus,
} from "@/utils/scm-queue-ovf-status";

function ovfLineNameKey(name: string | null | undefined): string {
  return (name || "").trim().toLowerCase();
}

function customerLinesInCrmOrder(rows: ScmVendorLine[]): ScmVendorLine[] {
  return [...rows].sort((a, b) => {
    const an = Number(a.line_no) || 0;
    const bn = Number(b.line_no) || 0;
    if (an !== bn) return an - bn;
    return String(a.line_id).localeCompare(String(b.line_id));
  });
}

function vendorLinesInCrmOrder(
  vendorRows: ScmVendorLine[],
  customerRows: ScmVendorLine[],
): ScmVendorLine[] {
  const buckets = new Map<string, ScmVendorLine[]>();
  for (const row of vendorRows) {
    const key = ovfLineNameKey(row.product_name);
    const list = buckets.get(key) ?? [];
    list.push(row);
    buckets.set(key, list);
  }
  const used = new Set<string>();
  const ordered: ScmVendorLine[] = [];
  for (const customer of customerLinesInCrmOrder(customerRows)) {
    const key = ovfLineNameKey(customer.product_name);
    const bucket = buckets.get(key);
    const next = bucket?.shift();
    if (next) {
      used.add(next.line_id);
      ordered.push(next);
    }
  }
  for (const row of vendorRows) {
    if (!used.has(row.line_id)) ordered.push(row);
  }
  return ordered;
}

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

function formatItemPlanQty(value: number | null | undefined): string {
  const n = Number(value) || 0;
  if (Number.isInteger(n)) return String(n);
  return n.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

type InventoryLineSelection = Record<string, { selected: boolean; qty: number }>;

function ShipInventoryLinePicker({
  lines,
  selection,
  onSelectionChange,
  loading,
  emptyLabel,
}: {
  lines: OvfInventoryShipLine[];
  selection: InventoryLineSelection;
  onSelectionChange: (next: InventoryLineSelection) => void;
  loading?: boolean;
  emptyLabel: string;
}) {
  const selectedCount = lines.filter(
    (line) => selection[line.id]?.selected && (selection[line.id]?.qty ?? 0) > 0,
  ).length;
  const allSelected = lines.length > 0 && selectedCount === lines.length;

  function setLineSelected(id: string, selected: boolean) {
    const line = lines.find((row) => row.id === id);
    if (!line) return;
    onSelectionChange({
      ...selection,
      [id]: {
        selected,
        qty: selection[id]?.qty ?? line.max_qty,
      },
    });
  }

  function setLineQty(id: string, raw: string) {
    const line = lines.find((row) => row.id === id);
    if (!line) return;
    const parsed = Number(raw);
    const qty = Number.isFinite(parsed)
      ? Math.max(0, Math.min(line.max_qty, parsed))
      : 0;
    onSelectionChange({
      ...selection,
      [id]: {
        selected: selection[id]?.selected ?? true,
        qty,
      },
    });
  }

  function toggleAll(selected: boolean) {
    const next: InventoryLineSelection = { ...selection };
    for (const line of lines) {
      next[line.id] = {
        selected,
        qty: next[line.id]?.qty ?? line.max_qty,
      };
    }
    onSelectionChange(next);
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Inventory (GRN stock on linked PO)
        </p>
        {lines.length > 0 ? (
          <button
            type="button"
            className="cursor-pointer text-[10px] font-medium text-sky-800 underline-offset-2 transition-colors duration-200 hover:text-sky-950 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            onClick={() => toggleAll(!allSelected)}
          >
            {allSelected ? "Clear all" : "Select all"}
          </button>
        ) : null}
      </div>
      {loading ? (
        <p className="text-xs text-muted-foreground">Loading GRN warehouse stock…</p>
      ) : lines.length === 0 ? (
        <p className="text-xs text-muted-foreground">{emptyLabel}</p>
      ) : (
        <ul className="max-h-44 space-y-1 overflow-y-auto rounded-md border border-border/60 bg-background/80 p-1.5">
          {lines.map((line) => {
            const row = selection[line.id];
            const selected = Boolean(row?.selected);
            const qty = row?.qty ?? line.max_qty;
            return (
              <li
                key={line.id}
                className={cn(
                  "flex items-start gap-2 rounded-md border px-2 py-1.5 transition-colors duration-200",
                  selected
                    ? "border-sky-200/80 bg-sky-50/50"
                    : "border-transparent bg-transparent opacity-70",
                )}
              >
                <input
                  type="checkbox"
                  className="mt-0.5 size-3.5 shrink-0 cursor-pointer accent-sky-700"
                  checked={selected}
                  onChange={(event) => setLineSelected(line.id, event.target.checked)}
                  aria-label={`Include ${line.product_name}`}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-foreground">
                    {line.product_name}
                  </p>
                  {line.detail ? (
                    <p className="truncate text-[10px] text-muted-foreground">{line.detail}</p>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Input
                    type="number"
                    min={0}
                    max={line.max_qty}
                    step="any"
                    value={qty}
                    disabled={!selected}
                    onChange={(event) => setLineQty(line.id, event.target.value)}
                    className="h-7 w-16 px-1.5 text-right text-xs tabular-nums"
                    aria-label={`Quantity for ${line.product_name}`}
                  />
                  <span className="text-[10px] text-muted-foreground">/ {line.max_qty}</span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {lines.length > 0 ? (
        <p className="text-[10px] text-muted-foreground">
          {selectedCount} of {lines.length} item{lines.length === 1 ? "" : "s"} selected
        </p>
      ) : null}
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
  const orderedRows = useMemo(() => customerLinesInCrmOrder(rows), [rows]);
  const totals = useMemo(() => {
    return orderedRows.reduce(
      (acc, row) => {
        acc.total += Number(row.line_total) || 0;
        acc.gst += Number(row.gst_amount) || 0;
        acc.withGst += Number(row.total_with_gst) || 0;
        return acc;
      },
      { total: 0, gst: 0, withGst: 0 },
    );
  }, [orderedRows]);

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
            {orderedRows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-muted-foreground">
                  {emptyLabel}
                </td>
              </tr>
            ) : (
              orderedRows.map((row, index) => (
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
          {orderedRows.length > 0 ? (
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

function VendorPurchaseTable({
  rows,
  customerRows,
  emptyLabel,
}: {
  rows: ScmVendorLine[];
  customerRows: ScmVendorLine[];
  emptyLabel: string;
}) {
  const orderedRows = useMemo(
    () => vendorLinesInCrmOrder(rows, customerRows),
    [rows, customerRows],
  );
  const totals = useMemo(() => {
    return orderedRows.reduce(
      (acc, row) => {
        acc.total += Number(row.line_total) || 0;
        acc.gst += Number(row.gst_amount) || 0;
        acc.withGst += Number(row.total_with_gst) || 0;
        return acc;
      },
      { total: 0, gst: 0, withGst: 0 },
    );
  }, [orderedRows]);

  return (
    <div className="overflow-hidden rounded-md border border-border">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[872px] table-fixed text-sm">
            <colgroup>
              <col className="w-12" />
              <col className="min-w-[120px]" />
              <col className="min-w-[120px]" />
              <col className="w-16" />
              <col className="min-w-[120px]" />
              <col className="w-[7.5rem]" />
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
              {orderedRows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-3 py-6 text-center text-muted-foreground">
                    {emptyLabel}
                  </td>
                </tr>
              ) : (
                orderedRows.map((row, index) => (
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
            {orderedRows.length > 0 ? (
              <tfoot className="border-t border-border bg-muted/30 text-sm font-semibold">
                <tr>
                  <td colSpan={6} className="px-3 py-2 text-right">
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

export function ScmOvfViewPage({ ovfId }: { ovfId: string }) {
  const router = useRouter();
  const [preview, setPreview] = useState<ScmOvfPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chargesBusy, setChargesBusy] = useState(false);
  const [chargesBanner, setChargesBanner] = useState<string | null>(null);
  const [stockAllocatedBanner, setStockAllocatedBanner] = useState(false);
  const [shipDialogOpen, setShipDialogOpen] = useState(false);
  const [shipKind, setShipKind] = useState<OvfShipDocumentKind>("delivery_challan");
  const [poInventoryRows, setPoInventoryRows] = useState<ProcurementInventoryRow[]>([]);
  const [shipInventoryLoading, setShipInventoryLoading] = useState(false);
  const [inventorySelection, setInventorySelection] = useState<InventoryLineSelection>({});
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
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("stockAllocated") !== "1") return;
    setStockAllocatedBanner(true);
    router.replace(`/procurement/scm/ovf/${ovfId}`, { scroll: false });
  }, [ovfId, router]);

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
  const fulfillmentRows = useMemo(
    () => (preview ? buildOvfFulfillmentRows(preview) : []),
    [preview],
  );
  const itemPlanLines = preview?.item_plan?.lines || [];
  const openDistributorKeys = useMemo(
    () =>
      new Set(
        (preview?.open_distributor_names || [])
          .map((name) => ovfDistributorKey(name))
          .filter(Boolean),
      ),
    [preview?.open_distributor_names],
  );
  const ovfOnHold = Boolean(preview?.scm_on_hold);
  const linkedPos = preview?.purchase_orders?.length
    ? preview.purchase_orders
    : preview?.purchase_order_id
      ? [
          {
            id: preview.purchase_order_id,
            document_number: preview.purchase_order_number,
            company_po_number: preview.company_po_number,
            vendor_name: preview.vendor_name,
            status: preview.purchase_order_status,
          },
        ]
      : [];
  const linkedPoOrderIds = useMemo(
    () => linkedPos.map((row) => String(row.id)).filter(Boolean),
    [linkedPos],
  );

  useEffect(() => {
    if (!shipDialogOpen || linkedPoOrderIds.length === 0) {
      if (!shipDialogOpen) setPoInventoryRows([]);
      return;
    }
    let cancelled = false;
    setShipInventoryLoading(true);
    void listProcurementInventory()
      .then((rows) => {
        if (!cancelled) setPoInventoryRows(rows);
      })
      .catch(() => {
        if (!cancelled) setPoInventoryRows([]);
      })
      .finally(() => {
        if (!cancelled) setShipInventoryLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [shipDialogOpen, linkedPoOrderIds]);

  const grnPoInventoryLines = useMemo(
    () => buildGrnPoInventoryShipLines(poInventoryRows, linkedPoOrderIds),
    [poInventoryRows, linkedPoOrderIds],
  );
  const bookedOvfInventoryLines = useMemo(
    () => (preview ? buildOvfBookedInventoryShipLines(preview) : []),
    [preview],
  );
  const inventoryShipLineOptions = useMemo(
    () => [...grnPoInventoryLines, ...bookedOvfInventoryLines],
    [grnPoInventoryLines, bookedOvfInventoryLines],
  );
  const canShipInventory = inventoryShipLineOptions.length > 0;
  const hasSelectedInventoryShipLines = useMemo(
    () =>
      inventoryShipLineOptions.some(
        (line) =>
          inventorySelection[line.id]?.selected &&
          (inventorySelection[line.id]?.qty ?? 0) > 0,
      ),
    [inventoryShipLineOptions, inventorySelection],
  );

  useEffect(() => {
    if (!shipDialogOpen) return;
    setInventorySelection((prev) => {
      const next: InventoryLineSelection = { ...prev };
      let changed = false;
      for (const line of inventoryShipLineOptions) {
        if (!next[line.id]) {
          next[line.id] = { selected: true, qty: line.max_qty };
          changed = true;
          continue;
        }
        const clampedQty = Math.min(next[line.id].qty, line.max_qty);
        if (clampedQty !== next[line.id].qty) {
          next[line.id] = { ...next[line.id], qty: clampedQty };
          changed = true;
        }
      }
      for (const id of Object.keys(next)) {
        if (!inventoryShipLineOptions.some((line) => line.id === id)) {
          delete next[id];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [shipDialogOpen, inventoryShipLineOptions]);
  const showActiveHold = Boolean(preview?.scm_on_hold || queueStatus === "hold");
  const holdHistory = useMemo(() => {
    if (!preview?.scm_hold_history?.length) return [];
    return [...preview.scm_hold_history].sort(
      (a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime(),
    );
  }, [preview]);

  function openShipDialog() {
    setShipKind("delivery_challan");
    setInventorySelection({});
    setShipDialogOpen(true);
  }

  function confirmShipChallan() {
    if (!preview || !canShipInventory || !hasSelectedInventoryShipLines) return;
    setShipDialogOpen(false);
    const orderId = String(preview.purchase_order_id || linkedPos[0]?.id || "");

    const selectedLines = inventoryShipLineOptions
      .filter(
        (line) =>
          inventorySelection[line.id]?.selected &&
          (inventorySelection[line.id]?.qty ?? 0) > 0,
      )
      .map((line) => ({
        id: line.id,
        source: line.source,
        product_name: line.product_name,
        qty: Math.min(inventorySelection[line.id].qty, line.max_qty),
        stock_unit_id: line.stock_unit_id,
        serial_number: line.serial_number,
        grn_number: line.grn_number,
        unit_cost: line.unit_cost,
      }));
    setOvfInventoryShipSelection({
      ovf_id: ovfId,
      order_id: orderId,
      lines: selectedLines,
    });
    const hasGrnLines = selectedLines.some((line) => line.source === "grn");
    if (hasGrnLines && orderId) {
      router.push(ovfGrnStockChallanHref(ovfId, orderId, shipKind));
      return;
    }
    router.push(ovfChallanHref(ovfId, "inventory", orderId || null, shipKind));
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
            {preview ? (
              <Link
                href={ovfItemPlanHref(ovfId)}
                className={cn(
                  buttonVariants({ size: "sm", variant: "outline" }),
                  "cursor-pointer transition-colors duration-200",
                )}
              >
                <ShoppingCart className="mr-1.5 size-3.5" />
                Create PO
              </Link>
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
            {preview ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="cursor-pointer transition-colors duration-200"
                disabled={loading}
                onClick={openShipDialog}
              >
                <Truck className="mr-1.5 size-3.5" />
                Billing or DC
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
            <div className="space-y-3">
              <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <DetailItem label="Customer">
                  {textOrDash(preview.customer_name || preview.account_name)}
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
              </dl>
              <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <DetailItem label="Project title">
                  {textOrDash(preview.project_title)}
                </DetailItem>
                <DetailItem label="OEM / Brand name">
                  {textOrDash(preview.oem_name)}
                </DetailItem>
                <DetailItem label="Approved by">{textOrDash(preview.ovf_approver)}</DetailItem>
                <DetailItem label="Approval status">
                  <FinanceStatusBadge status={preview.approval_status || "pending"} />
                </DetailItem>
              </dl>
              <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <DetailItem label="Margin (total)">{moneyPrecise(preview.total_margin_amount)}</DetailItem>
                <DetailItem label="Margin %">{pct(preview.total_margin_pct)}</DetailItem>
              </dl>
            </div>
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
              customerRows={preview.customer_lines || []}
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

          <SectionCard
            title="Purchase orders by product"
            icon={ShoppingCart}
            subtitle="Each line shows the vendor PO for that product. Record GRN after the PO is issued."
          >
            <div className="overflow-x-auto rounded-md border border-border">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Product</th>
                    <th className="px-3 py-2 text-right font-medium">Qty</th>
                    <th className="px-3 py-2 text-left font-medium">Distributor</th>
                    <th className="px-3 py-2 text-left font-medium">Company PO</th>
                    <th className="px-3 py-2 text-left font-medium">GRN</th>
                  </tr>
                </thead>
                <tbody>
                  {itemPlanLines.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
                        No vendor charge lines on this OVF.
                      </td>
                    </tr>
                  ) : (
                    itemPlanLines.map((line, index) => {
                      const vendorName = (line.distributor_name || "").trim();
                      const linkedPo =
                        line.source === "purchase_order" && vendorName && preview
                          ? resolvePoForDistributor(preview, vendorName)
                          : null;
                      const poOpen =
                        line.source === "purchase_order" &&
                        vendorName &&
                        openDistributorKeys.has(ovfDistributorKey(vendorName));
                      const grnEnabled = linkedPo ? poAllowsGrnRecording(linkedPo.status) : false;
                      return (
                        <tr
                          key={`${line.product_name}-${index}`}
                          className="border-b border-border/70 last:border-b-0"
                        >
                          <td className="px-3 py-2 font-medium">{line.product_name}</td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {formatItemPlanQty(line.qty)}
                          </td>
                          <td className="px-3 py-2">
                            {line.source === "inventory" ? "Inventory" : vendorName || "—"}
                          </td>
                          <td className="px-3 py-2">
                            {line.source === "inventory" ? (
                              <span className="text-xs text-muted-foreground">From stock</span>
                            ) : linkedPo ? (
                              <Link
                                href={`/procurement/orders/${linkedPo.id}`}
                                className="cursor-pointer text-sm font-medium text-[#0369A1] underline-offset-2 transition-colors duration-200 hover:text-[#0284C7] hover:underline"
                              >
                                {linkedPo.label}
                              </Link>
                            ) : poOpen && !ovfOnHold ? (
                              <Link
                                href={ovfCreatePoHref(ovfId, vendorName)}
                                className="cursor-pointer text-xs font-medium text-[#0369A1] underline-offset-2 transition-colors duration-200 hover:text-[#0284C7] hover:underline"
                              >
                                Create PO
                              </Link>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            {line.source === "inventory" ? (
                              <span className="text-xs text-muted-foreground">—</span>
                            ) : linkedPo && grnEnabled ? (
                              <Link
                                href={`/procurement/orders/${linkedPo.id}?tab=grn`}
                                className={cn(
                                  buttonVariants({ size: "sm", variant: "outline" }),
                                  "h-7 cursor-pointer gap-1 px-2 text-xs transition-colors duration-200",
                                )}
                              >
                                <PackageCheck className="size-3.5" aria-hidden />
                                GRN
                              </Link>
                            ) : linkedPo ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-7 cursor-not-allowed px-2 text-xs opacity-60"
                                disabled
                                title="GRN is available after admin issues this PO"
                              >
                                <PackageCheck className="mr-1 size-3.5" aria-hidden />
                                GRN
                              </Button>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </SectionCard>

          <ScmCommercialDocumentsPanel
            ovfId={ovfId}
            branchId={preview.branch_id}
            companyId={preview.company_id}
            title="OVF documents"
            description="Sales attachments on this OVF — included when the PO is sent for approval."
            allowUpload={false}
            compact
          />
        </>
      ) : null}

      <ConfirmDialog
        open={shipDialogOpen}
        title="Billing or delivery challan"
        description="Choose billing (invoice) or delivery challan, then select GRN warehouse stock to ship."
        confirmLabel="Continue"
        cancelLabel="Not now"
        contentClassName="max-w-lg"
        confirmDisabled={!canShipInventory || !hasSelectedInventoryShipLines}
        onConfirm={confirmShipChallan}
        onCancel={() => setShipDialogOpen(false)}
      >
        <div className="mt-3 space-y-2">
          <p className="text-xs font-medium text-foreground">Document type</p>
          {(
            [
              {
                value: "billing" as const,
                title: "Billing",
                detail: "Invoice number and date — same path as GRN billing.",
              },
              {
                value: "delivery_challan" as const,
                title: "Delivery challan",
                detail: "Deliver without taking a bill. Bill taken can be recorded later.",
              },
            ] as const
          ).map((option) => (
            <label
              key={option.value}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-md border px-3 py-2.5 transition-colors duration-200",
                "border-border hover:bg-muted/40 has-[:checked]:border-sky-400 has-[:checked]:bg-sky-50/70",
              )}
            >
              <input
                type="radio"
                name="ovf-ship-kind"
                className="mt-0.5 cursor-pointer accent-sky-700"
                value={option.value}
                checked={shipKind === option.value}
                onChange={() => setShipKind(option.value)}
              />
              <span className="min-w-0 space-y-0.5">
                <span className="block text-sm font-medium text-foreground">{option.title}</span>
                <span className="block text-xs text-muted-foreground">{option.detail}</span>
              </span>
            </label>
          ))}
          <div className="mt-3 space-y-2.5 rounded-md border border-border bg-muted/20 p-2.5">
            <p className="text-xs font-medium text-foreground">Items on this challan</p>
            {!canShipInventory ? (
              <p className="text-xs text-amber-800">
                {linkedPoOrderIds.length > 0
                  ? "Receive stock on the PO GRN first (billing + stock split)."
                  : "Create a PO and receive GRN stock first."}
              </p>
            ) : null}
            <ShipInventoryLinePicker
              lines={inventoryShipLineOptions}
              selection={inventorySelection}
              onSelectionChange={setInventorySelection}
              loading={shipInventoryLoading}
              emptyLabel={
                linkedPoOrderIds.length > 0
                  ? "No GRN warehouse stock on linked PO(s) yet."
                  : "No purchase order linked yet."
              }
            />
          </div>
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
