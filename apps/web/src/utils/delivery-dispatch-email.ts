import { formatChallanGrnSummary, type DeliveryChallanRecord } from "@/utils/delivery-challan-storage";
import type { DeliveryStatusFormValue } from "@/components/procurement/delivery-status-form";

export async function sendDeliveryDispatchNotification(
  challan: DeliveryChallanRecord,
  status: DeliveryStatusFormValue,
  options?: { timeoutMs?: number },
): Promise<{ ok: boolean; message?: string }> {
  const to = (status.reminderEmail || "").trim();
  if (!to) {
    return { ok: false, message: "Reminder email is missing." };
  }

  const timeoutMs = options?.timeoutMs ?? 20_000;
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch("/api/procurement/delivery-dispatch", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        to,
        challanNumber: challan.challanNumber,
        purchaseOrderNumber: challan.purchaseOrderNumber,
        grnSummary: formatChallanGrnSummary(challan),
        customerName: challan.customerName,
        vendorName: challan.vendorName,
        shipmentStatus: status.shipmentStatus,
        dispatchDate: status.dispatchDate,
        expectedDeliveryDate: status.expectedDeliveryDate,
        trackingNumber: status.trackingNumber,
        courierTransportDetails: status.courierTransportDetails,
        lines: challan.lines.map((line) => ({
          itemName: line.itemName,
          quantitySent: line.quantitySent,
          hsnSac: line.hsnSac,
          assetNo: line.assetNo,
        })),
      }),
      signal: controller.signal,
    });
    const payload = (await response.json()) as { success?: boolean; message?: string };
    if (!response.ok || payload.success === false) {
      return { ok: false, message: payload.message ?? "Dispatch email failed." };
    }
    return { ok: true, message: payload.message };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return { ok: false, message: "Email request timed out. Check Brevo SMTP settings." };
    }
    return { ok: false, message: "Could not reach email service." };
  } finally {
    window.clearTimeout(timer);
  }
}
