"use client";

import type { ReactNode } from "react";
import { useRef, useState } from "react";
import { Plus, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LeadDistributorMultiSelect } from "@/components/crm/sales/lead-distributor-multi-select";
import {
  formatLeadDistributorNames,
  parseLeadDistributorNames,
} from "@/lib/crm/lead-distributor-options";
import { cn } from "@/lib/utils";
import {
  formatInrPrecise,
  openAttachmentInNewTab,
  type OvfLine,
  type OvfLineFormInput,
  type QuoteLine,
} from "@/services/sales-crm-service";

export const GST_PCT = 18;

export type ChargeRowFile = {
  attachmentId?: string;
  fileName: string;
  file: File | null;
  /** When set, save copies this existing CRM file onto the OVF (no re-upload). */
  sourceFilePath?: string | null;
  sourceContentType?: string | null;
  copyOnSave?: boolean;
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
  /** Split-quote number when this vendor row came from a child quote. */
  quote_no: string;
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

/** Persist split-quote provenance on vendor OVF lines without a schema column. */
const VENDOR_QUOTE_NO_PREFIX = /^\[quote:([^\]]+)\]\s*/;
/** Ops-provided supporting items (outside the main PO) — tagged without a schema column. */
const SUPPORTING_ITEM_PREFIX = /^\[supporting\]\s*/;
/** Service-visit costs (outside Vendor PO) — tagged without a schema column. */
const SERVICE_ITEM_PREFIX = /^\[service\]\s*/;

export function isSupportingOvfLine(line: { description?: string | null }): boolean {
  return SUPPORTING_ITEM_PREFIX.test(line.description ?? "");
}

export function isServiceOvfLine(line: {
  description?: string | null;
  product_name?: string | null;
}): boolean {
  if (SERVICE_ITEM_PREFIX.test(line.description ?? "")) return true;
  const name = (line.product_name ?? "").trim().toLowerCase();
  if (name.includes(" visits - ")) return true;
  if (name.startsWith("service consumables")) return true;
  return false;
}

export function isAdditionalChargeOvfLine(line: {
  description?: string | null;
  product_name?: string | null;
}): boolean {
  return isSupportingOvfLine(line) || isServiceOvfLine(line);
}

export function stripSupportingMarker(description: string | null | undefined): string {
  return (description ?? "").replace(SUPPORTING_ITEM_PREFIX, "").trim();
}

export function stripServiceMarker(description: string | null | undefined): string {
  return (description ?? "").replace(SERVICE_ITEM_PREFIX, "").trim();
}

export function encodeVendorQuoteNo(quoteNo: string, description: string): string | null {
  const clean = description.replace(VENDOR_QUOTE_NO_PREFIX, "").trim();
  const tag = quoteNo.trim();
  if (!tag) return clean || null;
  return clean ? `[quote:${tag}] ${clean}` : `[quote:${tag}]`;
}

export function parseVendorQuoteNo(description: string | null | undefined): {
  quote_no: string;
  description: string;
} {
  const raw = description ?? "";
  const match = raw.match(VENDOR_QUOTE_NO_PREFIX);
  if (!match) return { quote_no: "", description: raw.trim() };
  return { quote_no: match[1]?.trim() ?? "", description: raw.replace(VENDOR_QUOTE_NO_PREFIX, "").trim() };
}

/** Sentinel while "Others" is selected but the free-text name is still empty. */
export const DISTRIBUTOR_OTHERS_PENDING = "__others_pending__";

export function normalizeDistributorName(value: string | null | undefined): string {
  const trimmed = (value ?? "").trim();
  if (!trimmed || trimmed === DISTRIBUTOR_OTHERS_PENDING) return "";
  return trimmed;
}

const LINE_FILE_PREFIX = /^\[line:([^\]]+)\]\s*(.*)$/;

export function encodeChargeLineFileName(rowKey: string, fileName: string): string {
  return `[line:${rowKey}] ${fileName}`;
}

export function parseChargeLineFileName(fileName: string): { rowKey: string | null; displayName: string } {
  const match = fileName.match(LINE_FILE_PREFIX);
  if (!match) return { rowKey: null, displayName: fileName };
  return { rowKey: match[1], displayName: match[2]?.trim() || fileName };
}

