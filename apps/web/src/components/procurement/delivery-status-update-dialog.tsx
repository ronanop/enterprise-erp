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
  resolveDeliveryStatusForChallan,
  validateDeliveryStatusForm,
  type DeliveryStatusFormErrors,
} from "@/utils/delivery-status-storage";
import { persistDeliveryStatusFromForm } from "@/utils/delivery-status-persist";

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

  useEffect(() => {
    if (!open || !challan) {
      setForm(null);
      setFieldErrors({});
      setError(null);
      return;
    }
    const status = resolveDeliveryStatusForChallan(challan);
    setForm(deliveryStatusToFormValue(status));
  }, [open, challan]);

  async function onConfirm() {
    if (!challan || !form || saving) return;
    const errors = validateDeliveryStatusForm(form);
    setFieldErrors(errors);
    if (Object.values(errors).some(Boolean)) {
      setError(Object.values(errors).find(Boolean) ?? "Complete the required fields.");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const result = await persistDeliveryStatusFromForm(challan, form);
      if (!result.ok) {
        setFieldErrors(result.fieldErrors ?? {});
        setError(result.message);
        setSaving(false);
        return;
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
    challan.companyPoNumber || challan.purchaseOrderNumber,
    formatChallanGrnSummary(challan),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <ConfirmDialog
      open={open}
      title="Update delivery status"
      description={subtitle}
      confirmLabel="Save"
      cancelLabel="Cancel"
      busy={saving}
      contentClassName="max-w-2xl"
      onConfirm={() => void onConfirm()}
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
            fieldErrors={fieldErrors}
          />
        </div>
      ) : null}
    </ConfirmDialog>
  );
}
