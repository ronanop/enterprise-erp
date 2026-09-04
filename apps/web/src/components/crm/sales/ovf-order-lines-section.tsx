"use client";

import type { ReactNode } from "react";
import { useRef } from "react";
import { Plus, X } from "lucide-react";

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

export type ChargeRowFile = {
  attachmentId?: string;
  fileName: string;
  file: File | null;
};

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
  poFiles: ChargeRowFile[];
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
  quoteFiles: ChargeRowFile[];
};

const LINE_FILE_PREFIX = /^\[line:([^\]]+)\]\s*(.*)$/;

export function encodeChargeLineFileName(rowKey: string, fileName: string): string {
  return `[line:${rowKey}] ${fileName}`;
}

export function parseChargeLineFileName(fileName: string): { rowKey: string | null; displayName: string } {
  const match = fileName.match(LINE_FILE_PREFIX);
  if (!match) return { rowKey: null, displayName: fileName };
  return { rowKey: match[1], displayName: match[2]?.trim() || fileName };
}

function chargeRowFileFromAttachment(att: { id: string; file_name: string }): ChargeRowFile {
  const parsed = parseChargeLineFileName(att.file_name);
  return {
    attachmentId: att.id,
    fileName: parsed.displayName,
    file: null,
  };
}

export function mergeCustomerRowsWithPoAttachments(
  rows: CustomerChargeRow[],
  attachments: { id: string; file_name: string }[],
): CustomerChargeRow[] {
  const byKey = new Map<string, ChargeRowFile[]>();
  const legacy: ChargeRowFile[] = [];

  for (const att of attachments) {
    const file = chargeRowFileFromAttachment(att);
    const parsed = parseChargeLineFileName(att.file_name);
    if (parsed.rowKey) {
      const list = byKey.get(parsed.rowKey) ?? [];
      list.push(file);
      byKey.set(parsed.rowKey, list);
    } else {
      legacy.push(file);
    }
  }

  let merged = rows.map((row) => {
    const files =
      byKey.get(row.key) ??
      (row.serverId ? byKey.get(row.serverId) : undefined) ??
      [];
    return { ...row, poFiles: files };
  });

  if (legacy.length > 0) {
    const targetIndex = merged.findIndex((row) => row.product_name.trim());
    const idx = targetIndex >= 0 ? targetIndex : 0;
    if (merged[idx]) {
      merged = merged.map((row, index) =>
        index === idx ? { ...row, poFiles: [...row.poFiles, ...legacy] } : row,
      );
    }
  }

  return merged;
}

export function mergeVendorRowsWithQuoteAttachments(
  rows: VendorChargeRow[],
  attachments: { id: string; file_name: string }[],
): VendorChargeRow[] {
  const byKey = new Map<string, ChargeRowFile[]>();
  const legacy: ChargeRowFile[] = [];

  for (const att of attachments) {
    const file = chargeRowFileFromAttachment(att);
    const parsed = parseChargeLineFileName(att.file_name);
    if (parsed.rowKey) {
      const list = byKey.get(parsed.rowKey) ?? [];
      list.push(file);
      byKey.set(parsed.rowKey, list);
    } else {
      legacy.push(file);
    }
  }

  let merged = rows.map((row) => {
    const files =
      byKey.get(row.key) ??
      (row.serverId ? byKey.get(row.serverId) : undefined) ??
      [];
    return { ...row, quoteFiles: files };
  });

  if (legacy.length > 0) {
    const targetIndex = merged.findIndex(
      (row) => row.product_name.trim() || row.vendor_name.trim(),
    );
    const idx = targetIndex >= 0 ? targetIndex : 0;
    if (merged[idx]) {
      merged = merged.map((row, index) =>
        index === idx ? { ...row, quoteFiles: [...row.quoteFiles, ...legacy] } : row,
      );
    }
  }

  return merged;
}

