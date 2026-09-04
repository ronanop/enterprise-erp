import type { DeliveryChallanRecord } from "@/utils/delivery-challan-storage";
import type { DeliveryStatusFormValue } from "@/components/procurement/delivery-status-form";
import { sendDeliveryDispatchNotification } from "@/utils/delivery-dispatch-email";
import { runDeliveryReminderSweep } from "@/utils/delivery-status-reminders";
import {
  deriveDeliveryStatusLabel,
  firstDeliveryStatusFormError,
  getDeliveryStatus,
  isFailedShipmentStatus,
  stampDeliveredDate,
  upsertDeliveryStatus,
  validateDeliveryStatusForm,
  type DeliveryStatusFormErrors,
} from "@/utils/delivery-status-storage";

export type PersistDeliveryStatusResult =
  | { ok: true; trackingOnly: boolean; emailWarning?: string }
  | { ok: false; message: string; fieldErrors?: DeliveryStatusFormErrors };

export async function persistDeliveryStatusFromForm(
  challan: DeliveryChallanRecord,
  form: DeliveryStatusFormValue,
): Promise<PersistDeliveryStatusResult> {
  const errors = validateDeliveryStatusForm(form);
  const message = firstDeliveryStatusFormError(errors);
  if (message) {
    return { ok: false, message, fieldErrors: errors };
  }

  const existing = getDeliveryStatus(challan.id);
  const failed = isFailedShipmentStatus(form.shipmentStatus);
  const markingDelivered =
    !failed &&
    (form.shipmentStatus.trim() === "Delivered" ||
      Boolean(form.actualDeliveryDate?.trim()));
  const actualDeliveryDate = failed
    ? ""
    : markingDelivered
      ? stampDeliveredDate(form.dispatchDate, form.actualDeliveryDate)
      : form.actualDeliveryDate?.trim() || "";
  const shipmentStatus = failed
    ? "Failed delivery"
    : markingDelivered
      ? "Delivered"
      : deriveDeliveryStatusLabel({
          ...form,
          actualDeliveryDate,
          shipmentStatus: "",
        });
  const normalized: DeliveryStatusFormValue = {
    ...form,
    actualDeliveryDate,
    shipmentStatus,
    trackingNumber: form.docketNumber ?? "",
    cachePoNumber:
      form.cachePoNumber?.trim() ||
      challan.companyPoNumber?.trim() ||
      challan.purchaseOrderNumber ||
      "",
    customerPoNumber: form.customerPoNumber?.trim() || "",
    customerName: form.customerName?.trim() || challan.customerName?.trim() || "",
    courierTransportDetails:
      form.courierProvider?.trim() || form.courierTransportDetails?.trim() || "",
    courierProvider: form.courierProvider?.trim() || "",
    // Preserve billing recorded later — delivery save must not wipe it.
    billStatus: existing?.billStatus ?? form.billStatus ?? "unbilled",
    billedQuantity: existing?.billedQuantity ?? form.billedQuantity ?? "",
    billInvoiceNumber: existing?.billInvoiceNumber ?? form.billInvoiceNumber ?? "",
    billInvoiceDate: existing?.billInvoiceDate ?? form.billInvoiceDate ?? "",
    billDocument: existing?.billDocument ?? form.billDocument ?? null,
    billRemarks: existing?.billRemarks ?? form.billRemarks ?? "",
    billedAt: existing?.billedAt ?? form.billedAt ?? "",
  };

  const delivered = !failed && markingDelivered;
  let billStatus = normalized.billStatus;
  if (
    billStatus !== "unbilled" &&
    billStatus !== "partially_billed" &&
    billStatus !== "fully_billed"
  ) {
    billStatus = "unbilled";
  }

  upsertDeliveryStatus({
    challanId: challan.id,
    ...normalized,
    billStatus,
    requiresInstallation: delivered ? Boolean(normalized.requiresInstallation) : false,
  });
  runDeliveryReminderSweep();

  if (normalized.reminderEmail?.trim()) {
    const email = await sendDeliveryDispatchNotification(challan, normalized);
    if (!email.ok) {
      return {
        ok: true,
        trackingOnly: false,
        emailWarning: email.message ?? "Unknown error",
      };
    }
  }

  return { ok: true, trackingOnly: false };
}