function chargeRowFileFromAttachment(
  att: { id: string; file_name: string; file_path?: string | null; content_type?: string | null },
  options?: { copyOnSave?: boolean },
): ChargeRowFile {
  const copyOnSave = Boolean(options?.copyOnSave);
  const parsed = parseChargeLineFileName(att.file_name);
  return {
    // Keep id so the file can be opened; copyOnSave still clones onto the OVF on save.
    attachmentId: att.id,
    fileName: parsed.displayName,
    file: null,
    sourceFilePath: att.file_path ?? null,
    sourceContentType: att.content_type ?? null,
    copyOnSave,
  };
}

function dedupeChargeRowFiles(files: ChargeRowFile[]): ChargeRowFile[] {
  const seen = new Set<string>();
  const out: ChargeRowFile[] = [];
  for (const file of files) {
    const key = (file.fileName || "").trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(file);
  }
  return out;
}

/** Keep one attachment per file name (newest first when caller sorts desc). */
export function dedupeAttachmentsByFileName<T extends { file_name: string }>(rows: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const row of rows) {
    const key = (row.file_name || "").trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

export function mergeCustomerRowsWithPoAttachments(
  rows: CustomerChargeRow[],
  attachments: { id: string; file_name: string; file_path?: string | null; content_type?: string | null }[],
  options?: { copyOnSave?: boolean },
): CustomerChargeRow[] {
  const copyOnSave = Boolean(options?.copyOnSave);
  const byKey = new Map<string, ChargeRowFile[]>();
  const legacy: ChargeRowFile[] = [];

  for (const att of dedupeAttachmentsByFileName(attachments)) {
    const file = chargeRowFileFromAttachment(att, { copyOnSave });
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
    return { ...row, poFiles: dedupeChargeRowFiles(files) };
  });

  if (legacy.length > 0) {
    const uniqueLegacy = dedupeChargeRowFiles(legacy);
    const targetIndex = merged.findIndex((row) => row.product_name.trim());
    const idx = targetIndex >= 0 ? targetIndex : 0;
    if (merged[idx]) {
      merged = merged.map((row, index) =>
        index === idx
          ? { ...row, poFiles: dedupeChargeRowFiles([...row.poFiles, ...uniqueLegacy]) }
          : row,
      );
    }
  }

  return merged;
}

