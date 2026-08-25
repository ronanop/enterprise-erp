import type { DeliveryChallanRecord } from "@/utils/delivery-challan-storage";
import type { DeliveryStatusFormValue } from "@/components/procurement/delivery-status-form";
import { sendDeliveryDispatchNotification } from "@/utils/delivery-dispatch-email";
import { runDeliveryReminderSweep } from "@/utils/delivery-status-reminders";
import {
  deriveDeliveryStatusLabel,
  firstDeliveryStatusFormError,
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

  const normalized: DeliveryStatusFormValue = {
    ...form,
    shipmentStatus: deriveDeliveryStatusLabel(form),
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
  };

  upsertDeliveryStatus({
    challanId: challan.id,
    ...normalized,
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
