import type { DeliveryChallanRecord } from "@/utils/delivery-challan-storage";
import { formatChallanGrnSummary } from "@/utils/delivery-challan-storage";

export const SHIPMENT_STATUS_OPTIONS = [
  "Pending",
  "By hand",
  "Courier",
  "Delivered",
  "Pending dispatch",
  "Dispatched",
  "In transit",
  "Out for delivery",
  "Failed delivery",
  "Returned",
] as const;

export type ShipmentStatus = (typeof SHIPMENT_STATUS_OPTIONS)[number];

export const DELIVERY_MODE_OPTIONS = ["hand", "courier"] as const;
export type DeliveryMode = (typeof DELIVERY_MODE_OPTIONS)[number];

export const SURFACE_MODE_OPTIONS = ["By air", "By surface", "By hand", "DP"] as const;
export const COURIER_PROVIDER_OPTIONS = ["Bluedart", "EDL", "Logimart", "Sunil tempo"] as const;
export const ITEM_TYPE_OPTIONS = ["hardware", "software"] as const;
export type DeliveryItemType = (typeof ITEM_TYPE_OPTIONS)[number];

export type DeliveryStatusAttachment = {
  fileName: string;
  contentBase64: string;
  contentType: string;
};

/**
 * Billing of delivered DC material (payment may lag delivery).
 * - pending_delivery: not delivered yet
 * - unbilled: delivered, customer bill / payment not done
 * - partially_billed / fully_billed: billed later against this DC
 */
export type DeliveryBillStatus =
  | "pending_delivery"
  | "unbilled"
  | "partially_billed"
  | "fully_billed";

export type DeliveryStatusRecord = {
  challanId: string;
  shipmentStatus: string;
  dispatchDate: string;
  reminderEmail: string;
  expectedDeliveryDate: string;
  actualDeliveryDate: string;
  courierTransportDetails: string;
  courierProvider: string;
  trackingNumber: string;
  deliveryLocation: string;
  receiverDetails: string;
  cachePoNumber: string;
  customerPoNumber: string;
  customerName: string;
  cacheInvoiceNumber: string;
  cacheInvoiceDocument: DeliveryStatusAttachment | null;
  deliveryMode: DeliveryMode | "";
  deliveryBoyName: string;
  itemType: DeliveryItemType | "";
  podDocument: DeliveryStatusAttachment | null;
  docketNumber: string;
  boxCount: string;
  surfaceMode: string;
  remarks: string;
  /** Post-delivery customer bill status for this DC. */
  billStatus: DeliveryBillStatus;
  /** Qty billed so far against this challan (may be partial). */
  billedQuantity: string;
  billInvoiceNumber: string;
  billInvoiceDate: string;
  billDocument: DeliveryStatusAttachment | null;
  billRemarks: string;
  billedAt: string;
  /** When delivered and true, this DC appears under Procurement → Installation. */
  requiresInstallation: boolean;
  updatedAt: string;
};

export type DeliveryStatusRow = DeliveryStatusRecord & {
  challanNumber: string;
  challanDate: string;
  purchaseOrderNumber: string;
  grnSummary: string;
  customerName: string;
  vendorName: string;
  orderId: string | null;
};

const STORAGE_KEY = "erp.procurement.delivery-status";

function asText(value: unknown): string {
  if (value == null) return "";
  return String(value);
}

function normalizeAttachment(
  raw: Partial<DeliveryStatusAttachment> | null | undefined,
): DeliveryStatusAttachment | null {
  if (!raw?.fileName?.trim() || !raw.contentBase64?.trim()) return null;
  return {
    fileName: raw.fileName.trim(),
    contentBase64: raw.contentBase64,
    contentType: raw.contentType?.trim() || "application/octet-stream",
  };
}

function normalizeMode(value: string | undefined): DeliveryMode | "" {
  if (value === "hand" || value === "courier") return value;
  return "";
}

function normalizeItemType(value: string | undefined): DeliveryItemType | "" {
  if (value === "hardware" || value === "software") return value;
  return "";
}

function normalizeSurfaceMode(value: string | undefined): string {
  const raw = asText(value).trim();
  if (!raw) return "";
  const legacy: Record<string, string> = {
    Surface: "By surface",
    Air: "By air",
    Road: "By surface",
    Rail: "By surface",
  };
  if (legacy[raw]) return legacy[raw];
  if ((SURFACE_MODE_OPTIONS as readonly string[]).includes(raw)) return raw;
  return raw;
}

