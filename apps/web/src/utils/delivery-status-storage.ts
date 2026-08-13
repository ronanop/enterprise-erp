import type { DeliveryChallanRecord } from "@/utils/delivery-challan-storage";
import { formatChallanGrnSummary } from "@/utils/delivery-challan-storage";

export const SHIPMENT_STATUS_OPTIONS = [
  "Pending dispatch",
  "Dispatched",
  "In transit",
  "Out for delivery",
  "Delivered",
  "Failed delivery",
  "Returned",
] as const;

export type ShipmentStatus = (typeof SHIPMENT_STATUS_OPTIONS)[number];

export type DeliveryStatusRecord = {
  challanId: string;
  shipmentStatus: string;
  dispatchDate: string;
  /** Notified 1 day before expected delivery. */
  reminderEmail: string;
  expectedDeliveryDate: string;
  actualDeliveryDate: string;
  courierTransportDetails: string;
  trackingNumber: string;
  deliveryLocation: string;
  receiverDetails: string;
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

function normalize(raw: Partial<DeliveryStatusRecord> & { challanId: string }): DeliveryStatusRecord {
  return {
    challanId: raw.challanId,
    shipmentStatus: raw.shipmentStatus?.trim() || SHIPMENT_STATUS_OPTIONS[0],
    dispatchDate: raw.dispatchDate ?? "",
    reminderEmail: raw.reminderEmail ?? "",
    expectedDeliveryDate: raw.expectedDeliveryDate ?? "",
    actualDeliveryDate: raw.actualDeliveryDate ?? "",
    courierTransportDetails: raw.courierTransportDetails ?? "",
    trackingNumber: raw.trackingNumber ?? "",
    deliveryLocation: raw.deliveryLocation ?? "",
    receiverDetails: raw.receiverDetails ?? "",
    updatedAt: raw.updatedAt ?? "",
  };
}

function readAll(): DeliveryStatusRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as DeliveryStatusRecord[];
    return Array.isArray(parsed) ? parsed.map((row) => normalize(row)) : [];
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

/** True after the user has saved delivery status at least once for this challan. */
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

export function defaultStatusFromChallan(challan: DeliveryChallanRecord): DeliveryStatusRecord {
  const transport = [challan.transportDetails, challan.driverVehicleDetails]
    .map((s) => s.trim())
    .filter(Boolean)
    .join("\n");
  return normalize({
    challanId: challan.id,
    shipmentStatus: SHIPMENT_STATUS_OPTIONS[0],
    dispatchDate: challan.challanDate || "",
    reminderEmail: "",
    expectedDeliveryDate: "",
    actualDeliveryDate: "",
    courierTransportDetails: transport,
    trackingNumber: "",
    deliveryLocation: challan.customerShipTo?.trim() || challan.customerBillTo?.trim() || "",
    receiverDetails: challan.kindAttn?.trim() ? `Kind attn: ${challan.kindAttn.trim()}` : "",
    updatedAt: "",
  });
}

export function resolveDeliveryStatusForChallan(
  challan: DeliveryChallanRecord,
): DeliveryStatusRecord {
  return getDeliveryStatus(challan.id) ?? defaultStatusFromChallan(challan);
}

export function deliveryStatusRowFromChallan(challan: DeliveryChallanRecord): DeliveryStatusRow {
  const status = resolveDeliveryStatusForChallan(challan);
  return {
    ...status,
    challanNumber: challan.challanNumber,
    challanDate: challan.challanDate,
    purchaseOrderNumber: challan.purchaseOrderNumber,
    grnSummary: formatChallanGrnSummary(challan),
    customerName: challan.customerName,
    vendorName: challan.vendorName,
    orderId: challan.orderId,
  };
}

export function shipmentStatusBadgeVariant(
  status: string,
): "default" | "secondary" | "destructive" | "outline" | "success" | "warning" {
  const value = status.toLowerCase();
  if (value === "delivered") return "success";
  if (value === "failed delivery" || value === "returned") return "destructive";
  if (value === "pending dispatch") return "warning";
  if (value === "dispatched" || value === "in transit" || value === "out for delivery") {
    return "secondary";
  }
  return "outline";
}

export type DeliveryStatusFormErrors = Partial<
  Record<"dispatchDate" | "reminderEmail" | "expectedDeliveryDate", string>
>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateDeliveryStatusForm(
  value: Omit<DeliveryStatusRecord, "challanId" | "updatedAt">,
): DeliveryStatusFormErrors {
  const errors: DeliveryStatusFormErrors = {};
  if (!value.dispatchDate.trim()) {
    errors.dispatchDate = "Dispatch date is required.";
  }
  if (!value.reminderEmail.trim()) {
    errors.reminderEmail = "Reminder email is required.";
  } else if (!EMAIL_PATTERN.test(value.reminderEmail.trim())) {
    errors.reminderEmail = "Enter a valid email address.";
  }
  if (!value.expectedDeliveryDate.trim()) {
    errors.expectedDeliveryDate = "Expected delivery date is required.";
  }
  if (
    value.dispatchDate.trim() &&
    value.expectedDeliveryDate.trim() &&
    value.expectedDeliveryDate < value.dispatchDate
  ) {
    errors.expectedDeliveryDate = "Must be on or after dispatch date.";
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
  return status.trim().toLowerCase() === "delivered";
}

/** Sets actual delivery date when status is Delivered; clears it otherwise. */
export function applyShipmentStatusToActualDate<
  T extends Pick<DeliveryStatusRecord, "shipmentStatus" | "actualDeliveryDate">,
>(value: T, today = new Date().toISOString().slice(0, 10)): T {
  if (isDeliveredShipmentStatus(value.shipmentStatus)) {
    return {
      ...value,
      actualDeliveryDate: value.actualDeliveryDate.trim() || today,
    };
  }
  return { ...value, actualDeliveryDate: "" };
}
