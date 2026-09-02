/**
 * Customer bill taken against a delivery challan.
 * DC = goods delivered without taking a bill. Bill can be recorded any time after
 * the DC exists (during tracking, after delivery status, or after installation).
 */

import type { DeliveryChallanRecord } from "@/utils/delivery-challan-storage";
import { listDeliveryChallans } from "@/utils/delivery-challan-storage";
import {
  getDeliveryStatus,
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
      return "Unbilled";
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
      return "secondary";
  }
}

/** Resolve bill taken for a DC. Shipment / installation state does not gate this. */
export function resolveDeliveryBillStatus(
  status: Pick<DeliveryStatusRecord, "billStatus" | "billedQuantity"> | null | undefined,
  challanQty: number,
): DeliveryBillStatus {
  const explicit = status?.billStatus;
  if (
    explicit === "unbilled" ||
    explicit === "partially_billed" ||
    explicit === "fully_billed"
  ) {
    return explicit;
  }

  const billed = Number(status?.billedQuantity) || 0;
  if (billed <= 0) return "unbilled";
  if (challanQty > 0 && billed + 1e-9 >= challanQty) return "fully_billed";
  return "partially_billed";
}

/** Bill taken for a saved delivery challan (unbilled until recorded). */
export function resolveChallanBillStatus(challan: DeliveryChallanRecord): DeliveryBillStatus {
  const status = getDeliveryStatus(challan.id);
  return resolveDeliveryBillStatus(status, challanDeliveredQuantity(challan));
}

/** First DC on the PO that is not fully billed, else the latest DC. */
export function pickChallanIdToBill(orderId: string | null | undefined): string | null {
  const id = (orderId || "").trim();
  if (!id) return null;
  const challans = listDeliveryChallans().filter((row) => row.orderId === id);
  if (challans.length === 0) return null;
  const open = challans.find((row) => resolveChallanBillStatus(row) !== "fully_billed");
  return (open ?? challans[0]).id;
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
 * Aggregate bill taken across DCs for a purchase order.
 * No DC yet → "—" (bill is only taken after a delivery challan exists).
 */
export function aggregatePoDcBillStatus(orderId: string | null | undefined): PoDcBillStatus {
  const id = (orderId || "").trim();
  if (!id) return "—";

  const challans = listDeliveryChallans().filter((c) => c.orderId === id);
  if (challans.length === 0) return "—";

  let anyUnbilled = false;
  let anyPartial = false;
  let anyFull = false;

  for (const challan of challans) {
    const bill = resolveChallanBillStatus(challan);
    if (bill === "partially_billed") anyPartial = true;
    else if (bill === "fully_billed") anyFull = true;
    else anyUnbilled = true;
  }

  if (anyPartial || (anyUnbilled && anyFull)) return "Partially billed";
  if (anyUnbilled) return "Unbilled";
  if (anyFull) return "Fully billed";
  return "Unbilled";
}
