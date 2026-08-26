/**
 * Post-delivery billing for delivery challans.
 * DC = goods delivered; payment / customer bill may come later (partial or full).
 */

import type { DeliveryChallanRecord } from "@/utils/delivery-challan-storage";
import { listDeliveryChallans } from "@/utils/delivery-challan-storage";
import {
  getDeliveryStatus,
  isDeliveredShipmentStatus,
  type DeliveryBillStatus,
  type DeliveryStatusRecord,
} from "@/utils/delivery-status-storage";

export const DELIVERY_BILL_STATUS_OPTIONS = [
  "unbilled",
  "partially_billed",
  "fully_billed",
] as const satisfies ReadonlyArray<Exclude<DeliveryBillStatus, "pending_delivery">>;

export type ActiveDeliveryBillStatus = (typeof DELIVERY_BILL_STATUS_OPTIONS)[number];

export function challanDeliveredQuantity(challan: DeliveryChallanRecord): number {
  return challan.lines.reduce((sum, line) => {
    const qty = Number.parseFloat(String(line.quantitySent ?? "").replace(/,/g, ""));
    return sum + (Number.isFinite(qty) ? Math.max(0, qty) : 0);
  }, 0);
}

export function formatDeliveryBillStatusLabel(status: DeliveryBillStatus): string {
  switch (status) {
    case "fully_billed":
      return "Fully billed";
    case "partially_billed":
      return "Partially billed";
    case "unbilled":
      return "Unbilled";
    case "pending_delivery":
    default:
      return "Pending delivery";
  }
}

export function deliveryBillStatusBadgeVariant(
  status: DeliveryBillStatus,
): "default" | "secondary" | "destructive" | "outline" | "success" | "warning" {
  switch (status) {
    case "fully_billed":
      return "success";
    case "partially_billed":
      return "warning";
    case "unbilled":
      return "secondary";
    case "pending_delivery":
    default:
      return "outline";
  }
}

/** Resolve bill status for a challan + its delivery status row. */
export function resolveDeliveryBillStatus(
  status: Pick<
    DeliveryStatusRecord,
    "shipmentStatus" | "actualDeliveryDate" | "billStatus" | "billedQuantity"
  >,
  challanQty: number,
): DeliveryBillStatus {
  const delivered =
    isDeliveredShipmentStatus(status.shipmentStatus) ||
    Boolean(String(status.actualDeliveryDate ?? "").trim());
  if (!delivered) return "pending_delivery";

  const explicit = status.billStatus;
  if (
    explicit === "unbilled" ||
    explicit === "partially_billed" ||
    explicit === "fully_billed"
  ) {
    return explicit;
  }

  const billed = Number(status.billedQuantity) || 0;
  if (billed <= 0) return "unbilled";
  if (challanQty > 0 && billed + 1e-9 >= challanQty) return "fully_billed";
  if (billed > 0) return "partially_billed";
  return "unbilled";
}

export function deriveBillStatusFromQuantities(
  billedQty: number,
  challanQty: number,
): ActiveDeliveryBillStatus {
  const billed = Math.max(0, billedQty);
  const total = Math.max(0, challanQty);
  if (billed <= 0) return "unbilled";
  if (total > 0 && billed + 1e-9 >= total) return "fully_billed";
  return "partially_billed";
}

export type PoDcBillStatus = "—" | "Unbilled" | "Partially billed" | "Fully billed";

/**
 * Aggregate bill status across delivered DCs for a purchase order.
 * Used so PO bill status stays understandable after delivery.
 */
export function aggregatePoDcBillStatus(orderId: string | null | undefined): PoDcBillStatus {
  const id = (orderId || "").trim();
  if (!id) return "—";

  const challans = listDeliveryChallans().filter((c) => c.orderId === id);
  if (challans.length === 0) return "—";

  let hasDelivered = false;
  let anyUnbilled = false;
  let anyPartial = false;
  let anyFull = false;

  for (const challan of challans) {
    const status = getDeliveryStatus(challan.id);
    if (!status) continue;
    const bill = resolveDeliveryBillStatus(status, challanDeliveredQuantity(challan));
    if (bill === "pending_delivery") continue;
    hasDelivered = true;
    if (bill === "unbilled") anyUnbilled = true;
    if (bill === "partially_billed") anyPartial = true;
    if (bill === "fully_billed") anyFull = true;
  }

  if (!hasDelivered) return "—";
  if (anyPartial || (anyUnbilled && anyFull)) return "Partially billed";
  if (anyUnbilled) return "Unbilled";
  if (anyFull) return "Fully billed";
  return "Unbilled";
}