export function formatChargeRowFileNames(files: ChargeRowFile[] | undefined): string {
  const names = (files ?? []).map((file) => file.fileName.trim()).filter(Boolean);
  return names.length ? names.join(", ") : "—";
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
    poFiles: [],
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
    quoteFiles: [],
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
      poFiles: [],
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
      quoteFiles: [],
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
    poFiles: [],
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
    quoteFiles: [],
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

export function computeOvfMargins(input: {
  customerRows: { total: string }[];
  vendorRows: { total: string }[];
  freight?: number | string | null;
  financeCostPct?: number | string | null;
}) {
  const totalSaleValue = sumLineTotals(input.customerRows);
  const totalPurchaseValue = sumLineTotals(input.vendorRows);
  const freightAmount = Number(input.freight) || 0;
  const financeCostPct = Number(input.financeCostPct) || 0;
  const financeCostAmount = (totalPurchaseValue * financeCostPct) / 100;
  const totalMarginAmount =
    totalSaleValue - totalPurchaseValue - freightAmount - financeCostAmount;
  const totalMarginPct = totalSaleValue ? (totalMarginAmount / totalSaleValue) * 100 : 0;
  return {
    totalSaleValue,
    totalPurchaseValue,
    totalMarginAmount,
    totalMarginPct,
    financeCostAmount,
  };
}

function chargeRowHasFile(files: ChargeRowFile[] | undefined): boolean {
  return (files ?? []).some((file) => file.fileName.trim() || file.file);
}

function chargeTableHasFile<T extends { poFiles?: ChargeRowFile[]; quoteFiles?: ChargeRowFile[] }>(
  rows: T[],
  field: "poFiles" | "quoteFiles",
): boolean {
  return rows.some((row) => chargeRowHasFile(row[field]));
}

export function validateChargeAttachments(
  customerRows: CustomerChargeRow[],
  vendorRows: VendorChargeRow[],
): string | null {
  const hasCustomerProductRows = customerRows.some((row) => row.product_name.trim());
  if (hasCustomerProductRows && !chargeTableHasFile(customerRows, "poFiles")) {
    return "Add PO * is required for Customer Charges (upload at least one file on any product row).";
  }

  const hasVendorProductRows = vendorRows.some(
    (row) => row.product_name.trim() || row.vendor_name.trim(),
  );
  if (hasVendorProductRows && !chargeTableHasFile(vendorRows, "quoteFiles")) {
    return "Add Quote * is required for Vendor Charges (upload at least one file on any product row).";
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
  totalLabel,
  totalValue,
}: {
  title: string;
  children: ReactNode;
  headerRight?: ReactNode;
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
      <div className="flex flex-wrap items-center justify-end gap-3">
        <div className="flex items-center gap-2">
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

function ChargesMultiFileUpload({
  files,
  required,
  disabled,
  addLabel,
  onFilesChange,
}: {
  files: ChargeRowFile[];
  required?: boolean;
  disabled?: boolean;
  addLabel: string;
  onFilesChange?: (files: ChargeRowFile[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const hasFiles = files.some((file) => file.fileName.trim());
  const missing = !disabled && required && !hasFiles;

  function removeAt(index: number) {
    if (disabled || !onFilesChange) return;
    onFilesChange(files.filter((_, fileIndex) => fileIndex !== index));
  }

  function addSelectedFiles(selected: FileList | null) {
    if (disabled || !onFilesChange || !selected?.length) return;
    const next = [
      ...files,
      ...Array.from(selected).map((file) => ({ fileName: file.name, file })),
    ];
    onFilesChange(next);
  }

  if (disabled && !hasFiles) {
    return <span className="text-[12px] text-muted-foreground">—</span>;
  }

  return (
    <div className="min-w-[160px] space-y-1">
      {files.map((item, index) => (
        <div key={`${item.attachmentId ?? item.fileName}-${index}`} className="flex items-center gap-1">
          <span
            className="min-w-0 flex-1 truncate text-[12px] text-foreground"
            title={item.fileName}
          >
            {item.fileName}
          </span>
          {!disabled && onFilesChange ? (
            <button
              type="button"
              aria-label={`Remove ${item.fileName}`}
              onClick={() => removeAt(index)}
              className="inline-flex size-6 shrink-0 cursor-pointer items-center justify-center rounded text-muted-foreground transition-colors duration-200 hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-sky-300"
            >
              <X className="size-3.5" />
            </button>
          ) : null}
        </div>
      ))}
      {!disabled && onFilesChange ? (
        <>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className={cn(
              "flex h-8 w-full cursor-pointer items-center justify-center rounded-[4px] border bg-white px-2 text-[12px] transition-colors duration-200",
              missing ? "border-destructive/60 text-destructive" : "border-[#cfd7e3] text-muted-foreground",
              "hover:border-sky-400 hover:text-foreground focus-visible:border-sky-400 focus-visible:ring-1 focus-visible:ring-sky-300 focus-visible:outline-none",
            )}
          >
            {addLabel}
            {required ? " *" : ""}
          </button>
          <input
            ref={inputRef}
            type="file"
            multiple
            className="sr-only"
            onChange={(event) => {
              addSelectedFiles(event.target.files);
              if (inputRef.current) inputRef.current.value = "";
            }}
          />
        </>
      ) : null}
    </div>
  );
}

type OvfOrderLinesSectionProps = {
  customerRows: CustomerChargeRow[];
  vendorRows: VendorChargeRow[];
  onCustomerRowsChange?: (rows: CustomerChargeRow[]) => void;
  onVendorRowsChange?: (rows: VendorChargeRow[]) => void;
  /** Distributor names selected on the lead — options for Distributor Name. */
  vendorNameOptions?: readonly string[];
  disabled?: boolean;
};

export function OvfOrderLinesSection({
  customerRows,
  vendorRows,
  onCustomerRowsChange,
  onVendorRowsChange,
  vendorNameOptions = [],
  disabled = false,
}: OvfOrderLinesSectionProps) {
  const totalSaleValue = sumLineTotals(customerRows);
  const totalPurchaseValue = sumLineTotals(vendorRows);
  const vendorOptions = Array.from(
    new Set(
      [
        ...vendorNameOptions.map((name) => name.trim()).filter(Boolean),
        ...vendorRows.map((row) => row.vendor_name.trim()).filter(Boolean),
      ].filter(Boolean),
    ),
  );
  function selectedDistributor(value: string): string {
    const trimmed = value.trim();
    if (!trimmed) return "";
    const match = vendorOptions.find((name) => name.toLowerCase() === trimmed.toLowerCase());
    return match ?? "";
  }

  const hasCustomerProductRows = customerRows.some((row) => row.product_name.trim());
  const hasVendorProductRows = vendorRows.some(
    (row) => row.product_name.trim() || row.vendor_name.trim(),
  );
  const customerPoTableMissing =
    !disabled && hasCustomerProductRows && !chargeTableHasFile(customerRows, "poFiles");
  const vendorQuoteTableMissing =
    !disabled && hasVendorProductRows && !chargeTableHasFile(vendorRows, "quoteFiles");

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

  return (
    <section className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm">
      <div className="border-b border-border/70 px-4 py-3">
        <h2 className="text-base font-extrabold tracking-tight">Order Lines</h2>
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
        >
          <table className="w-full min-w-[1240px] border-collapse text-left">
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
                <th className={thClass("min-w-[180px]")}>
                  Add PO <span className="text-destructive">*</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {customerRows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-3 py-6 text-center text-[12px] text-muted-foreground">
                    No customer charge rows. Click + Add row to create one.
                  </td>
                </tr>
              ) : (
                customerRows.map((row) => (
                  <tr key={row.key} className="border-t border-[#e8edf3]">
                    <td className={tdClass()}>
                      <ChargesField
                        readOnly={disabled}
                        value={row.product_name}
                        onChange={(v) => updateCustomerRow(row.key, { product_name: v })}
                      />
                    </td>
                    <td className={tdClass()}>
                      <ChargesField
                        readOnly={disabled}
                        value={row.description}
                        onChange={(v) => updateCustomerRow(row.key, { description: v })}
                      />
                    </td>
                    <td className={tdClass()}>
                      <ChargesField
                        readOnly={disabled}
                        type="number"
                        value={row.qty}
                        className="text-right tabular-nums"
                        onChange={(v) => updateCustomerRow(row.key, { qty: v }, true)}
                      />
                    </td>
                    <td className={tdClass()}>
                      <ChargesField
                        readOnly={disabled}
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
                      <ChargesMultiFileUpload
                        files={row.poFiles}
                        required={customerPoTableMissing && !chargeRowHasFile(row.poFiles)}
                        disabled={disabled}
                        addLabel="Choose files"
                        onFilesChange={
                          disabled || !onCustomerRowsChange
                            ? undefined
                            : (poFiles) => updateCustomerRow(row.key, { poFiles })
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
        >
          <table className="w-full min-w-[1500px] border-collapse text-left">
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
                <th className={thClass("min-w-[180px]")}>
                  Add Quote <span className="text-destructive">*</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {vendorRows.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-3 py-6 text-center text-[12px] text-muted-foreground">
                    No vendor charge rows. Click + Add row to create one.
                  </td>
                </tr>
              ) : (
                vendorRows.map((row) => (
                  <tr key={row.key} className="border-t border-[#e8edf3]">
                    <td className={tdClass()}>
                      <ChargesField
                        readOnly={disabled}
                        value={row.product_name}
                        onChange={(v) => updateVendorRow(row.key, { product_name: v })}
                      />
                    </td>
                    <td className={tdClass()}>
                      <ChargesField
                        readOnly={disabled}
                        value={row.description}
                        onChange={(v) => updateVendorRow(row.key, { description: v })}
                      />
                    </td>
                    <td className={tdClass()}>
                      <ChargesField
                        readOnly={disabled}
                        type="number"
                        value={row.qty}
                        className="text-right tabular-nums"
                        onChange={(v) => updateVendorRow(row.key, { qty: v }, true)}
                      />
                    </td>
                    <td className={tdClass()}>
                      <ChargesField
                        readOnly={disabled}
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
                        <option value="">Select distributor…</option>
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
                    <td className={tdClass()}>
                      <ChargesMultiFileUpload
                        files={row.quoteFiles}
                        required={vendorQuoteTableMissing && !chargeRowHasFile(row.quoteFiles)}
                        disabled={disabled}
                        addLabel="Choose files"
                        onFilesChange={
                          disabled || !onVendorRowsChange
                            ? undefined
                            : (quoteFiles) => updateVendorRow(row.key, { quoteFiles })
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

type AttachmentUploadDeps = {
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
};

async function uploadChargeRowFiles(
  ovfId: string,
  branchId: string,
  companyId: string | null | undefined,
  lineKey: string,
  files: ChargeRowFile[] | undefined,
  category: "customer_po" | "vendor_quote",
  deps: AttachmentUploadDeps,
) {
  if (!files?.length) return;
  for (const item of files) {
    if (!item.file) continue;
    await deps.createAttachment({
      entity_type: "ovf",
      entity_id: ovfId,
      branch_id: branchId,
      company_id: companyId,
      file_name: encodeChargeLineFileName(lineKey, item.file.name),
      category,
      content_base64: await deps.fileToBase64(item.file),
      content_type: item.file.type || "application/octet-stream",
    });
  }
}

export async function persistOvfOrderLinesAfterCreate(
  ovfId: string,
  branchId: string,
  companyId: string | null | undefined,
  customerRows: CustomerChargeRow[],
  vendorRows: VendorChargeRow[],
  deps: {
    listOvfLines: (id: string) => Promise<OvfLine[]>;
    addOvfLine: (id: string, body: OvfLineFormInput) => Promise<OvfLine>;
    updateOvfLine: (lineId: string, body: OvfLineFormInput) => Promise<OvfLine>;
    createAttachment: AttachmentUploadDeps["createAttachment"];
    fileToBase64: AttachmentUploadDeps["fileToBase64"];
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

  const savedLines = await deps.listOvfLines(ovfId);
  let customerLinePool = savedLines
    .filter((line) => line.side === "customer_po")
    .sort((a, b) => Number(a.line_no) - Number(b.line_no));
  let vendorLinePool = savedLines
    .filter((line) => line.side === "vendor")
    .sort((a, b) => Number(a.line_no) - Number(b.line_no));

  for (const row of customerRows) {
    if (!row.product_name.trim()) continue;
    const match = takeMatchingLine(customerLinePool, row);
    const lineKey = match?.id ?? row.serverId ?? row.key;
    await uploadChargeRowFiles(
      ovfId,
      branchId,
      companyId,
      lineKey,
      row.poFiles,
      "customer_po",
      deps,
    );
  }

  for (const row of vendorRows) {
    if (!row.product_name.trim() && !row.vendor_name.trim()) continue;
    const match = takeMatchingLine(vendorLinePool, {
      serverId: row.serverId,
      product_name: row.product_name,
      vendor_name: row.vendor_name,
    });
    const lineKey = match?.id ?? row.serverId ?? row.key;
    await uploadChargeRowFiles(
      ovfId,
      branchId,
      companyId,
      lineKey,
      row.quoteFiles,
      "vendor_quote",
      deps,
    );
  }
}

export async function persistOvfOrderLinesOnUpdate(
  ovfId: string,
  branchId: string,
  companyId: string | null | undefined,
  customerRows: CustomerChargeRow[],
  vendorRows: VendorChargeRow[],
  deps: {
    addOvfLine: (id: string, body: OvfLineFormInput) => Promise<OvfLine>;
    updateOvfLine: (lineId: string, body: OvfLineFormInput) => Promise<OvfLine>;
    createAttachment: AttachmentUploadDeps["createAttachment"];
    fileToBase64: AttachmentUploadDeps["fileToBase64"];
  },
) {
  const customerLineKeys = new Map<string, string>();
  for (const row of customerRows) {
    if (!row.product_name.trim()) continue;
    const payload = customerLinePayload(row);
    if (row.serverId) {
      await deps.updateOvfLine(row.serverId, payload);
      customerLineKeys.set(row.key, row.serverId);
    } else {
      const created = await deps.addOvfLine(ovfId, { side: "customer_po", ...payload });
      customerLineKeys.set(row.key, created.id);
    }
  }

  const vendorLineKeys = new Map<string, string>();
  for (const row of vendorRows) {
    if (!row.product_name.trim() && !row.vendor_name.trim()) continue;
    const payload = vendorLinePayload(row);
    if (row.serverId) {
      await deps.updateOvfLine(row.serverId, payload);
      vendorLineKeys.set(row.key, row.serverId);
    } else {
      const created = await deps.addOvfLine(ovfId, { side: "vendor", ...payload });
      vendorLineKeys.set(row.key, created.id);
    }
  }

  for (const row of customerRows) {
    if (!row.product_name.trim()) continue;
    const lineKey = customerLineKeys.get(row.key) ?? row.serverId ?? row.key;
    await uploadChargeRowFiles(
      ovfId,
      branchId,
      companyId,
      lineKey,
      row.poFiles,
      "customer_po",
      deps,
    );
  }

  for (const row of vendorRows) {
    if (!row.product_name.trim() && !row.vendor_name.trim()) continue;
    const lineKey = vendorLineKeys.get(row.key) ?? row.serverId ?? row.key;
    await uploadChargeRowFiles(
      ovfId,
      branchId,
      companyId,
      lineKey,
      row.quoteFiles,
      "vendor_quote",
      deps,
    );
  }
}
