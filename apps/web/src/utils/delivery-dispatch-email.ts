import { formatChallanGrnSummary, type DeliveryChallanRecord } from "@/utils/delivery-challan-storage";
import type { DeliveryStatusFormValue } from "@/components/procurement/delivery-status-form";
import { getScmDeliveryContact } from "@/services/procurement-service";

/** Domains that cannot receive mail (RFC 2606 / 6761). */
function isReservedDocumentationEmail(address: string): boolean {
  const domain = address.trim().toLowerCase().split("@")[1] || "";
  if (!domain) return false;
  if (domain === "example.com" || domain === "example.net" || domain === "example.org") {
    return true;
  }
  return (
    domain.endsWith(".example") ||
    domain.endsWith(".test") ||
    domain.endsWith(".invalid") ||
    domain.endsWith(".localhost") ||
    domain === "localhost"
  );
}

async function resolveCustomerEmail(
  challan: DeliveryChallanRecord,
  status: DeliveryStatusFormValue,
): Promise<string> {
  const fromStatus = (status.reminderEmail || "").trim();
  if (fromStatus) return fromStatus;
  const orderId = (challan.orderId || "").trim();
  if (!orderId) return "";
  try {
    const contact = await getScmDeliveryContact(orderId);
    return (contact.crm_email || contact.email || "").trim();
  } catch {
    return "";
  }
}

export async function sendDeliveryDispatchNotification(
  challan: DeliveryChallanRecord,
  status: DeliveryStatusFormValue,
  options?: { timeoutMs?: number },
): Promise<{ ok: boolean; message?: string; to?: string; skipped?: boolean }> {
  const to = await resolveCustomerEmail(challan, status);
  if (!to) {
    return { ok: false, message: "Customer email is missing." };
  }
  if (isReservedDocumentationEmail(to)) {
    return { ok: true, skipped: true, to };
  }

  const timeoutMs = options?.timeoutMs ?? 20_000;
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);

  const awb =
    status.deliveryMode === "courier"
      ? (status.docketNumber || status.trackingNumber || "").trim()
      : "";
  const courier =
    status.deliveryMode === "courier"
      ? (status.courierProvider || status.courierTransportDetails || "").trim()
      : status.deliveryMode === "hand"
        ? "By hand"
        : (status.courierProvider || status.courierTransportDetails || "").trim();

  try {
    const response = await fetch("/api/procurement/delivery-dispatch", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        to,
        challanNumber: challan.challanNumber,
        purchaseOrderNumber:
          challan.companyPoNumber || challan.purchaseOrderNumber || status.cachePoNumber,
        grnSummary: formatChallanGrnSummary(challan),
        customerName: status.customerName || challan.customerName,
        vendorName: challan.vendorName,
        shipmentStatus: "Out for delivery",
        dispatchDate: status.dispatchDate,
        expectedDeliveryDate: status.expectedDeliveryDate,
        trackingNumber: awb,
        courierTransportDetails: courier,
        lines: challan.lines.map((line) => ({
          itemName: line.itemName || line.product,
          quantitySent: line.quantitySent,
          hsnSac: line.hsnSac,
          assetNo: line.assetNo,
        })),
      }),
      signal: controller.signal,
    });
    const payload = (await response.json()) as { success?: boolean; message?: string };
    if (!response.ok || payload.success === false) {
      return { ok: false, message: payload.message ?? "Dispatch email failed.", to };
    }
    return { ok: true, message: payload.message, to };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return {
        ok: false,
        message: "Email request timed out. Check SMTP settings.",
        to,
      };
    }
    return { ok: false, message: "Could not reach email service.", to };
  } finally {
    window.clearTimeout(timer);
  }
}

export async function sendDeliveryOutcomeNotification(
  challan: DeliveryChallanRecord,
  status: DeliveryStatusFormValue,
  outcome: "Delivered" | "Failed delivery" | "Delayed",
  options?: { timeoutMs?: number },
): Promise<{ ok: boolean; message?: string; to?: string; skipped?: boolean }> {
  const to = await resolveCustomerEmail(challan, status);
  if (!to) {
    return { ok: false, message: "Customer email is missing." };
  }
  if (isReservedDocumentationEmail(to)) {
    return { ok: true, skipped: true, to };
  }

  const timeoutMs = options?.timeoutMs ?? 20_000;
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch("/api/procurement/delivery-outcome", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        to,
        outcome,
        challanNumber: challan.challanNumber,
        purchaseOrderNumber:
          challan.companyPoNumber || challan.purchaseOrderNumber || status.cachePoNumber,
        grnSummary: formatChallanGrnSummary(challan),
        customerName: status.customerName || challan.customerName,
        vendorName: challan.vendorName,
        dispatchDate: status.dispatchDate,
        actualDeliveryDate: status.actualDeliveryDate,
        trackingNumber:
          status.deliveryMode === "courier"
            ? status.docketNumber || status.trackingNumber || ""
            : status.trackingNumber || "",
        remarks: status.remarks || "",
        lines: challan.lines.map((line) => ({
          itemName: line.itemName || line.product,
          quantitySent: line.quantitySent,
          hsnSac: line.hsnSac,
          assetNo: line.assetNo,
        })),
      }),
      signal: controller.signal,
    });
    const payload = (await response.json()) as {
      success?: boolean;
      message?: string;
      detail?: string;
    };
    if (!response.ok || payload.success === false) {
      return {
        ok: false,
        message: payload.message || payload.detail || "Outcome email failed.",
        to,
      };
    }
    return { ok: true, message: payload.message, to };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return {
        ok: false,
        message: "Email request timed out. Check SMTP settings.",
        to,
      };
    }
    return { ok: false, message: "Could not reach email service.", to };
  } finally {
    window.clearTimeout(timer);
  }
}

export async function sendDeliveryDeliveredNotification(
  challan: DeliveryChallanRecord,
  status: DeliveryStatusFormValue,
  options?: { timeoutMs?: number },
): Promise<{ ok: boolean; message?: string; to?: string }> {
  return sendDeliveryOutcomeNotification(challan, status, "Delivered", options);
}
