"use client";

import type { ReactNode } from "react";
import { useRef } from "react";
import { ChevronDown, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatInrPrecise, type OvfLine, type QuoteLine } from "@/services/sales-crm-service";

export const GST_PCT = 18;

export type CustomerChargeRow = {
  key: string;
  serverId?: string;
  fromQuote?: boolean;
  product_name: string;
  qty: string;
  unit_price: string;
  total: string;
  gst_pct: string;
  total_gst: string;
  total_with_gst: string;
  add_po: string;
  poFile?: File | null;
};

export type VendorChargeRow = {
  key: string;
  serverId?: string;
  fromQuote?: boolean;
  qty: string;
  unit_price: string;
  total: string;
  gst_pct: string;
  total_gst: string;
  total_with_gst: string;
  vendor_name: string;
  contact_person: string;
  contact_number: string;
  add_quote: string;
  quoteFile?: File | null;
};

function newKey() {
  return `row-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function emptyCustomerRow(): CustomerChargeRow {
  return {
    key: newKey(),
    fromQuote: false,
    product_name: "",
    qty: "",
    unit_price: "",
    total: "",
    gst_pct: String(GST_PCT),
    total_gst: "",
    total_with_gst: "",
    add_po: "",
    poFile: null,
  };
}

export function emptyVendorRow(): VendorChargeRow {
  return {
    key: newKey(),
    fromQuote: false,
    qty: "",
    unit_price: "",
    total: "",
    gst_pct: String(GST_PCT),
    total_gst: "",
    total_with_gst: "",
    vendor_name: "",
    contact_person: "",
    contact_number: "",
    add_quote: "",
    quoteFile: null,
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

export function customerRowsFromQuoteLines(quoteLines: QuoteLine[]): CustomerChargeRow[] {
  return quoteLines.map((quoteLine) => customerFromQuote(quoteLine));
}

export function vendorRowsFromQuoteLines(quoteLines: QuoteLine[]): VendorChargeRow[] {
  return quoteLines.map((quoteLine) => vendorFromQuote(quoteLine));
}

export function customerRowsFromOvfLines(lines: OvfLine[]): CustomerChargeRow[] {
  return lines
    .filter((line) => line.side === "customer_po")
    .map((line) => {
      const qty = qtyAsInt(line.qty);
      const unitPrice = moneyAsFixed(line.unit_price ?? 0);
      const gstPct = String(GST_PCT);
      const money = moneyFromQtyPrice(qty, unitPrice, gstPct);
      return {
        key: line.id,
        serverId: line.id,
        fromQuote: false,
        product_name: line.product_name,
        qty,
        unit_price: unitPrice,
        total: money.total,
        gst_pct: gstPct,
        total_gst: money.total_gst,
        total_with_gst: money.total_with_gst,
        add_po: "",
        poFile: null,
      } satisfies CustomerChargeRow;
    });
}

export function vendorRowsFromOvfLines(lines: OvfLine[]): VendorChargeRow[] {
  return lines
    .filter((line) => line.side === "vendor")
    .map((line) => {
      const qty = qtyAsInt(line.qty);
      const unitPrice = moneyAsFixed(line.unit_price ?? 0);
      const gstPct = String(GST_PCT);
      const money = moneyFromQtyPrice(qty, unitPrice, gstPct);
      return {
        key: line.id,
        serverId: line.id,
        fromQuote: false,
        qty,
        unit_price: unitPrice,
        total: money.total,
        gst_pct: gstPct,
        total_gst: money.total_gst,
        total_with_gst: money.total_with_gst,
        vendor_name: line.product_name,
        contact_person: "",
        contact_number: "",
        add_quote: "",
        quoteFile: null,
      } satisfies VendorChargeRow;
    });
}

export function customerFromQuote(quoteLine: QuoteLine, ovfLine?: OvfLine): CustomerChargeRow {
  const qty = qtyAsInt(quoteLine.qty);
  const unitPrice = moneyAsFixed(ovfLine?.unit_price ?? quoteLine.unit_sell ?? 0);
  const gstPct = String(quoteLine.gst_pct || GST_PCT);
  const money = moneyFromQtyPrice(qty, unitPrice, gstPct);
  return {
    key: ovfLine?.id ?? `quote-customer-${quoteLine.id}`,
    serverId: ovfLine?.id,
    fromQuote: true,
    product_name: quoteLine.product_name,
    qty,
    unit_price: unitPrice,
    total: money.total,
    gst_pct: gstPct,
    total_gst: money.total_gst,
    total_with_gst: money.total_with_gst,
    add_po: "",
    poFile: null,
  };
}

export function vendorFromQuote(quoteLine: QuoteLine, ovfLine?: OvfLine): VendorChargeRow {
  const qty = qtyAsInt(quoteLine.qty);
  const unitPrice = moneyAsFixed(ovfLine?.unit_price ?? quoteLine.unit_cost ?? 0);
  const gstPct = String(quoteLine.gst_pct || GST_PCT);
  const money = moneyFromQtyPrice(qty, unitPrice, gstPct);
  return {
    key: ovfLine?.id ?? `quote-vendor-${quoteLine.id}`,
    serverId: ovfLine?.id,
    fromQuote: true,
    qty,
    unit_price: unitPrice,
    total: money.total,
    gst_pct: gstPct,
    total_gst: money.total_gst,
    total_with_gst: money.total_with_gst,
    vendor_name: ovfLine?.product_name ?? "",
    contact_person: "",
    contact_number: "",
    add_quote: "",
    quoteFile: null,
  };
}

export function sumLineTotals(rows: { total: string }[]) {
  return rows.reduce((sum, row) => sum + (Number(row.total) || 0), 0);
}

export function validateChargeAttachments(
  customerRows: CustomerChargeRow[],
  vendorRows: VendorChargeRow[],
): string | null {
  if (customerRows.find((row) => !row.serverId && !row.add_po.trim())) {
    return "Add PO * is required for every Customer Charges row.";
  }
  if (vendorRows.find((row) => !row.serverId && !row.add_quote.trim())) {
    return "Add Quote * is required for every Vendor Charges row.";
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
  footerLeft,
  totalLabel,
  totalValue,
}: {
  title: string;
  children: ReactNode;
  footerLeft: ReactNode;
  totalLabel: string;
  totalValue: string;
}) {
  return (
    <div className="space-y-3">
      <h3 className="text-[15px] font-semibold text-foreground">{title}</h3>
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
  disabled?: boolean;
  onValidationError?: (message: string) => void;
};

export function OvfOrderLinesSection({
  customerRows,
  vendorRows,
  onCustomerRowsChange,
  onVendorRowsChange,
  disabled = false,
  onValidationError,
}: OvfOrderLinesSectionProps) {
  const totalSaleValue = sumLineTotals(customerRows);
  const totalPurchaseValue = sumLineTotals(vendorRows);

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
    const message = validateChargeAttachments(customerRows, []);
    if (message) {
      onValidationError?.(message);
      return;
    }
    onCustomerRowsChange([...customerRows, emptyCustomerRow()]);
  }

  function onAddVendorRow() {
    if (disabled || !onVendorRowsChange) return;
    const message = validateChargeAttachments([], vendorRows);
    if (message) {
      onValidationError?.(message);
      return;
    }
    onVendorRowsChange([...vendorRows, emptyVendorRow()]);
  }

  return (
      <section className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm">
        <div className="border-b border-border/70 px-4 py-3">
          <h2 className="text-sm font-medium tracking-tight">Order Lines</h2>
          <p className="text-[11px] text-muted-foreground">
            {disabled
              ? "Customer Charges and Vendor Charges saved with this OVF."
              : "Customer Charges and Vendor Charges — prefilled from the quote; use + Add row for extras."}
          </p>
        </div>

        <div className="space-y-10 px-4 py-5">
          <ChargesTableShell
            title="Customer Charges."
            totalLabel="Total Sale Value"
            totalValue={formatInrPrecise(totalSaleValue)}
            footerLeft={
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
              ) : (
                <span />
              )
            }
          >
            <table className="w-full min-w-[1100px] border-collapse text-left">
              <thead>
                <tr className="bg-[#eef2f6]">
                  <th className={thClass("min-w-[160px]")}>Product Name</th>
                  <th className={thClass("min-w-[88px]")}>Quantity</th>
                  <th className={thClass("min-w-[130px]")}>Unit Product Amt (₹)</th>
                  <th className={thClass("min-w-[110px]")}>Total.</th>
                  <th className={thClass("min-w-[90px]")}>GST ({GST_PCT}%)</th>
                  <th className={thClass("min-w-[120px]")}>Total GST ({GST_PCT}%)</th>
                  <th className={thClass("min-w-[150px]")}>Total Amount with GST</th>
                  <th className={thClass("min-w-[120px]")}>
                    Add PO <span className="text-destructive">*</span>
                  </th>
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
                      <td className={tdClass()}>
                        <ChargesLocalFileUpload
                          fileName={row.add_po}
                          required={!row.serverId}
                          disabled={disabled}
                          onFileSelected={(file) =>
                            updateCustomerRow(row.key, { add_po: file.name, poFile: file })
                          }
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
            footerLeft={
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
              ) : (
                <span />
              )
            }
          >
            <table className="w-full min-w-[1280px] border-collapse text-left">
              <thead>
                <tr className="bg-[#eef2f6]">
                  <th className={thClass("min-w-[88px]")}>Quantity.</th>
                  <th className={thClass("min-w-[130px]")}>Unit Purchase (₹)</th>
                  <th className={thClass("min-w-[110px]")}>Total</th>
                  <th className={thClass("min-w-[90px]")}>GST ({GST_PCT}%)</th>
                  <th className={thClass("min-w-[140px]")}>Total Amount in GST</th>
                  <th className={thClass("min-w-[150px]")}>Total Amount with GST</th>
                  <th className={thClass("min-w-[140px]")}>Vendor Name</th>
                  <th className={thClass("min-w-[130px]")}>Contact Person</th>
                  <th className={thClass("min-w-[130px]")}>Contact Number.</th>
                  <th className={thClass("min-w-[120px]")}>
                    Add Quote <span className="text-destructive">*</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {vendorRows.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-3 py-6 text-center text-[12px] text-muted-foreground">
                      No vendor charge rows. Click + Add row to create one.
                    </td>
                  </tr>
                ) : (
                  vendorRows.map((row) => (
                    <tr key={row.key} className="border-t border-[#e8edf3]">
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
                        <ChargesField
                          readOnly={disabled}
                          value={row.vendor_name}
                          onChange={(v) => updateVendorRow(row.key, { vendor_name: v })}
                        />
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
                      <td className={tdClass()}>
                        <ChargesLocalFileUpload
                          fileName={row.add_quote}
                          required={!row.serverId}
                          disabled={disabled}
                          onFileSelected={(file) =>
                            updateVendorRow(row.key, { add_quote: file.name, quoteFile: file })
                          }
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
  deps: {
    addOvfLine: (
      id: string,
      body: { side?: string; product_name: string; qty?: number; unit_price?: number },
    ) => Promise<OvfLine>;
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
    if (row.fromQuote || !row.product_name.trim()) continue;
    await deps.addOvfLine(ovfId, {
      side: "customer_po",
      product_name: row.product_name.trim(),
      qty: Math.round(Number(row.qty)) || 1,
      unit_price: Number(moneyAsFixed(Number(row.unit_price) || 0)) || 0,
    });
  }

  for (const row of vendorRows) {
    if (row.fromQuote || !row.vendor_name.trim()) continue;
    await deps.addOvfLine(ovfId, {
      side: "vendor",
      product_name: row.vendor_name.trim(),
      qty: Math.round(Number(row.qty)) || 1,
      unit_price: Number(moneyAsFixed(Number(row.unit_price) || 0)) || 0,
    });
  }

  for (const row of customerRows) {
    if (!row.poFile) continue;
    await deps.createAttachment({
      entity_type: "ovf",
      entity_id: ovfId,
      branch_id: branchId,
      company_id: companyId,
      file_name: row.poFile.name,
      category: "customer_po",
      content_base64: await deps.fileToBase64(row.poFile),
      content_type: row.poFile.type || "application/octet-stream",
    });
  }

  for (const row of vendorRows) {
    if (!row.quoteFile) continue;
    await deps.createAttachment({
      entity_type: "ovf",
      entity_id: ovfId,
      branch_id: branchId,
      company_id: companyId,
      file_name: row.quoteFile.name,
      category: "vendor_quote",
      content_base64: await deps.fileToBase64(row.quoteFile),
      content_type: row.quoteFile.type || "application/octet-stream",
    });
  }
}

export async function persistOvfOrderLinesOnUpdate(
  ovfId: string,
  branchId: string,
  companyId: string | null | undefined,
  customerRows: CustomerChargeRow[],
  vendorRows: VendorChargeRow[],
  deps: {
    addOvfLine: (
      id: string,
      body: { side?: string; product_name: string; qty?: number; unit_price?: number },
    ) => Promise<OvfLine>;
    updateOvfLine: (
      lineId: string,
      body: { product_name?: string; qty?: number; unit_price?: number },
    ) => Promise<OvfLine>;
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
    const payload = {
      product_name: row.product_name.trim(),
      qty: Math.round(Number(row.qty)) || 1,
      unit_price: Number(moneyAsFixed(Number(row.unit_price) || 0)) || 0,
    };
    if (row.serverId) {
      await deps.updateOvfLine(row.serverId, payload);
    } else {
      await deps.addOvfLine(ovfId, { side: "customer_po", ...payload });
    }
  }

  for (const row of vendorRows) {
    if (!row.vendor_name.trim()) continue;
    const payload = {
      product_name: row.vendor_name.trim(),
      qty: Math.round(Number(row.qty)) || 1,
      unit_price: Number(moneyAsFixed(Number(row.unit_price) || 0)) || 0,
    };
    if (row.serverId) {
      await deps.updateOvfLine(row.serverId, payload);
    } else {
      await deps.addOvfLine(ovfId, { side: "vendor", ...payload });
    }
  }

  for (const row of customerRows) {
    if (!row.poFile) continue;
    await deps.createAttachment({
      entity_type: "ovf",
      entity_id: ovfId,
      branch_id: branchId,
      company_id: companyId,
      file_name: row.poFile.name,
      category: "customer_po",
      content_base64: await deps.fileToBase64(row.poFile),
      content_type: row.poFile.type || "application/octet-stream",
    });
  }

  for (const row of vendorRows) {
    if (!row.quoteFile) continue;
    await deps.createAttachment({
      entity_type: "ovf",
      entity_id: ovfId,
      branch_id: branchId,
      company_id: companyId,
      file_name: row.quoteFile.name,
      category: "vendor_quote",
      content_base64: await deps.fileToBase64(row.quoteFile),
      content_type: row.quoteFile.type || "application/octet-stream",
    });
  }
}
