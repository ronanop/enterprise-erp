"use client";

import { useEffect, useState } from "react";

import { ConfirmDialog } from "@/components/finance/journals/confirm-dialog";
import {
  DeliveryStatusForm,
  deliveryStatusToFormValue,
  type DeliveryStatusFormValue,
} from "@/components/procurement/delivery-status-form";
import type { DeliveryChallanRecord } from "@/utils/delivery-challan-storage";
import { formatChallanGrnSummary } from "@/utils/delivery-challan-storage";
import {
  applyShipmentStatusToActualDate,
  firstDeliveryStatusFormError,
  getDeliveryStatus,
  isDeliveryStatusPersisted,
  resolveDeliveryStatusForChallan,
  upsertDeliveryStatus,
  validateDeliveryStatusForm,
  type DeliveryStatusFormErrors,
} from "@/utils/delivery-status-storage";
import { runDeliveryReminderSweep } from "@/utils/delivery-status-reminders";
import { sendDeliveryDispatchNotification } from "@/utils/delivery-dispatch-email";

type DeliveryStatusUpdateDialogProps = {
  open: boolean;
  challan: DeliveryChallanRecord | null;
  onClose: () => void;
  onSaved?: () => void;
};

export function DeliveryStatusUpdateDialog({
  open,
  challan,
  onClose,
  onSaved,
}: DeliveryStatusUpdateDialogProps) {
  const [form, setForm] = useState<DeliveryStatusFormValue | null>(null);
  const [fieldErrors, setFieldErrors] = useState<DeliveryStatusFormErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const trackingOnly = challan ? isDeliveryStatusPersisted(challan.id) : false;

  useEffect(() => {
    if (!open || !challan) {
      setForm(null);
      return;
    }
    const status = resolveDeliveryStatusForChallan(challan);
    setForm(deliveryStatusToFormValue(status));
  }, [open, challan]);

  async function onConfirm() {
    if (!challan || !form || saving) return;
    if (!trackingOnly) {
      const errors = validateDeliveryStatusForm(form);
      setFieldErrors(errors);
      const message = firstDeliveryStatusFormError(errors);
      if (message) {
        setError(message);
        return;
      }
    }
    setError(null);
    setSaving(true);
    try {
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
        await sendDeliveryDispatchNotification(challan, normalized);
      }
      onSaved?.();
      onClose();
    } catch {
      setError("Could not save delivery status. Try again.");
      setSaving(false);
    }
  }

  if (!challan) return null;

  const subtitle = [
    challan.purchaseOrderNumber,
    formatChallanGrnSummary(challan),
    challan.challanNumber,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <ConfirmDialog
      open={open}
      title="Update delivery status"
      description={subtitle}
      confirmLabel="Save status"
      cancelLabel="Cancel"
      contentClassName="max-w-2xl"
      onConfirm={onConfirm}
      onCancel={onClose}
    >
      {form ? (
        <div className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1">
          {error ? (
            <p className="mb-3 text-sm text-destructive">{error}</p>
          ) : null}
          <DeliveryStatusForm
            value={form}
            onChange={(next) => {
              setForm(next);
              if (Object.keys(fieldErrors).length > 0) {
                setFieldErrors(validateDeliveryStatusForm(next));
              }
            }}
            compact
            fieldErrors={fieldErrors}
            mode={trackingOnly ? "tracking" : "initial"}
          />
        </div>
      ) : null}
    </ConfirmDialog>
  );
}
