import type { DeliveryChallanRecord } from "@/utils/delivery-challan-storage";
import type { DeliveryStatusFormValue } from "@/components/procurement/delivery-status-form";
import {
  sendDeliveryDispatchNotification,
  sendDeliveryOutcomeNotification,
} from "@/utils/delivery-dispatch-email";
import { runDeliveryReminderSweep } from "@/utils/delivery-status-reminders";
import {
  deriveDeliveryStatusLabel,
  firstDeliveryStatusFormError,
  getDeliveryStatus,
  isDelayedShipmentStatus,
  isFailedShipmentStatus,
  stampDeliveredDate,
  upsertDeliveryStatus,
  validateDeliveryStatusForm,
  type DeliveryStatusFormErrors,
} from "@/utils/delivery-status-storage";
import { syncOvfTimelineForDeliveryStatus } from "@/utils/ovf-timeline-sync";

export type PersistDeliveryStatusResult =
  | { ok: true; trackingOnly: boolean; emailWarning?: string; emailSkipped?: boolean; deliveredEmailTo?: string }
  | { ok: false; message: string; fieldErrors?: DeliveryStatusFormErrors };

export async function persistDeliveryStatusFromForm(
  challan: DeliveryChallanRecord,
  form: DeliveryStatusFormValue,
): Promise<PersistDeliveryStatusResult> {
  const requireDispatch = challan.grnKind !== "billing";
  const errors = validateDeliveryStatusForm(form, { requireDispatch });
  const message = firstDeliveryStatusFormError(errors);
  if (message) {
    return { ok: false, message, fieldErrors: errors };
  }

  const existing = getDeliveryStatus(challan.id);
  const failed = isFailedShipmentStatus(form.shipmentStatus);
  const delayed = isDelayedShipmentStatus(form.shipmentStatus);
  const markingDelivered =
    !failed &&
    !delayed &&
    (form.shipmentStatus.trim() === "Delivered" ||
      Boolean(form.actualDeliveryDate?.trim()));
  const actualDeliveryDate =
    failed || delayed
      ? ""
      : markingDelivered
        ? stampDeliveredDate(form.dispatchDate, form.actualDeliveryDate)
        : form.actualDeliveryDate?.trim() || "";
  const shipmentStatus = failed
    ? "Failed delivery"
    : delayed
      ? "Delayed"
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
    // Preserve billing recorded later - delivery save must not wipe it.
    billStatus: existing?.billStatus ?? form.billStatus ?? "unbilled",
    billedQuantity: existing?.billedQuantity ?? form.billedQuantity ?? "",
    billInvoiceNumber: existing?.billInvoiceNumber ?? form.billInvoiceNumber ?? "",
    billInvoiceDate: existing?.billInvoiceDate ?? form.billInvoiceDate ?? "",
    billDocument: existing?.billDocument ?? form.billDocument ?? null,
    billRemarks: existing?.billRemarks ?? form.billRemarks ?? "",
    billedAt: existing?.billedAt ?? form.billedAt ?? "",
    outForDeliveryEmailSentAt:
      (existing?.outForDeliveryEmailSentAt || form.outForDeliveryEmailSentAt || "").trim(),
    outcomeEmailSentAt:
      (existing?.outcomeEmailSentAt || form.outcomeEmailSentAt || "").trim(),
    outcomeEmailKind:
      (existing?.outcomeEmailKind || form.outcomeEmailKind || "").trim(),
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
  syncOvfTimelineForDeliveryStatus(challan, {
    ...normalized,
    billStatus,
    requiresInstallation: delivered ? Boolean(normalized.requiresInstallation) : false,
    updatedAt: new Date().toISOString(),
  }, existing);
  runDeliveryReminderSweep();

  const outcomeToEmail: "Delivered" | "Failed delivery" | "Delayed" | null = delivered
    ? "Delivered"
    : failed
      ? "Failed delivery"
      : delayed
        ? "Delayed"
        : null;
  const outcomeEmailAlreadySent =
    Boolean((existing?.outcomeEmailSentAt || "").trim()) &&
    (existing?.outcomeEmailKind || "").trim() === (outcomeToEmail || "");

  if (outcomeToEmail && !outcomeEmailAlreadySent) {
    const email = await sendDeliveryOutcomeNotification(
      challan,
      normalized,
      outcomeToEmail,
    );
    if (!email.ok) {
      return {
        ok: true,
        trackingOnly: false,
        emailWarning: email.message ?? "Unknown error",
        deliveredEmailTo: email.to,
      };
    }
    if (email.skipped) {
      return { ok: true, trackingOnly: false, emailSkipped: true };
    }
    upsertDeliveryStatus({
      challanId: challan.id,
      ...normalized,
      billStatus,
      requiresInstallation: delivered ? Boolean(normalized.requiresInstallation) : false,
      outcomeEmailSentAt: new Date().toISOString(),
      outcomeEmailKind: outcomeToEmail,
    });
    return {
      ok: true,
      trackingOnly: false,
      deliveredEmailTo: email.to,
    };
  }

  // Out-for-delivery mail on first successful send (retries if prior SMTP attempt failed).
  const nowDispatched =
    normalized.deliveryMode === "hand" || normalized.deliveryMode === "courier";
  const dispatchEmailAlreadySent = Boolean(
    (existing?.outForDeliveryEmailSentAt || "").trim(),
  );
  if (!delivered && !failed && !delayed && nowDispatched && !dispatchEmailAlreadySent) {
    const email = await sendDeliveryDispatchNotification(challan, normalized);
    if (!email.ok) {
      return {
        ok: true,
        trackingOnly: false,
        emailWarning: email.message ?? "Unknown error",
      };
    }
    if (email.skipped) {
      return { ok: true, trackingOnly: false, emailSkipped: true };
    }
    upsertDeliveryStatus({
      challanId: challan.id,
      ...normalized,
      billStatus,
      requiresInstallation: delivered ? Boolean(normalized.requiresInstallation) : false,
      outForDeliveryEmailSentAt: new Date().toISOString(),
    });
  }

  return { ok: true, trackingOnly: false };
}
