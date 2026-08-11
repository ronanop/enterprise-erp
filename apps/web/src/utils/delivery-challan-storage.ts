export type DeliveryChallanLine = {
  id: string;
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
  return {
    id: line.id,
    itemName: line.itemName ?? "",
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
    selectedGrnKeys: raw.selectedGrnKeys ?? [],
    selectedGrnNumbers: raw.selectedGrnNumbers ?? [],
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
    return Array.isArray(parsed) ? parsed.map(normalizeRecord) : [];
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

/** Display label for GRN(s) covered by a challan. */
export function formatChallanGrnSummary(record: DeliveryChallanRecord): string {
  const nums = (record.selectedGrnNumbers || []).map((n) => n.trim()).filter(Boolean);
  if (nums.length > 0) return nums.join(", ");
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
  const items = lines.filter((ln) => ln.itemName.trim());
  if (items.length === 0) return "—";
  if (items.length === 1) {
    return `${items[0].itemName} (${items[0].quantitySent || "0"})`;
  }
  return `${items.length} items`;
}

export function emptyChallanLine(): DeliveryChallanLine {
  return {
    id: crypto.randomUUID(),
    itemName: "",
    quantitySent: "",
    hsnSac: "",
    assetNo: "-",
    rate: "",
    shipTo: "",
  };
}