export function deriveDeliveryStatusLabel(
  value: Pick<
    DeliveryStatusRecord,
    "actualDeliveryDate" | "deliveryMode" | "itemType" | "podDocument" | "shipmentStatus"
  >,
): string {
  const deliveredDate = asText(value.actualDeliveryDate).trim();
  if (deliveredDate) {
    if (value.deliveryMode === "hand" && !value.podDocument) {
      return "By hand";
    }
    return "Delivered";
  }
  if (value.deliveryMode === "courier") return "Courier";
  if (value.deliveryMode === "hand") return "By hand";
  const legacy = (value.shipmentStatus || "").trim();
  if (legacy && legacy !== "Pending dispatch") return legacy;
  return "Pending";
}

function normalizeBillStatus(value: unknown): DeliveryBillStatus {
  const raw = asText(value).trim().toLowerCase();
  if (raw === "unbilled" || raw === "partially_billed" || raw === "fully_billed") {
    return raw;
  }
  if (raw === "pending_delivery") return "pending_delivery";
  return "pending_delivery";
}

function normalize(raw: Partial<DeliveryStatusRecord> & { challanId: string }): DeliveryStatusRecord {
  const cacheInvoiceDocument = normalizeAttachment(raw.cacheInvoiceDocument);
  const podDocument = normalizeAttachment(raw.podDocument);
  const billDocument = normalizeAttachment(raw.billDocument);
  const deliveryMode = normalizeMode(raw.deliveryMode);
  const itemType = normalizeItemType(raw.itemType);
  const actualDeliveryDate = raw.actualDeliveryDate ?? "";
  const base: DeliveryStatusRecord = {
    challanId: raw.challanId,
    shipmentStatus: asText(raw.shipmentStatus).trim() || "Pending",
    dispatchDate: raw.dispatchDate ?? "",
    reminderEmail: raw.reminderEmail ?? "",
    expectedDeliveryDate: raw.expectedDeliveryDate ?? "",
    actualDeliveryDate,
    courierTransportDetails: raw.courierTransportDetails ?? "",
    courierProvider: raw.courierProvider ?? raw.courierTransportDetails ?? "",
    trackingNumber: raw.trackingNumber ?? raw.docketNumber ?? "",
    deliveryLocation: raw.deliveryLocation ?? "",
    receiverDetails: raw.receiverDetails ?? raw.deliveryBoyName ?? "",
    cachePoNumber: raw.cachePoNumber ?? "",
    customerPoNumber: raw.customerPoNumber ?? "",
    customerName: raw.customerName ?? "",
    cacheInvoiceNumber: raw.cacheInvoiceNumber ?? "",
    cacheInvoiceDocument,
    deliveryMode,
    deliveryBoyName: raw.deliveryBoyName ?? "",
    itemType,
    podDocument,
    docketNumber: raw.docketNumber ?? raw.trackingNumber ?? "",
    boxCount: raw.boxCount ?? "",
    surfaceMode: normalizeSurfaceMode(raw.surfaceMode),
    remarks: raw.remarks ?? "",
    billStatus: normalizeBillStatus(raw.billStatus),
    billedQuantity: asText(raw.billedQuantity).trim(),
    billInvoiceNumber: asText(raw.billInvoiceNumber).trim() || asText(raw.cacheInvoiceNumber).trim(),
    billInvoiceDate: asText(raw.billInvoiceDate).trim(),
    billDocument: billDocument ?? cacheInvoiceDocument,
    billRemarks: asText(raw.billRemarks).trim(),
    billedAt: asText(raw.billedAt).trim(),
    requiresInstallation: Boolean(raw.requiresInstallation),
    updatedAt: raw.updatedAt ?? "",
  };
  const shipmentStatus = deriveDeliveryStatusLabel(base);
  const delivered =
    isDeliveredShipmentStatus(shipmentStatus) || Boolean(asText(actualDeliveryDate).trim());
  let billStatus = base.billStatus;
  if (delivered && billStatus === "pending_delivery") {
    // Delivered DC stays unbilled until payment / bill is recorded later.
    billStatus = Number(base.billedQuantity) > 0 ? "partially_billed" : "unbilled";
    if (
      Number(base.billedQuantity) > 0 &&
      asText(base.billInvoiceNumber).trim() &&
      !asText(raw.billStatus).trim()
    ) {
      // Legacy rows that already had an invoice: treat as fully billed if qty unknown.
      billStatus = "fully_billed";
    }
  }
  return {
    ...base,
    shipmentStatus,
    billStatus,
  };
}

