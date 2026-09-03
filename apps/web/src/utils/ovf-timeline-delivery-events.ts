import type { DeliveryChallanRecord } from "@/utils/delivery-challan-storage";
import { getDeliveryChallan, listDeliveryChallans } from "@/utils/delivery-challan-storage";
import { getDeliveryStatus } from "@/utils/delivery-status-storage";
import type { OvfTimelineEvent } from "@/services/procurement-service";

function toIso(value: string | undefined | null, fallback: string): string {
  const raw = (value || "").trim();
  if (!raw) return fallback;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return fallback;
  return parsed.toISOString();
}

function baseEvent(
  partial: Omit<OvfTimelineEvent, "requested_by_id" | "requested_by_name" | "decided_by_id" | "decided_by_name" | "decision" | "team_role" | "remark" | "version">,
): OvfTimelineEvent {
  return {
    ...partial,
    requested_by_id: null,
    requested_by_name: null,
    decided_by_id: null,
    decided_by_name: null,
    decision: null,
    team_role: null,
    remark: null,
    version: null,
  };
}

/** Local delivery / billing steps for linked PO orders (browser storage fallback). */
export function buildLocalDeliveryTimelineEvents(orderIds: string[]): OvfTimelineEvent[] {
  if (orderIds.length === 0) return [];
  const orderSet = new Set(orderIds.map((id) => id.trim()).filter(Boolean));
  const events: OvfTimelineEvent[] = [];

  for (const challan of listDeliveryChallans()) {
    const orderId = challan.orderId?.trim();
    if (!orderId || !orderSet.has(orderId)) continue;

    const label = challan.challanNumber?.trim() || challan.purchaseOrderNumber?.trim() || "Delivery challan";
    const isBilling = challan.grnKind === "billing";
    events.push(
      baseEvent({
        id: `local-dc-created-${challan.id}`,
        occurred_at: toIso(challan.createdAt, new Date().toISOString()),
        event_type: "delivery",
        entity_type: "procurement",
        entity_id: challan.id,
        entity_label: label,
        title: isBilling ? "Billing document created" : "Delivery challan created",
        summary: challan.purchaseOrderNumber?.trim() || undefined,
        action: isBilling ? "billing_document_created" : "delivery_challan_created",
      }),
    );

    if (challan.updatedAt && challan.updatedAt !== challan.createdAt) {
      events.push(
        baseEvent({
          id: `local-dc-updated-${challan.id}-${challan.updatedAt}`,
          occurred_at: toIso(challan.updatedAt, new Date().toISOString()),
          event_type: "delivery",
          entity_type: "procurement",
          entity_id: challan.id,
          entity_label: label,
          title: isBilling ? "Billing document updated" : "Delivery challan updated",
          summary: challan.purchaseOrderNumber?.trim() || undefined,
          action: "delivery_challan_updated",
        }),
      );
    }

    const status = getDeliveryStatus(challan.id);
    if (!status) continue;

    const dispatchRecorded =
      Boolean(status.dispatchDate?.trim()) ||
      (status.shipmentStatus.trim() !== "" && status.shipmentStatus.trim() !== "Pending");
    if (dispatchRecorded) {
      events.push(
        baseEvent({
          id: `local-dispatch-${challan.id}-${status.updatedAt}`,
          occurred_at: toIso(status.dispatchDate || status.updatedAt, status.updatedAt),
          event_type: "delivery",
          entity_type: "procurement",
          entity_id: challan.id,
          entity_label: label,
          title: "Dispatch recorded",
          summary: status.shipmentStatus?.trim() || undefined,
          action: "delivery_dispatch",
        }),
      );
    }

    if (status.shipmentStatus.trim() === "Delivered") {
      events.push(
        baseEvent({
          id: `local-delivered-${challan.id}`,
          occurred_at: toIso(status.actualDeliveryDate || status.updatedAt, status.updatedAt),
          event_type: "delivery",
          entity_type: "procurement",
          entity_id: challan.id,
          entity_label: label,
          title: "Delivery completed",
          summary: status.deliveryLocation?.trim() || status.receiverDetails?.trim() || undefined,
          action: "delivery_completed",
        }),
      );
    } else if (status.shipmentStatus.trim() === "Failed delivery") {
      events.push(
        baseEvent({
          id: `local-failed-${challan.id}`,
          occurred_at: toIso(status.updatedAt, new Date().toISOString()),
          event_type: "delivery",
          entity_type: "procurement",
          entity_id: challan.id,
          entity_label: label,
          title: "Delivery failed",
          summary: status.remarks?.trim() || undefined,
          action: "delivery_failed",
        }),
      );
    }

    if (
      status.billedAt &&
      (status.billStatus === "partially_billed" || status.billStatus === "fully_billed")
    ) {
      events.push(
        baseEvent({
          id: `local-bill-${challan.id}-${status.billedAt}`,
          occurred_at: toIso(status.billedAt, status.updatedAt),
          event_type: "delivery",
          entity_type: "procurement",
          entity_id: challan.id,
          entity_label: label,
          title: "Bill taken",
          summary: status.billInvoiceNumber?.trim() || undefined,
          action: "bill_taken",
        }),
      );
    }
  }

  return events.sort(
    (a, b) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime(),
  );
}

export function mergeOvfTimelineEvents(
  apiEvents: OvfTimelineEvent[],
  localEvents: OvfTimelineEvent[],
): OvfTimelineEvent[] {
  const seen = new Set(apiEvents.map((event) => `${event.action}:${event.entity_id}:${event.title}`));
  const merged = [...apiEvents];
  for (const event of localEvents) {
    const key = `${event.action}:${event.entity_id}:${event.title}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(event);
  }
  return merged.sort(
    (a, b) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime(),
  );
}

export function resolveTimelineStatus(
  apiStatus: string,
  events: OvfTimelineEvent[],
): string {
  if (apiStatus === "completed") return "completed";
  if (events.some((event) => event.action === "delivery_completed")) return "completed";
  return apiStatus;
}

export function challanForTimelineSync(challanId: string): DeliveryChallanRecord | null {
  return getDeliveryChallan(challanId);
}
