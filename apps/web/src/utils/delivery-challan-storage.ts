export type DeliveryChallanLine = {
  id: string;
  /** Product / part number. */
  product: string;
  /** Item description (legacy field name: itemName). */
  itemName: string;
  quantitySent: string;
  hsnSac: string;
  assetNo: string;
  /** Vendor unit cost (not customer price). */
  rate: string;
  shipTo: string;
};

export type ChallanItemsSourceMode = "full_po" | "selected_grns";

/** Gate pass mode: Returnable (RGP) vs Non-returnable (NRGP). */
export type DeliveryChallanMode = "RGP" | "NRGP";

/** Whether this challan covers billed GRN lines or delivery-challan (stock) lines. */
export type GrnChallanKind = "billing" | "delivery_challan";

export type DeliveryChallanRecord = {
  id: string;
  orderId: string | null;
  challanNumber: string;
  challanDate: string;
  entityName: string;
  entityAddressBlock: string;
  entityGstBlock: string;
  documentType: string;
  copyLabel: string;
  customerName: string;
  customerBillTo: string;
  customerShipTo: string;
  customerGstNo: string;
  kindAttn: string;
  purchaseOrderNumber: string;
  poDate: string;
  poNumberDate: string;
  shipFromAddress: string;
  billingState: string;
  shippingState: string;
  taxPercentage: string;
  remarks: string;
  taxRemarks: string;
  preparedBy: string;
  deliveredBy: string;
  /** Vendor name — reference only; PDF uses customer fields separately. */
  vendorName: string;
  itemsSourceMode: ChallanItemsSourceMode;
  selectedGrnKeys: string[];
  selectedGrnNumbers: string[];
  /** Billing vs delivery-challan GRN classification. */
  grnKind?: GrnChallanKind;
  /** Customer / cache invoice captured on billing GRNs. */
  invoiceNumber?: string;
  invoiceDate?: string;
  /** Company PO (Cache PO), when known. */
  companyPoNumber?: string;
  lines: DeliveryChallanLine[];
  deliveryMode: DeliveryChallanMode;
  transportDetails: string;
  driverVehicleDetails: string;
  senderSignature: string;
  receiverSignature: string;
  createdAt: string;
  updatedAt: string;
};

const STORAGE_KEY = "erp.procurement.delivery-challans";

function normalizeLine(line: Partial<DeliveryChallanLine> & { id: string }): DeliveryChallanLine {
  let product = (line.product ?? "").trim();
  let itemName = (line.itemName ?? "").trim();
  // Legacy / wrong mapping put product name in description — move it to product.
  if (!product && itemName) {
    product = itemName;
    itemName = "";
  } else if (product && itemName && product.toLowerCase() === itemName.toLowerCase()) {
    itemName = "";
  }
  return {
    id: line.id,
    product,
    itemName,
    quantitySent: line.quantitySent ?? "",
    hsnSac: line.hsnSac ?? "",
    assetNo: line.assetNo ?? "-",
    rate: line.rate ?? "",
    shipTo: line.shipTo ?? "",
  };
}

function normalizeRecord(raw: DeliveryChallanRecord): DeliveryChallanRecord {
  const legacySupplier = (raw as { supplierName?: string }).supplierName;
  return {
    ...raw,
    entityName: raw.entityName ?? "",
    entityAddressBlock: raw.entityAddressBlock ?? "",
    entityGstBlock: raw.entityGstBlock ?? "",
    documentType: raw.documentType ?? "DELIVERY CHALLAN",
    copyLabel: raw.copyLabel ?? "ORIGINAL FOR CONSIGNEE",
    customerBillTo: raw.customerBillTo ?? "",
    customerShipTo: raw.customerShipTo ?? "",
    customerGstNo: raw.customerGstNo ?? "",
    kindAttn: raw.kindAttn ?? "",
    poDate: raw.poDate ?? "",
    poNumberDate: raw.poNumberDate ?? raw.purchaseOrderNumber ?? "",
    shipFromAddress: raw.shipFromAddress ?? "",
    billingState: raw.billingState ?? "",
    shippingState: raw.shippingState ?? "",
    taxPercentage: raw.taxPercentage ?? "18",
    remarks: raw.remarks ?? "",
    taxRemarks: raw.taxRemarks ?? "",
    preparedBy: raw.preparedBy ?? "",
    deliveredBy: raw.deliveredBy ?? "",
    vendorName: raw.vendorName ?? legacySupplier ?? "",
    itemsSourceMode: raw.itemsSourceMode ?? "full_po",
    selectedGrnKeys: (raw.selectedGrnKeys ?? []).map((k) => String(k ?? "")).filter(Boolean),
    selectedGrnNumbers: uniqueGeneratedGrnNumbers(raw.selectedGrnNumbers ?? []),
    grnKind:
      raw.grnKind === "billing" || raw.grnKind === "delivery_challan"
        ? raw.grnKind
        : undefined,
    invoiceNumber: raw.invoiceNumber ?? "",
    invoiceDate: raw.invoiceDate ?? "",
    companyPoNumber: raw.companyPoNumber ?? "",
    lines: (raw.lines || []).map((ln) => normalizeLine(ln)),
    deliveryMode: raw.deliveryMode === "RGP" ? "RGP" : "NRGP",
  };
}