export function mergeVendorRowsWithQuoteAttachments(
  rows: VendorChargeRow[],
  attachments: { id: string; file_name: string; file_path?: string | null; content_type?: string | null }[],
  options?: { copyOnSave?: boolean },
): VendorChargeRow[] {
  const copyOnSave = Boolean(options?.copyOnSave);
  const byKey = new Map<string, ChargeRowFile[]>();
  const legacy: ChargeRowFile[] = [];

  for (const att of attachments) {
    const file = chargeRowFileFromAttachment(att, { copyOnSave });
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
  return names.length ? names.join(", ") : "-";
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
    quote_no: "",
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

export function vendorRowsFromQuoteLines(
  quoteLines: QuoteLine[],
  quoteNo?: string,
): VendorChargeRow[] {
  return quoteLines.map((quoteLine) => vendorFromQuote(quoteLine, undefined, quoteNo));
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
    .filter((line) => line.side === "vendor" && !isAdditionalChargeOvfLine(line))
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
    const parsed = parseVendorQuoteNo(line.description);
    const quoteDesc = quoteLine?.description
      ? parseVendorQuoteNo(quoteLine.description).description
      : "";
    return {
      key: line.id,
      serverId: line.id,
      fromQuote: false,
      quote_no: parsed.quote_no,
      product_name: productName,
      description: storedOrQuoteText(parsed.description, quoteDesc),
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

export type SupportingItemRow = {
  id: string;
  product_name: string;
  description: string;
  distributor_name: string;
  qty: string;
  unit_price: string;
  total: string;
};

export function supportingRowsFromOvfLines(lines: OvfLine[]): SupportingItemRow[] {
  return [...lines]
    .filter((line) => line.side === "vendor" && isSupportingOvfLine(line))
    .sort((a, b) => Number(a.line_no) - Number(b.line_no) || a.product_name.localeCompare(b.product_name))
    .map((line) => {
      const qty = qtyAsInt(line.qty);
      const unitPrice = moneyAsFixed(line.unit_price ?? 0);
      const storedTotal = moneyAsFixed(line.line_total);
      const total =
        storedTotal !== ""
          ? storedTotal
          : moneyAsFixed((Number(qty) || 0) * (Number(unitPrice) || 0));
      return {
        id: line.id,
        product_name: (line.product_name ?? "").trim(),
        description: stripSupportingMarker(line.description),
        distributor_name: (line.distributor_name ?? "").trim(),
        qty,
        unit_price: unitPrice,
        total,
      };
    });
}

export type ServiceChargeRow = {
  id: string;
  product_name: string;
  description: string;
  distributor_name: string;
  qty: string;
  unit_price: string;
  total: string;
};

export function serviceRowsFromOvfLines(lines: OvfLine[]): ServiceChargeRow[] {
  return [...lines]
    .filter((line) => line.side === "vendor" && isServiceOvfLine(line))
    .sort((a, b) => Number(a.line_no) - Number(b.line_no) || a.product_name.localeCompare(b.product_name))
    .map((line) => {
      const qty = qtyAsInt(line.qty);
      const unitPrice = moneyAsFixed(line.unit_price ?? 0);
      const storedTotal = moneyAsFixed(line.line_total);
      const total =
        storedTotal !== ""
          ? storedTotal
          : moneyAsFixed((Number(qty) || 0) * (Number(unitPrice) || 0));
      return {
        id: line.id,
        product_name: (line.product_name ?? "").trim(),
        description: stripServiceMarker(line.description),
        distributor_name: (line.distributor_name ?? "").trim(),
        qty,
        unit_price: unitPrice,
        total,
      };
    });
}

export type AdditionalChargeVertical = {
  key: string;
  label: string;
  amount: number;
};

/** One row per additional-charge vertical for the PO summaries area. */
export function buildAdditionalChargeVerticals(input: {
  supportingTotal: number;
  serviceVisitsTotal: number;
  /** Stored OVF additional_charges; used only when no vertical lines exist. */
  recordedAdditional?: number | null;
}): AdditionalChargeVertical[] {
  const supporting = Number(input.supportingTotal) || 0;
  const service = Number(input.serviceVisitsTotal) || 0;
  const recorded = Number(input.recordedAdditional) || 0;
  const rows: AdditionalChargeVertical[] = [];
  if (supporting > 0) {
    rows.push({ key: "supporting", label: "Supporting items", amount: supporting });
  }
  if (service > 0) {
    rows.push({ key: "service_visits", label: "Service visits", amount: service });
  }
  const verticalSum = supporting + service;
  if (verticalSum <= 0 && recorded > 0) {
    rows.push({ key: "other", label: "Other additional charges", amount: recorded });
  } else if (recorded > verticalSum + 0.0001) {
    rows.push({
      key: "other",
      label: "Other additional charges",
      amount: recorded - verticalSum,
    });
  }
  return rows;
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

export function vendorFromQuote(
  quoteLine: QuoteLine,
  ovfLine?: OvfLine,
  quoteNo?: string,
): VendorChargeRow {
  const qty = qtyAsInt(ovfLine?.qty ?? quoteLine.qty);
  const unitPrice = moneyAsFixed(ovfLine?.unit_price ?? quoteLine.unit_cost ?? 0);
  const gstPct = String(quoteLine.gst_pct || GST_PCT);
  const money = moneyFromQtyPrice(qty, unitPrice, gstPct);
  const parsedStored = parseVendorQuoteNo(ovfLine?.description);
  const parsedQuote = parseVendorQuoteNo(quoteLine.description);
  return {
    key: ovfLine?.id ?? `quote-vendor-${quoteLine.id}`,
    serverId: ovfLine?.id,
    fromQuote: true,
    quote_no: (quoteNo ?? parsedStored.quote_no).trim(),
    product_name: storedOrQuoteText(ovfLine?.product_name, quoteLine.product_name),
    description: storedOrQuoteText(parsedStored.description, parsedQuote.description),
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
  const distributor = normalizeDistributorName(row.vendor_name);
  return {
    product_name: row.product_name.trim() || distributor,
    description: encodeVendorQuoteNo(row.quote_no, row.description),
    distributor_name: distributor || null,
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

export function validateChargeAttachments(
  _customerRows: CustomerChargeRow[],
  _vendorRows: VendorChargeRow[],
): string | null {
  // Customer PO / vendor quote files are carried from the opportunity / quote
  // (view-only on the OVF form). Distributor Name is optional.
  return null;
}

function fieldWidthCh(value: string, type?: string): number {
  const raw = value.trim().length;
  if (type === "number") {
    return Math.min(Math.max(raw + 2, 5), 16);
  }
  return Math.min(Math.max(raw + 2, 6), 42);
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
  const widthCh = fieldWidthCh(value || placeholder || "", type);
  return (
    <Input
      type={type}
      readOnly={readOnly}
      tabIndex={readOnly ? -1 : undefined}
      placeholder={placeholder}
      value={value}
      onChange={onChange ? (e) => onChange(e.target.value) : undefined}
      style={{ width: `${widthCh}ch` }}
      className={cn(
        "h-9 max-w-[28rem] min-w-0 rounded-[4px] border-[#cfd7e3] bg-white px-2.5 text-[13px] shadow-none transition-[width,colors] duration-200",
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
  totalAwaiting,
}: {
  title: string;
  children: ReactNode;
  headerRight?: ReactNode;
  totalLabel: string;
  totalValue: string;
  /** Replace the ₹ total with a waiting status (e.g. awaiting SCM price). */
  totalAwaiting?: string | null;
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
          {totalAwaiting ? (
            <span className="inline-flex h-9 min-w-48 items-center justify-end rounded-[4px] border border-amber-200 bg-amber-50 px-3 text-right text-[12px] font-medium text-amber-800">
              {totalAwaiting}
            </span>
          ) : (
            <Input
              readOnly
              tabIndex={-1}
              value={totalValue}
              className="h-9 w-48 cursor-default rounded-[4px] border-[#cfd7e3] bg-[#f8fafc] text-right text-[13px] tabular-nums shadow-none"
            />
          )}
        </div>
      </div>
    </div>
  );
}

function thClass(extra = "") {
  return cn(
    "whitespace-nowrap px-2 py-2.5 text-left text-[12px] font-medium text-[#475569]",
    extra,
  );
}

function tdClass(extra = "") {
  return cn("w-auto whitespace-nowrap px-2 py-2 align-middle", extra);
}

function ChargesMultiFileUpload({
  files,
  required,
  disabled,
  addLabel,
  allowUpload = true,
  onFilesChange,
}: {
  files: ChargeRowFile[];
  required?: boolean;
  disabled?: boolean;
  addLabel: string;
  /** When false, only list existing files (no Choose files / remove). */
  allowUpload?: boolean;
  onFilesChange?: (files: ChargeRowFile[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [openingKey, setOpeningKey] = useState<string | null>(null);
  const hasFiles = files.some((file) => file.fileName.trim());
  const canUpload = allowUpload && !disabled && Boolean(onFilesChange);
  const missing = canUpload && required && !hasFiles;

  function removeAt(index: number) {
    if (!canUpload || !onFilesChange) return;
    onFilesChange(files.filter((_, fileIndex) => fileIndex !== index));
  }

  function addSelectedFiles(selected: FileList | null) {
    if (!canUpload || !onFilesChange || !selected?.length) return;
    const next = [
      ...files,
      ...Array.from(selected).map((file) => ({ fileName: file.name, file })),
    ];
    onFilesChange(next);
  }

  async function openFile(item: ChargeRowFile, index: number) {
    const key = `${item.attachmentId ?? item.fileName}-${index}`;
    setOpeningKey(key);
    try {
      if (item.attachmentId) {
        await openAttachmentInNewTab(item.attachmentId);
        return;
      }
      const remote = (item.sourceFilePath ?? "").trim();
      if (/^https?:\/\//i.test(remote)) {
        window.open(remote, "_blank", "noopener,noreferrer");
        return;
      }
      if (item.file) {
        const url = URL.createObjectURL(item.file);
        window.open(url, "_blank", "noopener,noreferrer");
        window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      }
    } catch {
      window.alert(`Could not open ${item.fileName || "file"}.`);
    } finally {
      setOpeningKey(null);
    }
  }

  if (!hasFiles && !canUpload) {
    return <span className="text-[12px] text-muted-foreground">-</span>;
  }

  return (
    <div className={cn("space-y-1", canUpload && "min-w-[140px]")}>
      {files.map((item, index) => {
        const key = `${item.attachmentId ?? item.fileName}-${index}`;
        const openable = Boolean(
          item.attachmentId ||
          item.file ||
          /^https?:\/\//i.test((item.sourceFilePath ?? "").trim()),
        );
        return (
          <div key={key} className="flex items-center gap-1">
            {openable ? (
              <button
                type="button"
                title={`Open ${item.fileName}`}
                disabled={openingKey === key}
                onClick={() => void openFile(item, index)}
                className="max-w-[20rem] cursor-pointer truncate text-left text-[12px] font-medium text-sky-700 underline-offset-2 transition-colors duration-200 hover:text-sky-900 hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-sky-300 disabled:cursor-wait disabled:opacity-70 dark:text-sky-300 dark:hover:text-sky-200"
              >
                {item.fileName}
              </button>
            ) : (
              <span className="max-w-[20rem] truncate text-[12px] text-foreground" title={item.fileName}>
                {item.fileName}
              </span>
            )}
            {canUpload ? (
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
        );
      })}
      {canUpload ? (
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
  /** Distributor names selected on the lead - options for Distributor Name. */
  vendorNameOptions?: readonly string[];
  /** Ops-provided supporting items (outside the main PO) — shown after Vendor PO. */
  supportingRows?: SupportingItemRow[];
  supportingDescription?: string;
  /** Header action for the supporting-items block (e.g. Ask Operations). */
  supportingHeaderRight?: ReactNode;
  /** When true, total shows “Awaiting price from SCM” instead of ₹0.00. */
  supportingAwaitingScmPrices?: boolean;
  /** Additional charge verticals (supporting, service visits, other). */
  additionalChargeRows?: AdditionalChargeVertical[];
  /** Fully lock the section (detail view / while saving). */
  disabled?: boolean;
  /**
   * Lock product / qty / price fields and hide add/remove.
   * Distributor Name and file uploads stay editable unless `disabled` is also set.
   */
  readOnlyLines?: boolean;
};

export function OvfOrderLinesSection({
  customerRows,
  vendorRows,
  onCustomerRowsChange,
  onVendorRowsChange,
  vendorNameOptions = [],
  supportingRows,
  supportingDescription,
  supportingHeaderRight,
  supportingAwaitingScmPrices = false,
  additionalChargeRows,
  disabled = false,
  readOnlyLines = false,
}: OvfOrderLinesSectionProps) {
  const linesLocked = disabled || readOnlyLines;
  /** Distributor can still be set while quote-derived line amounts stay locked. */
  const distributorLocked = disabled || !onVendorRowsChange;
  const totalSaleValue = sumLineTotals(customerRows);
  const totalPurchaseValue = sumLineTotals(vendorRows);
  // Options come from Procurement → Vendors (via vendorNameOptions); keep row values for edits.
  const vendorOptions = Array.from(
    new Set(
      [
        "IN STOCK",
        ...vendorNameOptions.map((name) => name.trim()).filter(Boolean),
        ...vendorRows.flatMap((row) => parseLeadDistributorNames(row.vendor_name)),
      ]
        .map((name) => name.trim())
        .filter((name) => name && name.toLowerCase() !== "others"),
    ),
  );

  function updateCustomerRow(key: string, patch: Partial<CustomerChargeRow>, recalc = false) {
    if (!onCustomerRowsChange || disabled) return;
    const fileOnly = Object.keys(patch).length === 1 && "poFiles" in patch;
    if (linesLocked && !fileOnly) return;
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
    if (!onVendorRowsChange || disabled) return;
    const keys = Object.keys(patch);
    const fileOnly = keys.length === 1 && "quoteFiles" in patch;
    const distributorOnly =
      keys.length > 0 &&
      keys.every((k) => k === "vendor_name" || k === "contact_person" || k === "contact_number");
    if (linesLocked && !fileOnly && !distributorOnly) return;
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
    if (linesLocked || !onCustomerRowsChange) return;
    onCustomerRowsChange([...customerRows, emptyCustomerRow()]);
  }

  function onRemoveCustomerRow(key: string) {
    if (linesLocked || !onCustomerRowsChange) return;
    onCustomerRowsChange(customerRows.filter((row) => row.key !== key));
  }

  function onAddVendorRow() {
    if (linesLocked || !onVendorRowsChange) return;
    onVendorRowsChange([...vendorRows, emptyVendorRow()]);
  }

  return (
    <section className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm">
      <div className="border-b border-border/70 px-4 py-3">
        <h2 className="text-base font-extrabold tracking-tight">Order Lines</h2>
      </div>

      <div className="space-y-10 px-4 py-5">
        <ChargesTableShell
          title="Customer PO Summary"
          totalLabel="Total Sale Value"
          totalValue={formatInrPrecise(totalSaleValue)}
          headerRight={
            !linesLocked ? (
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
          <table className="w-max max-w-none border-collapse text-left">
            <thead>
              <tr className="bg-[#eef2f6]">
                <th className={thClass()}>Product Name</th>
                <th className={thClass()}>Description</th>
                <th className={thClass()}>Quantity</th>
                <th className={thClass()}>Unit Product Amt (₹)</th>
                <th className={thClass()}>Total.</th>
                <th className={thClass()}>GST ({GST_PCT}%)</th>
                <th className={thClass()}>Total GST ({GST_PCT}%)</th>
                <th className={thClass()}>Total Amount with GST</th>
                <th className={thClass()}>PO file</th>
                {!linesLocked ? <th className={thClass("w-10")} aria-label="Remove row" /> : null}
              </tr>
            </thead>
            <tbody>
              {customerRows.length === 0 ? (
                <tr>
                  <td colSpan={linesLocked ? 9 : 10} className="px-3 py-6 text-center text-[12px] text-muted-foreground">
                    {linesLocked
                      ? "No customer charge rows."
                      : "No customer charge rows. Click + Add row to create one."}
                  </td>
                </tr>
              ) : (
                customerRows.map((row) => (
                  <tr key={row.key} className="border-t border-[#e8edf3]">
                    <td className={tdClass()}>
                      <ChargesField
                        readOnly={linesLocked}
                        value={row.product_name}
                        onChange={(v) => updateCustomerRow(row.key, { product_name: v })}
                      />
                    </td>
                    <td className={tdClass()}>
                      <ChargesField
                        readOnly={linesLocked}
                        value={row.description}
                        onChange={(v) => updateCustomerRow(row.key, { description: v })}
                      />
                    </td>
                    <td className={tdClass()}>
                      <ChargesField
                        readOnly={linesLocked}
                        type="number"
                        value={row.qty}
                        className="text-right tabular-nums"
                        onChange={(v) => updateCustomerRow(row.key, { qty: v }, true)}
                      />
                    </td>
                    <td className={tdClass()}>
                      <ChargesField
                        readOnly={linesLocked}
                        type="number"
                        value={row.unit_price}
                        className="text-right tabular-nums"
                        onChange={(v) => updateCustomerRow(row.key, { unit_price: v }, true)}
                      />
                    </td>
                    <td className={tdClass()}>
                      <ChargesField
                        readOnly={linesLocked}
                        type="number"
                        value={row.total}
                        className="text-right tabular-nums"
                        onChange={(v) => updateCustomerRow(row.key, { total: v })}
                      />
                    </td>
                    <td className={tdClass()}>
                      <ChargesField
                        readOnly={linesLocked}
                        type="number"
                        value={row.gst_pct}
                        className="text-right tabular-nums"
                        onChange={(v) => updateCustomerRow(row.key, { gst_pct: v }, true)}
                      />
                    </td>
                    <td className={tdClass()}>
                      <ChargesField
                        readOnly={linesLocked}
                        type="number"
                        value={row.total_gst}
                        className="text-right tabular-nums"
                        onChange={(v) => updateCustomerRow(row.key, { total_gst: v })}
                      />
                    </td>
                    <td className={tdClass()}>
                      <ChargesField
                        readOnly={linesLocked}
                        type="number"
                        value={row.total_with_gst}
                        className="text-right tabular-nums"
                        onChange={(v) => updateCustomerRow(row.key, { total_with_gst: v })}
                      />
                    </td>
                    <td className={tdClass()}>
                      <ChargesMultiFileUpload
                        files={row.poFiles}
                        disabled={disabled}
                        allowUpload={false}
                        addLabel="Choose files"
                      />
                    </td>
                    {!linesLocked ? (
                      <td className={tdClass("text-center")}>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="size-7 cursor-pointer text-destructive hover:bg-destructive/10 hover:text-destructive"
                          aria-label="Delete row"
                          onClick={() => onRemoveCustomerRow(row.key)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </td>
                    ) : null}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </ChargesTableShell>

        <ChargesTableShell
          title="Vendor PO Summary"
          totalLabel="Total Purchase Value"
          totalValue={formatInrPrecise(totalPurchaseValue)}
          headerRight={
            !linesLocked ? (
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
          <table className="w-max max-w-none border-collapse text-left">
            <thead>
              <tr className="bg-[#eef2f6]">
                <th className={thClass()}>Quote No</th>
                <th className={thClass()}>Product Name</th>
                <th className={thClass()}>Description</th>
                <th className={thClass()}>Quantity.</th>
                <th className={thClass()}>Unit Purchase (₹)</th>
                <th className={thClass()}>Total</th>
                <th className={thClass()}>GST ({GST_PCT}%)</th>
                <th className={thClass()}>Total Amount in GST</th>
                <th className={thClass()}>Total Amount with GST</th>
                <th className={thClass()}>Distributor Name</th>
                <th className={thClass()}>Contact Person</th>
                <th className={thClass()}>Contact Number.</th>
                <th className={thClass()}>Quote file</th>
              </tr>
            </thead>
            <tbody>
              {vendorRows.length === 0 ? (
                <tr>
                  <td colSpan={13} className="px-3 py-6 text-center text-[12px] text-muted-foreground">
                    {linesLocked
                      ? "No vendor charge rows."
                      : "No vendor charge rows. Click + Add row to create one."}
                  </td>
                </tr>
              ) : (
                vendorRows.map((row) => (
                  <tr key={row.key} className="border-t border-[#e8edf3]">
                    <td className={tdClass()}>
                      <ChargesField
                        readOnly
                        value={row.quote_no}
                        aria-label="Quote number"
                      />
                    </td>
                    <td className={tdClass()}>
                      <ChargesField
                        readOnly={linesLocked}
                        value={row.product_name}
                        onChange={(v) => updateVendorRow(row.key, { product_name: v })}
                      />
                    </td>
                    <td className={tdClass()}>
                      <ChargesField
                        readOnly={linesLocked}
                        value={row.description}
                        onChange={(v) => updateVendorRow(row.key, { description: v })}
                      />
                    </td>
                    <td className={tdClass()}>
                      <ChargesField
                        readOnly={linesLocked}
                        type="number"
                        value={row.qty}
                        className="text-right tabular-nums"
                        onChange={(v) => updateVendorRow(row.key, { qty: v }, true)}
                      />
                    </td>
                    <td className={tdClass()}>
                      <ChargesField
                        readOnly={linesLocked}
                        type="number"
                        value={row.unit_price}
                        className="text-right tabular-nums"
                        onChange={(v) => updateVendorRow(row.key, { unit_price: v }, true)}
                      />
                    </td>
                    <td className={tdClass()}>
                      <ChargesField
                        readOnly={linesLocked}
                        type="number"
                        value={row.total}
                        className="text-right tabular-nums"
                        onChange={(v) => updateVendorRow(row.key, { total: v })}
                      />
                    </td>
                    <td className={tdClass()}>
                      <ChargesField
                        readOnly={linesLocked}
                        type="number"
                        value={row.gst_pct}
                        className="text-right tabular-nums"
                        onChange={(v) => updateVendorRow(row.key, { gst_pct: v }, true)}
                      />
                    </td>
                    <td className={tdClass()}>
                      <ChargesField
                        readOnly={linesLocked}
                        type="number"
                        value={row.total_gst}
                        className="text-right tabular-nums"
                        onChange={(v) => updateVendorRow(row.key, { total_gst: v })}
                      />
                    </td>
                    <td className={tdClass()}>
                      <ChargesField
                        readOnly={linesLocked}
                        type="number"
                        value={row.total_with_gst}
                        className="text-right tabular-nums"
                        onChange={(v) => updateVendorRow(row.key, { total_with_gst: v })}
                      />
                    </td>
                    <td className={tdClass()}>
                      <div className="w-auto min-w-[10rem]">
                        <LeadDistributorMultiSelect
                          compact
                          disabled={distributorLocked}
                          options={vendorOptions}
                          aria-label="Distributor name"
                          value={parseLeadDistributorNames(
                            row.vendor_name === DISTRIBUTOR_OTHERS_PENDING ? "" : row.vendor_name,
                          )}
                          onChange={(names) =>
                            updateVendorRow(row.key, {
                              vendor_name: formatLeadDistributorNames(names),
                            })
                          }
                        />
                      </div>
                    </td>
                    <td className={tdClass()}>
                      <ChargesField
                        readOnly={linesLocked}
                        value={row.contact_person}
                        onChange={(v) => updateVendorRow(row.key, { contact_person: v })}
                      />
                    </td>
                    <td className={tdClass()}>
                      <ChargesField
                        readOnly={linesLocked}
                        value={row.contact_number}
                        onChange={(v) => updateVendorRow(row.key, { contact_number: v })}
                      />
                    </td>
                    <td className={tdClass()}>
                      <ChargesMultiFileUpload
                        files={row.quoteFiles}
                        disabled={disabled}
                        allowUpload={false}
                        addLabel="Choose files"
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </ChargesTableShell>

        {supportingRows !== undefined ? (
          <ChargesTableShell
            title="Supporting items (outside the main PO)"
            headerRight={supportingHeaderRight}
            totalAwaiting={
              supportingAwaitingScmPrices ? "Awaiting price from SCM" : null
            }
            totalLabel="Supporting items total"
            totalValue={formatInrPrecise(sumLineTotals(supportingRows))}
          >
            <table className="w-full min-w-[560px] border-collapse text-left">
              <thead>
                <tr className="bg-[#eef2f6]">
                  <th className={thClass("w-[34%]")}>Item</th>
                  <th className={thClass("w-[24%]")}>Distributor</th>
                  <th className={thClass("w-[10%]")}>Qty</th>
                  <th className={thClass("w-[16%] text-right")}>Unit purchase (₹)</th>
                  <th className={thClass("w-[16%] text-right")}>Total (₹)</th>
                </tr>
              </thead>
              <tbody>
                {supportingRows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-[13px] text-muted-foreground">
                      No supporting items yet.
                    </td>
                  </tr>
                ) : (
                  supportingRows.map((row) => (
                    <tr key={row.id} className="border-t border-[#e2e8f0]">
                      <td className={tdClass()}>{row.product_name || "—"}</td>
                      <td className={tdClass()}>{row.distributor_name || "—"}</td>
                      <td className={tdClass("tabular-nums")}>{row.qty || "—"}</td>
                      <td className={tdClass("text-right tabular-nums")}>
                        {formatInrPrecise(Number(row.unit_price) || 0)}
                      </td>
                      <td className={tdClass("text-right tabular-nums")}>
                        {formatInrPrecise(Number(row.total) || 0)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            {supportingDescription?.trim() ? (
              <div className="border-t border-[#e2e8f0] px-3 py-3">
                <p className="mb-1 text-[11px] font-medium tracking-wide text-[#475569] uppercase">
                  Description
                </p>
                <p className="whitespace-pre-wrap text-[13px] text-foreground">
                  {supportingDescription.trim()}
                </p>
              </div>
            ) : null}
          </ChargesTableShell>
        ) : null}

        {additionalChargeRows !== undefined ? (
          <ChargesTableShell
            title="Additional Charges"
            totalLabel="Additional charges total"
            totalValue={formatInrPrecise(
              additionalChargeRows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0),
            )}
          >
            <table className="w-full min-w-[420px] border-collapse text-left">
              <thead>
                <tr className="bg-[#eef2f6]">
                  <th className={thClass("w-[70%]")}>Charge vertical</th>
                  <th className={thClass("w-[30%] text-right")}>Amount (₹)</th>
                </tr>
              </thead>
              <tbody>
                {additionalChargeRows.length === 0 ? (
                  <tr>
                    <td colSpan={2} className="px-3 py-6 text-center text-[13px] text-muted-foreground">
                      No additional charges yet.
                    </td>
                  </tr>
                ) : (
                  additionalChargeRows.map((row) => (
                    <tr key={row.key} className="border-t border-[#e2e8f0]">
                      <td className={tdClass()}>{row.label}</td>
                      <td className={tdClass("text-right tabular-nums")}>
                        {formatInrPrecise(row.amount)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </ChargesTableShell>
        ) : null}
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
    file_path?: string | null;
    source?: "upload" | "link" | "google_drive" | "onedrive" | "dropbox" | "box";
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
    if (item.file) {
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
      continue;
    }
    if (item.copyOnSave && item.sourceFilePath) {
      await deps.createAttachment({
        entity_type: "ovf",
        entity_id: ovfId,
        branch_id: branchId,
        company_id: companyId,
        file_name: encodeChargeLineFileName(lineKey, item.fileName),
        category,
        file_path: item.sourceFilePath,
        content_type: item.sourceContentType ?? "application/octet-stream",
        source: "upload",
      });
    }
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
    .filter((line) => line.side === "vendor" && !isAdditionalChargeOvfLine(line))
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
    .filter((line) => line.side === "vendor" && !isAdditionalChargeOvfLine(line))
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
