"use client";

import type { ReactNode } from "react";
import { useRef } from "react";
import { ChevronDown, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  formatInrPrecise,
  type OvfLine,
  type OvfLineFormInput,
  type QuoteLine,
} from "@/services/sales-crm-service";

export const GST_PCT = 18;

export type CustomerChargeRow = {
  key: string;
  serverId?: string;
  fromQuote?: boolean;
  product_name: string;
  description: string;
  qty: string;
  unit_price: string;
  total: string;
  gst_pct: string;
  total_gst: string;
  total_with_gst: string;
};

export type VendorChargeRow = {
  key: string;
  serverId?: string;
  fromQuote?: boolean;
  product_name: string;
  description: string;
  qty: string;
  unit_price: string;
  total: string;
  gst_pct: string;
  total_gst: string;
  total_with_gst: string;
  vendor_name: string;
  contact_person: string;
  contact_number: string;
};

/** One Customer PO / Vendor Quote for the whole charges table (not per product row). */
export type ChargeAttachment = {
  fileName: string;
  file: File | null;
};

export function emptyChargeAttachment(): ChargeAttachment {
  return { fileName: "", file: null };
}

function newKey() {
  return `row-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function emptyCustomerRow(): CustomerChargeRow {
  return {
    key: newKey(),
    fromQuote: false,
    product_name: "",
    description: "",
    qty: "",
    unit_price: "",
    total: "",
    gst_pct: String(GST_PCT),
    total_gst: "",
    total_with_gst: "",
  };
}

export function emptyVendorRow(): VendorChargeRow {
  return {
    key: newKey(),
    fromQuote: false,
    product_name: "",
    description: "",
    qty: "",
    unit_price: "",
    total: "",
    gst_pct: String(GST_PCT),
    total_gst: "",
    total_with_gst: "",
    vendor_name: "",
    contact_person: "",
    contact_number: "",
  };
}

export function moneyFromQtyPrice(qty: string, unitPrice: string, gstPct: string) {
  const q = Number(qty) || 0;
  const p = Number(unitPrice) || 0;
  const g = Number(gstPct) || 0;
  const total = q * p;
  const totalGst = (total * g) / 100;
  return {
    total: total ? moneyAsFixed(total) : "",
    total_gst: total ? moneyAsFixed(totalGst) : "",
    total_with_gst: total ? moneyAsFixed(total + totalGst) : "",
  };
}

function moneyAsFixed(value: number | string | null | undefined): string {
  const n = typeof value === "string" ? Number(value) : value ?? 0;
  if (!Number.isFinite(n)) return "";
  return Number(n).toFixed(2);
}

function qtyAsInt(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "";
  const n = Math.round(Number(value));
  return Number.isFinite(n) ? String(n) : "";
}

function storedOrQuoteText(
  stored: string | null | undefined,
  quoteValue: string | null | undefined,
): string {
  const fromStore = (stored ?? "").trim();
  if (fromStore) return fromStore;
  return (quoteValue ?? "").trim();
}

function quoteByProductName(quoteLines: QuoteLine[]): Map<string, QuoteLine> {
  const map = new Map<string, QuoteLine>();
  for (const line of quoteLines) {
    const key = (line.product_name || "").trim().toLowerCase();
    if (key && !map.has(key)) map.set(key, line);
  }
  return map;
}

function quoteByLineNo(quoteLines: QuoteLine[]): Map<number, QuoteLine> {
  const map = new Map<number, QuoteLine>();
  for (const line of quoteLines) {
    map.set(Number(line.line_no), line);
  }
  return map;
}

export function customerRowsFromQuoteLines(quoteLines: QuoteLine[]): CustomerChargeRow[] {
  return quoteLines.map((quoteLine) => customerFromQuote(quoteLine));
}

export function vendorRowsFromQuoteLines(quoteLines: QuoteLine[]): VendorChargeRow[] {
  return quoteLines.map((quoteLine) => vendorFromQuote(quoteLine));
}

export function customerRowsFromOvfLines(
  lines: OvfLine[],
  quoteLines: QuoteLine[] = [],
): CustomerChargeRow[] {
  const byName = quoteByProductName(quoteLines);
  const byNo = quoteByLineNo(quoteLines);
  const sorted = [...lines]
    .filter((line) => line.side === "customer_po")
    .sort((a, b) => Number(a.line_no) - Number(b.line_no) || a.product_name.localeCompare(b.product_name));
  return sorted.map((line) => {
    const qty = qtyAsInt(line.qty);
    const unitPrice = moneyAsFixed(line.unit_price ?? 0);
    const gstPct = String(Number(line.gst_pct) > 0 ? line.gst_pct : GST_PCT);
    const storedTotal = moneyAsFixed(line.line_total);
    const money =
      storedTotal !== ""
        ? {
          total: storedTotal,
          total_gst: moneyAsFixed((Number(storedTotal) * (Number(gstPct) || 0)) / 100),
          total_with_gst: moneyAsFixed(
            Number(storedTotal) + (Number(storedTotal) * (Number(gstPct) || 0)) / 100,
          ),
        }
        : moneyFromQtyPrice(qty, unitPrice, gstPct);
    const quoteLine =
      byName.get((line.product_name || "").trim().toLowerCase()) ?? byNo.get(Number(line.line_no));
    return {
      key: line.id,
      serverId: line.id,
      fromQuote: false,
      product_name: line.product_name ?? "",
      description: storedOrQuoteText(line.description, quoteLine?.description),
      qty,
      unit_price: unitPrice,
      total: money.total,
      gst_pct: gstPct,
      total_gst: money.total_gst,
      total_with_gst: money.total_with_gst,
    } satisfies CustomerChargeRow;
  });
}

export function vendorRowsFromOvfLines(
  lines: OvfLine[],
  quoteLines: QuoteLine[] = [],
): VendorChargeRow[] {
  const byNo = quoteByLineNo(quoteLines);
  const sorted = [...lines]
    .filter((line) => line.side === "vendor")
    .sort((a, b) => Number(a.line_no) - Number(b.line_no) || a.product_name.localeCompare(b.product_name));
  return sorted.map((line) => {
    const qty = qtyAsInt(line.qty);
    const unitPrice = moneyAsFixed(line.unit_price ?? 0);
    const gstPct = String(Number(line.gst_pct) > 0 ? line.gst_pct : GST_PCT);
    const storedTotal = moneyAsFixed(line.line_total);
    const money =
      storedTotal !== ""
        ? {
          total: storedTotal,
          total_gst: moneyAsFixed((Number(storedTotal) * (Number(gstPct) || 0)) / 100),
          total_with_gst: moneyAsFixed(
            Number(storedTotal) + (Number(storedTotal) * (Number(gstPct) || 0)) / 100,
          ),
        }
        : moneyFromQtyPrice(qty, unitPrice, gstPct);
    const quoteLine = byNo.get(Number(line.line_no));
    const storedDistributor = (line.distributor_name ?? "").trim();
    const quoteProduct = (quoteLine?.product_name ?? "").trim();
    const lineProduct = (line.product_name ?? "").trim();
    // Legacy: distributor was written into product_name before distributor_name existed.
    const legacyDistributor =
      !storedDistributor &&
        quoteProduct &&
        lineProduct.toLowerCase() !== quoteProduct.toLowerCase()
        ? lineProduct
        : "";
    const distributor = storedDistributor || legacyDistributor;
    const productName = storedDistributor
      ? lineProduct || quoteProduct
      : legacyDistributor
        ? quoteProduct
        : lineProduct || quoteProduct;
    return {
      key: line.id,
      serverId: line.id,
      fromQuote: false,
      product_name: productName,
      description: storedOrQuoteText(line.description, quoteLine?.description),
      qty,
      unit_price: unitPrice,
      total: money.total,
      gst_pct: gstPct,
      total_gst: money.total_gst,
      total_with_gst: money.total_with_gst,
      vendor_name: distributor,
      contact_person: (line.contact_person ?? "").trim(),
      contact_number: (line.contact_number ?? "").trim(),
    } satisfies VendorChargeRow;
  });
}

export function customerFromQuote(quoteLine: QuoteLine, ovfLine?: OvfLine): CustomerChargeRow {
  const qty = qtyAsInt(ovfLine?.qty ?? quoteLine.qty);
  const unitPrice = moneyAsFixed(ovfLine?.unit_price ?? quoteLine.unit_sell ?? 0);
  const gstPct = String(quoteLine.gst_pct || GST_PCT);
  const money = moneyFromQtyPrice(qty, unitPrice, gstPct);
  return {
    key: ovfLine?.id ?? `quote-customer-${quoteLine.id}`,
    serverId: ovfLine?.id,
    fromQuote: true,
    product_name: storedOrQuoteText(ovfLine?.product_name, quoteLine.product_name),
    description: storedOrQuoteText(ovfLine?.description, quoteLine.description),
    qty,
    unit_price: unitPrice,
    total: money.total,
    gst_pct: gstPct,
    total_gst: money.total_gst,
    total_with_gst: money.total_with_gst,
  };
}

export function vendorFromQuote(quoteLine: QuoteLine, ovfLine?: OvfLine): VendorChargeRow {
  const qty = qtyAsInt(ovfLine?.qty ?? quoteLine.qty);
  const unitPrice = moneyAsFixed(ovfLine?.unit_price ?? quoteLine.unit_cost ?? 0);
  const gstPct = String(quoteLine.gst_pct || GST_PCT);
  const money = moneyFromQtyPrice(qty, unitPrice, gstPct);
  return {
    key: ovfLine?.id ?? `quote-vendor-${quoteLine.id}`,
    serverId: ovfLine?.id,
    fromQuote: true,
    product_name: storedOrQuoteText(ovfLine?.product_name, quoteLine.product_name),
    description: storedOrQuoteText(ovfLine?.description, quoteLine.description),
    qty,
    unit_price: unitPrice,
    total: money.total,
    gst_pct: gstPct,
    total_gst: money.total_gst,
    total_with_gst: money.total_with_gst,
    vendor_name: (ovfLine?.distributor_name ?? "").trim(),
    contact_person: (ovfLine?.contact_person ?? "").trim(),
    contact_number: (ovfLine?.contact_number ?? "").trim(),
  };
}

function customerLinePayload(row: CustomerChargeRow): OvfLineFormInput {
  const qty = Math.round(Number(row.qty)) || 1;
  const unitPrice = Number(moneyAsFixed(Number(row.unit_price) || 0)) || 0;
  const total = Number(moneyAsFixed(Number(row.total) || qty * unitPrice)) || 0;
  return {
    product_name: row.product_name.trim(),
    description: row.description.trim() || null,
    distributor_name: null,
    contact_person: null,
    contact_number: null,
    qty,
    unit_price: unitPrice,
    gst_pct: Number(row.gst_pct) || GST_PCT,
    line_total: total,
  };
}

function vendorLinePayload(row: VendorChargeRow): OvfLineFormInput {
  const qty = Math.round(Number(row.qty)) || 1;
  const unitPrice = Number(moneyAsFixed(Number(row.unit_price) || 0)) || 0;
  const total = Number(moneyAsFixed(Number(row.total) || qty * unitPrice)) || 0;
  return {
    product_name: row.product_name.trim() || row.vendor_name.trim(),
    description: row.description.trim() || null,
    distributor_name: row.vendor_name.trim() || null,
    contact_person: row.contact_person.trim() || null,
    contact_number: row.contact_number.trim() || null,
    qty,
    unit_price: unitPrice,
    gst_pct: Number(row.gst_pct) || GST_PCT,
    line_total: total,
  };
}

function takeMatchingLine(
  pool: OvfLine[],
  row: { serverId?: string; product_name: string; vendor_name?: string },
): OvfLine | undefined {
  if (row.serverId) {
    const byId = pool.findIndex((line) => line.id === row.serverId);
    if (byId >= 0) return pool.splice(byId, 1)[0];
  }
  const product = (row.product_name || "").trim().toLowerCase();
  if (product) {
    const byProduct = pool.findIndex((line) => (line.product_name || "").trim().toLowerCase() === product);
    if (byProduct >= 0) return pool.splice(byProduct, 1)[0];
  }
  const vendor = (row.vendor_name || "").trim().toLowerCase();
  if (vendor) {
    const byDist = pool.findIndex(
      (line) => (line.distributor_name || line.product_name || "").trim().toLowerCase() === vendor,
    );
    if (byDist >= 0) return pool.splice(byDist, 1)[0];
  }
  return pool.shift();
}

export function sumLineTotals(rows: { total: string }[]) {
  return rows.reduce((sum, row) => sum + (Number(row.total) || 0), 0);
}

export function validateChargeAttachments(
  customerPo: ChargeAttachment,
  vendorQuote: ChargeAttachment,
): string | null {
  if (!customerPo.fileName.trim()) {
    return "Add PO * is required for Customer Charges.";
  }
  if (!vendorQuote.fileName.trim()) {
    return "Add Quote * is required for Vendor Charges.";
  }
  return null;
}

function ChargesField({
  value,
  readOnly = false,
  placeholder,
  type = "text",
  className,
  onChange,
}: {
  value: string;
  readOnly?: boolean;
  placeholder?: string;
  type?: string;
  className?: string;
  onChange?: (value: string) => void;
}) {
  return (
    <Input
      type={type}
      readOnly={readOnly}
      tabIndex={readOnly ? -1 : undefined}
      placeholder={placeholder}
      value={value}
      onChange={onChange ? (e) => onChange(e.target.value) : undefined}
      className={cn(
        "h-9 w-full min-w-0 rounded-[4px] border-[#cfd7e3] bg-white px-2.5 text-[13px] shadow-none transition-colors duration-200",
        "focus-visible:border-sky-400 focus-visible:ring-1 focus-visible:ring-sky-300",
        "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
        readOnly && "cursor-default bg-[#f8fafc] text-foreground",
        className,
      )}
    />
  );
}

function ChargesTableShell({
  title,
  children,
  headerRight,
  footerLeft,
  totalLabel,
  totalValue,
}: {
  title: string;
  children: ReactNode;
  headerRight?: ReactNode;
  footerLeft: ReactNode;
  totalLabel: string;
  totalValue: string;
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[15px] font-semibold text-foreground">{title}</h3>
        {headerRight ? <div className="shrink-0">{headerRight}</div> : null}
      </div>
      <div className="overflow-x-auto rounded-md border border-[#e2e8f0]">{children}</div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        {footerLeft}
        <div className="ml-auto flex items-center gap-2">
          <span className="text-[13px] font-medium text-foreground">{totalLabel}</span>
          <Input
            readOnly
            tabIndex={-1}
            value={totalValue}
            className="h-9 w-48 cursor-default rounded-[4px] border-[#cfd7e3] bg-[#f8fafc] text-right text-[13px] tabular-nums shadow-none"
          />
        </div>
      </div>
    </div>
  );
}

function thClass(extra = "") {
  return cn("whitespace-nowrap px-2 py-2.5 text-left text-[12px] font-medium text-[#475569]", extra);
}

function tdClass() {
  return "px-2 py-2 align-middle";
}

function ChargesLocalFileUpload({
  fileName,
  required,
  disabled,
  onFileSelected,
}: {
  fileName: string;
  required?: boolean;
  disabled?: boolean;
  onFileSelected: (file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const missing = !disabled && required && !fileName;

  return (
    <div className="relative min-w-[140px]">
      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "flex h-9 w-full cursor-pointer items-center justify-between gap-1 rounded-[4px] border bg-white px-2.5 text-left text-[13px] transition-colors duration-200",
          missing ? "border-destructive/60" : "border-[#cfd7e3]",
          "hover:border-sky-400 focus-visible:border-sky-400 focus-visible:ring-1 focus-visible:ring-sky-300 focus-visible:outline-none",
          disabled && "cursor-default opacity-70",
        )}
        title={fileName || "Choose file"}
      >
        <span className={cn("min-w-0 truncate", fileName ? "text-foreground" : "text-muted-foreground")}>
          {fileName || (disabled ? "—" : required ? "Choose file *" : "Choose file")}
        </span>
        {!disabled ? <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" /> : null}
      </button>
      <input
        ref={inputRef}
        type="file"
        className="sr-only"
        disabled={disabled}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFileSelected(file);
          if (inputRef.current) inputRef.current.value = "";
        }}
      />
    </div>
  );
}

type OvfOrderLinesSectionProps = {
  customerRows: CustomerChargeRow[];
  vendorRows: VendorChargeRow[];
  onCustomerRowsChange?: (rows: CustomerChargeRow[]) => void;
  onVendorRowsChange?: (rows: VendorChargeRow[]) => void;
  customerPo?: ChargeAttachment;
  vendorQuote?: ChargeAttachment;
  onCustomerPoChange?: (attachment: ChargeAttachment) => void;
  onVendorQuoteChange?: (attachment: ChargeAttachment) => void;
  /** Distributor names selected on the lead — options for Distributor Name. */
  vendorNameOptions?: readonly string[];
  disabled?: boolean;
};

export function OvfOrderLinesSection({
  customerRows,
  vendorRows,
  onCustomerRowsChange,
  onVendorRowsChange,
  customerPo = emptyChargeAttachment(),
  vendorQuote = emptyChargeAttachment(),
  onCustomerPoChange,
  onVendorQuoteChange,
  vendorNameOptions = [],
  disabled = false,
}: OvfOrderLinesSectionProps) {
  const totalSaleValue = sumLineTotals(customerRows);
  const totalPurchaseValue = sumLineTotals(vendorRows);
  // Lead distributors only — never merge row values (those can be OEM/product names).
  const vendorOptions = Array.from(
    new Set(vendorNameOptions.map((name) => name.trim()).filter(Boolean)),
  );
  function selectedDistributor(value: string): string {
    const trimmed = value.trim();
    if (!trimmed) return "";
    const match = vendorOptions.find((name) => name.toLowerCase() === trimmed.toLowerCase());
    return match ?? "";
  }

  function updateCustomerRow(key: string, patch: Partial<CustomerChargeRow>, recalc = false) {
    if (disabled || !onCustomerRowsChange) return;
    onCustomerRowsChange(
      customerRows.map((row) => {
        if (row.key !== key) return row;
        const next = { ...row, ...patch };
        if (recalc) {
          const money = moneyFromQtyPrice(next.qty, next.unit_price, next.gst_pct);
          return { ...next, ...money };
        }
        return next;
      }),
    );
  }

  function updateVendorRow(key: string, patch: Partial<VendorChargeRow>, recalc = false) {
    if (disabled || !onVendorRowsChange) return;
    onVendorRowsChange(
      vendorRows.map((row) => {
        if (row.key !== key) return row;
        const next = { ...row, ...patch };
        if (recalc) {
          const money = moneyFromQtyPrice(next.qty, next.unit_price, next.gst_pct);
          return { ...next, ...money };
        }
        return next;
      }),
    );
  }

  function onAddCustomerRow() {
    if (disabled || !onCustomerRowsChange) return;
    onCustomerRowsChange([...customerRows, emptyCustomerRow()]);
  }

  function onAddVendorRow() {
    if (disabled || !onVendorRowsChange) return;
    onVendorRowsChange([...vendorRows, emptyVendorRow()]);
  }

  const customerAttachmentControl = (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <span className="text-[12px] font-medium whitespace-nowrap text-[#475569]">
        Add PO <span className="text-destructive">*</span>
      </span>
      <div className="w-[220px] max-w-full">
        <ChargesLocalFileUpload
          fileName={customerPo.fileName}
          required={!disabled}
          disabled={disabled || !onCustomerPoChange}
          onFileSelected={(file) => onCustomerPoChange?.({ fileName: file.name, file })}
        />
      </div>
    </div>
  );

  const vendorAttachmentControl = (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <span className="text-[12px] font-medium whitespace-nowrap text-[#475569]">
        Add Quote <span className="text-destructive">*</span>
      </span>
      <div className="w-[220px] max-w-full">
        <ChargesLocalFileUpload
          fileName={vendorQuote.fileName}
          required={!disabled}
          disabled={disabled || !onVendorQuoteChange}
          onFileSelected={(file) => onVendorQuoteChange?.({ fileName: file.name, file })}
        />
      </div>
    </div>
  );

  return (
    <section className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm">
      <div className="border-b border-border/70 px-4 py-3">
        <h2 className="text-base font-extrabold tracking-tight">Order Lines</h2>
        <p className="text-[11px] text-muted-foreground">
          {disabled
            ? "Customer Charges and Vendor Charges saved with this OVF."
            : "Customer Charges and Vendor Charges — prefilled from the quote; use + Add row for extras. One PO and one vendor quote cover all products."}
        </p>
      </div>

      <div className="space-y-10 px-4 py-5">
        <ChargesTableShell
          title="Customer Charges."
          totalLabel="Total Sale Value"
          totalValue={formatInrPrecise(totalSaleValue)}
          headerRight={
            !disabled ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 cursor-pointer border-sky-400 px-3 text-sky-700 transition-colors duration-200 hover:bg-sky-50 hover:text-sky-800"
                onClick={() => onAddCustomerRow()}
              >
                <Plus className="size-3.5" /> Add row
              </Button>
            ) : null
          }
          footerLeft={customerAttachmentControl}
        >
          <table className="w-full min-w-[1080px] border-collapse text-left">
            <thead>
              <tr className="bg-[#eef2f6]">
                <th className={thClass("min-w-[160px]")}>Product Name</th>
                <th className={thClass("min-w-[200px]")}>Description</th>
                <th className={thClass("min-w-[88px]")}>Quantity</th>
                <th className={thClass("min-w-[130px]")}>Unit Product Amt (₹)</th>
                <th className={thClass("min-w-[110px]")}>Total.</th>
                <th className={thClass("min-w-[90px]")}>GST ({GST_PCT}%)</th>
                <th className={thClass("min-w-[120px]")}>Total GST ({GST_PCT}%)</th>
                <th className={thClass("min-w-[150px]")}>Total Amount with GST</th>
              </tr>
            </thead>
            <tbody>
              {customerRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-6 text-center text-[12px] text-muted-foreground">
                    No customer charge rows. Click + Add row to create one.
                  </td>
                </tr>
              ) : (
                customerRows.map((row) => (
                  <tr key={row.key} className="border-t border-[#e8edf3]">
                    <td className={tdClass()}>
                      <ChargesField
                        readOnly={disabled || Boolean(row.fromQuote)}
                        value={row.product_name}
                        onChange={(v) => updateCustomerRow(row.key, { product_name: v })}
                      />
                    </td>
                    <td className={tdClass()}>
                      <ChargesField
                        readOnly={disabled || Boolean(row.fromQuote)}
                        value={row.description}
                        onChange={(v) => updateCustomerRow(row.key, { description: v })}
                      />
                    </td>
                    <td className={tdClass()}>
                      <ChargesField
                        readOnly={disabled || Boolean(row.fromQuote)}
                        type="number"
                        value={row.qty}
                        className="text-right tabular-nums"
                        onChange={(v) => updateCustomerRow(row.key, { qty: v }, true)}
                      />
                    </td>
                    <td className={tdClass()}>
                      <ChargesField
                        readOnly={disabled || Boolean(row.fromQuote)}
                        type="number"
                        value={row.unit_price}
                        className="text-right tabular-nums"
                        onChange={(v) => updateCustomerRow(row.key, { unit_price: v }, true)}
                      />
                    </td>
                    <td className={tdClass()}>
                      <ChargesField
                        readOnly={disabled}
                        type="number"
                        value={row.total}
                        className="text-right tabular-nums"
                        onChange={(v) => updateCustomerRow(row.key, { total: v })}
                      />
                    </td>
                    <td className={tdClass()}>
                      <ChargesField
                        readOnly={disabled}
                        type="number"
                        value={row.gst_pct}
                        className="text-right tabular-nums"
                        onChange={(v) => updateCustomerRow(row.key, { gst_pct: v }, true)}
                      />
                    </td>
                    <td className={tdClass()}>
                      <ChargesField
                        readOnly={disabled}
                        type="number"
                        value={row.total_gst}
                        className="text-right tabular-nums"
                        onChange={(v) => updateCustomerRow(row.key, { total_gst: v })}
                      />
                    </td>
                    <td className={tdClass()}>
                      <ChargesField
                        readOnly={disabled}
                        type="number"
                        value={row.total_with_gst}
                        className="text-right tabular-nums"
                        onChange={(v) => updateCustomerRow(row.key, { total_with_gst: v })}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </ChargesTableShell>

        <ChargesTableShell
          title="Vendor Charges."
          totalLabel="Total Purchase Value"
          totalValue={formatInrPrecise(totalPurchaseValue)}
          headerRight={
            !disabled ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 cursor-pointer border-sky-400 px-3 text-sky-700 transition-colors duration-200 hover:bg-sky-50 hover:text-sky-800"
                onClick={() => onAddVendorRow()}
              >
                <Plus className="size-3.5" /> Add row
              </Button>
            ) : null
          }
          footerLeft={vendorAttachmentControl}
        >
          <table className="w-full min-w-[1320px] border-collapse text-left">
            <thead>
              <tr className="bg-[#eef2f6]">
                <th className={thClass("min-w-[160px]")}>Product Name</th>
                <th className={thClass("min-w-[200px]")}>Description</th>
                <th className={thClass("min-w-[88px]")}>Quantity.</th>
                <th className={thClass("min-w-[130px]")}>Unit Purchase (₹)</th>
                <th className={thClass("min-w-[110px]")}>Total</th>
                <th className={thClass("min-w-[90px]")}>GST ({GST_PCT}%)</th>
                <th className={thClass("min-w-[140px]")}>Total Amount in GST</th>
                <th className={thClass("min-w-[150px]")}>Total Amount with GST</th>
                <th className={thClass("min-w-[140px]")}>Distributor Name</th>
                <th className={thClass("min-w-[130px]")}>Contact Person</th>
                <th className={thClass("min-w-[130px]")}>Contact Number.</th>
              </tr>
            </thead>
            <tbody>
              {vendorRows.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-3 py-6 text-center text-[12px] text-muted-foreground">
                    No vendor charge rows. Click + Add row to create one.
                  </td>
                </tr>
              ) : (
                vendorRows.map((row) => (
                  <tr key={row.key} className="border-t border-[#e8edf3]">
                    <td className={tdClass()}>
                      <ChargesField
                        readOnly={disabled || Boolean(row.fromQuote)}
                        value={row.product_name}
                        onChange={(v) => updateVendorRow(row.key, { product_name: v })}
                      />
                    </td>
                    <td className={tdClass()}>
                      <ChargesField
                        readOnly={disabled || Boolean(row.fromQuote)}
                        value={row.description}
                        onChange={(v) => updateVendorRow(row.key, { description: v })}
                      />
                    </td>
                    <td className={tdClass()}>
                      <ChargesField
                        readOnly={disabled || Boolean(row.fromQuote)}
                        type="number"
                        value={row.qty}
                        className="text-right tabular-nums"
                        onChange={(v) => updateVendorRow(row.key, { qty: v }, true)}
                      />
                    </td>
                    <td className={tdClass()}>
                      <ChargesField
                        readOnly={disabled || Boolean(row.fromQuote)}
                        type="number"
                        value={row.unit_price}
                        className="text-right tabular-nums"
                        onChange={(v) => updateVendorRow(row.key, { unit_price: v }, true)}
                      />
                    </td>
                    <td className={tdClass()}>
                      <ChargesField
                        readOnly={disabled}
                        type="number"
                        value={row.total}
                        className="text-right tabular-nums"
                        onChange={(v) => updateVendorRow(row.key, { total: v })}
                      />
                    </td>
                    <td className={tdClass()}>
                      <ChargesField
                        readOnly={disabled}
                        type="number"
                        value={row.gst_pct}
                        className="text-right tabular-nums"
                        onChange={(v) => updateVendorRow(row.key, { gst_pct: v }, true)}
                      />
                    </td>
                    <td className={tdClass()}>
                      <ChargesField
                        readOnly={disabled}
                        type="number"
                        value={row.total_gst}
                        className="text-right tabular-nums"
                        onChange={(v) => updateVendorRow(row.key, { total_gst: v })}
                      />
                    </td>
                    <td className={tdClass()}>
                      <ChargesField
                        readOnly={disabled}
                        type="number"
                        value={row.total_with_gst}
                        className="text-right tabular-nums"
                        onChange={(v) => updateVendorRow(row.key, { total_with_gst: v })}
                      />
                    </td>
                    <td className={tdClass()}>
                      <select
                        disabled={disabled}
                        value={selectedDistributor(row.vendor_name)}
                        onChange={(e) => updateVendorRow(row.key, { vendor_name: e.target.value })}
                        className={cn(
                          "flex h-9 w-full min-w-[140px] cursor-pointer rounded-[4px] border border-[#cfd7e3] bg-white px-2.5 text-[13px] shadow-none outline-none transition-colors duration-200",
                          "focus-visible:border-sky-400 focus-visible:ring-1 focus-visible:ring-sky-300",
                          disabled && "cursor-default bg-[#f8fafc] opacity-70",
                          !selectedDistributor(row.vendor_name) && "text-muted-foreground",
                        )}
                        aria-label="Distributor name"
                      >
                        <option value="">{vendorOptions.length ? "Select distributor…" : "No distributors on lead"}</option>
                        {vendorOptions.map((name) => (
                          <option key={name} value={name}>
                            {name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className={tdClass()}>
                      <ChargesField
                        readOnly={disabled}
                        value={row.contact_person}
                        onChange={(v) => updateVendorRow(row.key, { contact_person: v })}
                      />
                    </td>
                    <td className={tdClass()}>
                      <ChargesField
                        readOnly={disabled}
                        value={row.contact_number}
                        onChange={(v) => updateVendorRow(row.key, { contact_number: v })}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </ChargesTableShell>
      </div>
    </section>
  );
}

export async function persistOvfOrderLinesAfterCreate(
  ovfId: string,
  branchId: string,
  companyId: string | null | undefined,
  customerRows: CustomerChargeRow[],
  vendorRows: VendorChargeRow[],
  attachments: {
    customerPo: ChargeAttachment;
    vendorQuote: ChargeAttachment;
  },
  deps: {
    listOvfLines: (id: string) => Promise<OvfLine[]>;
    addOvfLine: (id: string, body: OvfLineFormInput) => Promise<OvfLine>;
    updateOvfLine: (lineId: string, body: OvfLineFormInput) => Promise<OvfLine>;
    createAttachment: (body: {
      entity_type: string;
      entity_id: string;
      branch_id: string;
      company_id?: string | null;
      file_name: string;
      category?: string;
      content_base64?: string | null;
      content_type?: string | null;
    }) => Promise<unknown>;
    fileToBase64: (file: File) => Promise<string>;
  },
) {
  const existing = await deps.listOvfLines(ovfId);
  const customerPool = existing
    .filter((line) => line.side === "customer_po")
    .sort((a, b) => Number(a.line_no) - Number(b.line_no));
  const vendorPool = existing
    .filter((line) => line.side === "vendor")
    .sort((a, b) => Number(a.line_no) - Number(b.line_no));

  for (const row of customerRows) {
    if (!row.product_name.trim()) continue;
    const payload = customerLinePayload(row);
    const match = takeMatchingLine(customerPool, row);
    if (match) {
      await deps.updateOvfLine(match.id, payload);
    } else {
      await deps.addOvfLine(ovfId, { side: "customer_po", ...payload });
    }
  }

  for (const row of vendorRows) {
    if (!row.product_name.trim() && !row.vendor_name.trim()) continue;
    const payload = vendorLinePayload(row);
    const match = takeMatchingLine(vendorPool, {
      serverId: row.serverId,
      product_name: row.product_name,
      vendor_name: row.vendor_name,
    });
    if (match) {
      await deps.updateOvfLine(match.id, payload);
    } else {
      await deps.addOvfLine(ovfId, { side: "vendor", ...payload });
    }
  }

  const poFile = attachments.customerPo.file;
  if (poFile) {
    await deps.createAttachment({
      entity_type: "ovf",
      entity_id: ovfId,
      branch_id: branchId,
      company_id: companyId,
      file_name: poFile.name,
      category: "customer_po",
      content_base64: await deps.fileToBase64(poFile),
      content_type: poFile.type || "application/octet-stream",
    });
  }

  const quoteFile = attachments.vendorQuote.file;
  if (quoteFile) {
    await deps.createAttachment({
      entity_type: "ovf",
      entity_id: ovfId,
      branch_id: branchId,
      company_id: companyId,
      file_name: quoteFile.name,
      category: "vendor_quote",
      content_base64: await deps.fileToBase64(quoteFile),
      content_type: quoteFile.type || "application/octet-stream",
    });
  }
}

export async function persistOvfOrderLinesOnUpdate(
  ovfId: string,
  branchId: string,
  companyId: string | null | undefined,
  customerRows: CustomerChargeRow[],
  vendorRows: VendorChargeRow[],
  attachments: {
    customerPo: ChargeAttachment;
    vendorQuote: ChargeAttachment;
  },
  deps: {
    addOvfLine: (id: string, body: OvfLineFormInput) => Promise<OvfLine>;
    updateOvfLine: (lineId: string, body: OvfLineFormInput) => Promise<OvfLine>;
    createAttachment: (body: {
      entity_type: string;
      entity_id: string;
      branch_id: string;
      company_id?: string | null;
      file_name: string;
      category?: string;
      content_base64?: string | null;
      content_type?: string | null;
    }) => Promise<unknown>;
    fileToBase64: (file: File) => Promise<string>;
  },
) {
  for (const row of customerRows) {
    if (!row.product_name.trim()) continue;
    const payload = customerLinePayload(row);
    if (row.serverId) {
      await deps.updateOvfLine(row.serverId, payload);
    } else {
      await deps.addOvfLine(ovfId, { side: "customer_po", ...payload });
    }
  }

  for (const row of vendorRows) {
    if (!row.product_name.trim() && !row.vendor_name.trim()) continue;
    const payload = vendorLinePayload(row);
    if (row.serverId) {
      await deps.updateOvfLine(row.serverId, payload);
    } else {
      await deps.addOvfLine(ovfId, { side: "vendor", ...payload });
    }
  }

  const poFile = attachments.customerPo.file;
  if (poFile) {
    await deps.createAttachment({
      entity_type: "ovf",
      entity_id: ovfId,
      branch_id: branchId,
      company_id: companyId,
      file_name: poFile.name,
      category: "customer_po",
      content_base64: await deps.fileToBase64(poFile),
      content_type: poFile.type || "application/octet-stream",
    });
  }

  const quoteFile = attachments.vendorQuote.file;
  if (quoteFile) {
    await deps.createAttachment({
      entity_type: "ovf",
      entity_id: ovfId,
      branch_id: branchId,
      company_id: companyId,
      file_name: quoteFile.name,
      category: "vendor_quote",
      content_base64: await deps.fileToBase64(quoteFile),
      content_type: quoteFile.type || "application/octet-stream",
    });
  }
}