export function formatDeliveryModeLabel(mode: DeliveryChallanMode): string {
  return mode === "RGP" ? "RGP" : "NRGP";
}

function readAll(): DeliveryChallanRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as DeliveryChallanRecord[];
    return Array.isArray(parsed)
      ? parsed.flatMap((row) => {
          try {
            if (!row || typeof row !== "object") return [];
            return [normalizeRecord(row)];
          } catch {
            return [];
          }
        })
      : [];
  } catch {
    return [];
  }
}

function writeAll(rows: DeliveryChallanRecord[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
}

export function listDeliveryChallans(): DeliveryChallanRecord[] {
  return readAll().sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}

export function getDeliveryChallan(id: string): DeliveryChallanRecord | null {
  return readAll().find((row) => row.id === id) ?? null;
}

/** All saved challans for a purchase order (newest first). */
export function listDeliveryChallansByOrderId(orderId: string): DeliveryChallanRecord[] {
  const id = orderId.trim();
  if (!id) return [];
  return readAll()
    .filter((row) => row.orderId === id)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

/** Latest saved challan for a purchase order, if any. */
export function findDeliveryChallanByOrderId(orderId: string): DeliveryChallanRecord | null {
  return listDeliveryChallansByOrderId(orderId)[0] ?? null;
}

import type { ProcurementInventoryRow } from "@/services/procurement-service";
import {
  formatGeneratedGrnNumbers,
  resolveChallanDisplayGrnNumbers,
  uniqueGeneratedGrnNumbers,
} from "@/utils/grn-number-display";

/** Display label for GRN(s) covered by a challan (generated GRN numbers when known). */
export function formatChallanGrnSummary(
  record: DeliveryChallanRecord,
  inventory?: ProcurementInventoryRow[],
): string {
  const nums = resolveChallanDisplayGrnNumbers(record, inventory);
  if (nums.length > 0) return formatGeneratedGrnNumbers(nums);
  if (record.itemsSourceMode === "full_po") return "Full PO";
  return "—";
}

export function upsertDeliveryChallan(
  record: Omit<DeliveryChallanRecord, "createdAt" | "updatedAt"> & {
    createdAt?: string;
    updatedAt?: string;
  },
): DeliveryChallanRecord {
  const now = new Date().toISOString();
  const existing = getDeliveryChallan(record.id);
  const next: DeliveryChallanRecord = normalizeRecord({
    ...record,
    lines: record.lines.map((ln) => normalizeLine(ln)),
    createdAt: existing?.createdAt || record.createdAt || now,
    updatedAt: now,
  } as DeliveryChallanRecord);
  const rows = readAll().filter((row) => row.id !== record.id);
  rows.push(next);
  writeAll(rows);
  return next;
}

export function formatChallanItemsSummary(lines: DeliveryChallanLine[]): string {
  const items = lines.filter((ln) => (ln.itemName || "").trim() || (ln.product || "").trim());
  if (items.length === 0) return "—";
  if (items.length === 1) {
    const label = (items[0].itemName || "").trim() || (items[0].product || "").trim() || "Item";
    return `${label} (${items[0].quantitySent || "0"})`;
  }
  return `${items.length} items`;
}

export function emptyChallanLine(): DeliveryChallanLine {
  return {
    id: crypto.randomUUID(),
    product: "",
    itemName: "",
    quantitySent: "",
    hsnSac: "",
    assetNo: "-",
    rate: "",
    shipTo: "",
  };
}

/** Extract trailing numeric sequence from known challan number patterns. */
function challanNumberSequence(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/^(?:DC\/\d{4}|CT\/\d{2}-\d{2})\/(\d+)$/i);
  if (match) return Number.parseInt(match[1], 10);
  const trailing = trimmed.match(/\/(\d+)$/);
  if (trailing) return Number.parseInt(trailing[1], 10);
  return null;
}

/** Next delivery challan number in +1 series (localStorage-backed). */
export function peekNextDeliveryChallanNumber(now = new Date()): string {
  const year = now.getFullYear();
  let maxSeq = 0;
  for (const row of readAll()) {
    const seq = challanNumberSequence(row.challanNumber || "");
    if (seq != null && Number.isFinite(seq) && seq > maxSeq) maxSeq = seq;
  }
  return `DC/${year}/${maxSeq + 1}`;
}

