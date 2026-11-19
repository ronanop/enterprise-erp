import type { DeliveryChallanRecord } from "@/utils/delivery-challan-storage";
import type { DeliveryStatusFormValue } from "@/components/procurement/delivery-status-form";
import { deliveryStatusToFormValue } from "@/components/procurement/delivery-status-form";
import { sendDeliveryDispatchNotification } from "@/utils/delivery-dispatch-email";
import { runDeliveryReminderSweep } from "@/utils/delivery-status-reminders";
import {
  applyShipmentStatusToActualDate,
  firstDeliveryStatusFormError,
  getDeliveryStatus,
  isDeliveryStatusPersisted,
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
  const trackingOnly = isDeliveryStatusPersisted(challan.id);

  if (!trackingOnly) {
    const errors = validateDeliveryStatusForm(form);
    const message = firstDeliveryStatusFormError(errors);
    if (message) {
      return { ok: false, message, fieldErrors: errors };
    }
  }

  const saved = getDeliveryStatus(challan.id);
  const base = trackingOnly && saved ? deliveryStatusToFormValue(saved) : form;
  const normalized = applyShipmentStatusToActualDate({
    ...base,
    shipmentStatus: form.shipmentStatus,
  });

  upsertDeliveryStatus({
    challanId: challan.id,
    ...normalized,
  });
  runDeliveryReminderSweep();

  if (!trackingOnly) {
    const email = await sendDeliveryDispatchNotification(challan, normalized);
    if (!email.ok) {
      return {
        ok: true,
        trackingOnly: false,
        emailWarning: email.message ?? "Unknown error",
      };
    }
  }

  return { ok: true, trackingOnly };
}
