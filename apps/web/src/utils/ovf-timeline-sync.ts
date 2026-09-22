import {
  getPurchaseOrder,
  recordOvfTimelineEvent,
  type RecordOvfTimelineEventInput,
} from "@/services/procurement-service";
import type { DeliveryChallanRecord } from "@/utils/delivery-challan-storage";
import type { DeliveryStatusFormValue } from "@/components/procurement/delivery-status-form";
import type { DeliveryStatusRecord } from "@/utils/delivery-status-storage";

const orderOvfCache = new Map<string, string | null>();

async function resolveOvfIdForOrder(
  orderId: string | null | undefined,
  explicitOvfId?: string | null,
): Promise<string | null> {
  const direct = explicitOvfId?.trim();
  if (direct) return direct;
  const oid = orderId?.trim();
  if (!oid) return null;
  if (orderOvfCache.has(oid)) return orderOvfCache.get(oid) ?? null;
  try {
    const order = await getPurchaseOrder(oid);
    const ovfId =
      order.source_document_type === "ovf" && order.source_document_id
        ? order.source_document_id
        : null;
    orderOvfCache.set(oid, ovfId);
    return ovfId;
  } catch {
    orderOvfCache.set(oid, null);
    return null;
  }
}

async function syncEvent(
  orderId: string | null | undefined,
  ovfId: string | null | undefined,
  event: RecordOvfTimelineEventInput,
): Promise<void> {
  const resolved = await resolveOvfIdForOrder(orderId, ovfId);
  if (!resolved) return;
  try {
    await recordOvfTimelineEvent(resolved, event);
  } catch {
    /* timeline sync is best-effort */
  }
}

export function syncOvfTimelineForChallan(
  challan: DeliveryChallanRecord,
  opts?: { ovfId?: string | null; isCreate?: boolean },
): void {
  const isBilling = challan.grnKind === "billing";
  const label = challan.challanNumber?.trim() || challan.purchaseOrderNumber?.trim() || "Delivery challan";
  const action = opts?.isCreate
    ? isBilling
      ? "billing_document_created"
      : "delivery_challan_created"
    : "delivery_challan_updated";
  const title = opts?.isCreate
    ? isBilling
      ? "Billing document created"
      : "Delivery challan created"
    : isBilling
      ? "Billing document updated"
      : "Delivery challan updated";

  void syncEvent(challan.orderId, opts?.ovfId, {
    action,
    title,
    summary: challan.purchaseOrderNumber?.trim() || undefined,
    entity_label: label,
    occurred_at: challan.updatedAt || challan.createdAt,
    metadata: { challan_id: challan.id, order_id: challan.orderId },
  });
}

export function syncOvfTimelineForDeliveryStatus(
  challan: DeliveryChallanRecord,
  next: DeliveryStatusFormValue | DeliveryStatusRecord,
  previous?: DeliveryStatusRecord | null,
): void {
  const label = challan.challanNumber?.trim() || challan.purchaseOrderNumber?.trim() || "Delivery challan";
  const events: RecordOvfTimelineEventInput[] = [];

  const dispatchChanged =
    (next.dispatchDate?.trim() || "") !== (previous?.dispatchDate?.trim() || "") ||
    (next.shipmentStatus?.trim() || "") !== (previous?.shipmentStatus?.trim() || "");
  if (
    dispatchChanged &&
    (next.dispatchDate?.trim() ||
      (next.shipmentStatus?.trim() && next.shipmentStatus.trim() !== "Pending"))
  ) {
    events.push({
      action: "delivery_dispatch",
      title: "Dispatch recorded",
      summary: next.shipmentStatus?.trim() || undefined,
      entity_label: label,
      occurred_at: next.dispatchDate || next.updatedAt,
      metadata: { challan_id: challan.id },
    });
  }

  if (next.shipmentStatus?.trim() === "Delivered" && previous?.shipmentStatus?.trim() !== "Delivered") {
    events.push({
      action: "delivery_completed",
      title: "Delivery completed",
      summary: next.deliveryLocation?.trim() || next.receiverDetails?.trim() || undefined,
      entity_label: label,
      occurred_at: next.actualDeliveryDate || next.updatedAt,
      metadata: { challan_id: challan.id },
    });
  }

  if (
    next.shipmentStatus?.trim() === "Failed delivery" &&
    previous?.shipmentStatus?.trim() !== "Failed delivery"
  ) {
    events.push({
      action: "delivery_failed",
      title: "Delivery failed",
      summary: next.remarks?.trim() || undefined,
      entity_label: label,
      occurred_at: next.updatedAt,
      metadata: { challan_id: challan.id },
    });
  }

  if (
    next.billedAt &&
    next.billStatus !== previous?.billStatus &&
    (next.billStatus === "partially_billed" || next.billStatus === "fully_billed")
  ) {
    events.push({
      action: "bill_taken",
      title: "Bill taken",
      summary: next.billInvoiceNumber?.trim() || undefined,
      entity_label: label,
      occurred_at: next.billedAt,
      metadata: { challan_id: challan.id, bill_status: next.billStatus },
    });
  }

  for (const event of events) {
    void syncEvent(challan.orderId, null, event);
  }
}