function readAll(): DeliveryStatusRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as DeliveryStatusRecord[];
    return Array.isArray(parsed)
      ? parsed.flatMap((row) => {
          try {
            if (!row || typeof row !== "object") return [];
            return [normalize(row)];
          } catch {
            return [];
          }
        })
      : [];
  } catch {
    return [];
  }
}

function writeAll(rows: DeliveryStatusRecord[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
}

export function getDeliveryStatus(challanId: string): DeliveryStatusRecord | null {
  return readAll().find((row) => row.challanId === challanId) ?? null;
}

export function isDeliveryStatusPersisted(challanId: string): boolean {
  const row = getDeliveryStatus(challanId);
  return Boolean(row?.updatedAt?.trim());
}

export function listDeliveryStatuses(): DeliveryStatusRecord[] {
  return readAll().sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}

export function upsertDeliveryStatus(
  record: Omit<DeliveryStatusRecord, "updatedAt"> & { updatedAt?: string },
): DeliveryStatusRecord {
  const now = new Date().toISOString();
  const next = normalize({ ...record, updatedAt: record.updatedAt || now });
  const rows = readAll().filter((row) => row.challanId !== record.challanId);
  rows.push(next);
  writeAll(rows);
  return next;
}

/** Record partial or full billing against a delivered delivery challan. */
export function upsertDeliveryChallanBilling(input: {
  challanId: string;
  billStatus: "unbilled" | "partially_billed" | "fully_billed";
  billedQuantity: string;
  billInvoiceNumber?: string;
  billInvoiceDate?: string;
  billDocument?: DeliveryStatusAttachment | null;
  billRemarks?: string;
}): DeliveryStatusRecord | null {
  const existing = getDeliveryStatus(input.challanId);
  if (!existing) return null;
  const invoice = asText(input.billInvoiceNumber).trim();
  return upsertDeliveryStatus({
    ...existing,
    billStatus: input.billStatus,
    billedQuantity: asText(input.billedQuantity).trim(),
    billInvoiceNumber: invoice,
    billInvoiceDate: asText(input.billInvoiceDate).trim(),
    billDocument: input.billDocument === undefined ? existing.billDocument : input.billDocument,
    billRemarks: asText(input.billRemarks).trim(),
    billedAt: new Date().toISOString(),
    cacheInvoiceNumber: invoice || existing.cacheInvoiceNumber,
    cacheInvoiceDocument:
      input.billDocument === undefined
        ? existing.cacheInvoiceDocument
        : input.billDocument || existing.cacheInvoiceDocument,
  });
}

export function defaultStatusFromChallan(challan: DeliveryChallanRecord): DeliveryStatusRecord {
  const transport = [challan.transportDetails, challan.driverVehicleDetails]
    .map((s) => asText(s).trim())
    .filter(Boolean)
    .join("\n");
  return normalize({
    challanId: challan.id,
    shipmentStatus: "Pending",
    dispatchDate: challan.challanDate || "",
    reminderEmail: "",
    expectedDeliveryDate: "",
    actualDeliveryDate: "",
    courierTransportDetails: transport,
    courierProvider: "",
    trackingNumber: "",
    deliveryLocation: challan.customerShipTo?.trim() || challan.customerBillTo?.trim() || "",
    receiverDetails: challan.kindAttn?.trim() ? `Kind attn: ${challan.kindAttn.trim()}` : "",
    cachePoNumber:
      challan.companyPoNumber?.trim() ||
      challan.purchaseOrderNumber?.trim() ||
      "",
    customerPoNumber: customerPoFromChallan(challan),
    customerName: challan.customerName?.trim() || "",
    cacheInvoiceNumber: "",
    cacheInvoiceDocument: null,
    deliveryMode: "",
    deliveryBoyName: "",
    itemType: "",
    podDocument: null,
    docketNumber: "",
    boxCount: "",
    surfaceMode: "",
    remarks: "",
    billStatus: "pending_delivery",
    billedQuantity: "",
    billInvoiceNumber: "",
    billInvoiceDate: "",
    billDocument: null,
    billRemarks: "",
    billedAt: "",
    requiresInstallation: false,
    updatedAt: "",
  });
}

export function resolveDeliveryStatusForChallan(
  challan: DeliveryChallanRecord,
): DeliveryStatusRecord {
  return getDeliveryStatus(challan.id) ?? defaultStatusFromChallan(challan);
}

function customerPoFromChallan(challan: DeliveryChallanRecord): string {
  const company = challan.companyPoNumber?.trim() || "";
  const po = challan.purchaseOrderNumber?.trim() || "";
  if (po && po !== company) return po;
  return "";
}

export function deliveryStatusRowFromChallan(challan: DeliveryChallanRecord): DeliveryStatusRow {
  const status = resolveDeliveryStatusForChallan(challan);
  return {
    ...status,
    challanNumber: challan.challanNumber,
    challanDate: challan.challanDate,
    purchaseOrderNumber:
      asText(status.cachePoNumber).trim() ||
      challan.companyPoNumber?.trim() ||
      challan.purchaseOrderNumber ||
      "",
    grnSummary: formatChallanGrnSummary(challan),
    customerName: asText(status.customerName).trim() || challan.customerName || "",
    vendorName: challan.vendorName,
    orderId: challan.orderId,
  };
}

export function shipmentStatusBadgeVariant(
  status: string,
): "default" | "secondary" | "destructive" | "outline" | "success" | "warning" {
  const value = asText(status).toLowerCase();
  if (value === "delivered") return "success";
  if (value === "failed delivery" || value === "returned") return "destructive";
  if (value === "pending" || value === "pending dispatch") return "warning";
  if (value === "by hand" || value === "courier") return "secondary";
  if (value === "dispatched" || value === "in transit" || value === "out for delivery") {
    return "secondary";
  }
  return "outline";
}

export type DeliveryStatusFormErrors = Partial<
  Record<
    | "cacheInvoiceNumber"
    | "cacheInvoiceDocument"
    | "customerPoNumber"
    | "customerName"
    | "deliveryMode"
    | "deliveryBoyName"
    | "dispatchDate"
    | "actualDeliveryDate"
    | "itemType"
    | "podDocument"
    | "docketNumber"
    | "courierProvider"
    | "reminderEmail"
    | "expectedDeliveryDate"
    | "boxCount"
    | "surfaceMode"
    | "remarks",
    string
  >
>;

export function validateDeliveryStatusForm(
  value: Omit<DeliveryStatusRecord, "challanId" | "updatedAt">,
): DeliveryStatusFormErrors {
  const errors: DeliveryStatusFormErrors = {};
  // Cache invoice is optional at delivery — bill DC material later after payment.
  if (value.deliveryMode !== "hand" && value.deliveryMode !== "courier") {
    errors.deliveryMode = "Select By hand or Courier.";
  }

  if (value.deliveryMode === "hand") {
    if (!asText(value.deliveryBoyName).trim()) {
      errors.deliveryBoyName = "Delivery person is required.";
    }
    if (!asText(value.dispatchDate).trim()) {
      errors.dispatchDate = "Dispatch date is required.";
    }
    if (value.itemType !== "hardware" && value.itemType !== "software") {
      errors.itemType = "Select hardware or software.";
    }
    if (
      asText(value.actualDeliveryDate).trim() &&
      (value.itemType === "hardware" || value.itemType === "software") &&
      !value.podDocument?.fileName
    ) {
      errors.podDocument = "POD attachment is required when a delivery date is set.";
    }
  }

  if (value.deliveryMode === "courier") {
    if (!asText(value.docketNumber).trim()) {
      errors.docketNumber = "Docket number is required for courier.";
    }
    if (!asText(value.courierProvider).trim()) {
      errors.courierProvider = "Select a courier.";
    }
  }

  if (
    asText(value.dispatchDate).trim() &&
    asText(value.actualDeliveryDate).trim() &&
    asText(value.actualDeliveryDate) < asText(value.dispatchDate)
  ) {
    errors.actualDeliveryDate = "Delivered date must be on or after dispatch date.";
  }

  return errors;
}

export function firstDeliveryStatusFormError(errors: DeliveryStatusFormErrors): string | null {
  for (const message of Object.values(errors)) {
    if (message) return message;
  }
  return null;
}

export function isDeliveredShipmentStatus(status: string): boolean {
  return asText(status).trim().toLowerCase() === "delivered";
}

/** Kept for older call sites; new flow derives status from dates and mode. */
export function applyShipmentStatusToActualDate<
  T extends Pick<DeliveryStatusRecord, "shipmentStatus" | "actualDeliveryDate">,
>(value: T): T {
  return value;
}

export function openStoredDeliveryFile(file: DeliveryStatusAttachment): void {
  const binary = atob(file.contentBase64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: file.contentType || "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener,noreferrer");
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
