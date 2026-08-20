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
import { resolveDeliveryStatusForChallan } from "@/utils/delivery-status-storage";
import { persistDeliveryStatusFromForm } from "@/utils/delivery-status-persist";

type DeliveryStatusShipmentModalProps = {
  open: boolean;
  challan: DeliveryChallanRecord | null;
  onClose: () => void;
  onSaved?: (message: string) => void;
};

export function DeliveryStatusShipmentModal({
  open,
  challan,
  onClose,
  onSaved,
}: DeliveryStatusShipmentModalProps) {
  const [form, setForm] = useState<DeliveryStatusFormValue | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !challan) {
      setForm(null);
      setError(null);
      return;
    }
    const status = resolveDeliveryStatusForChallan(challan);
    setForm(deliveryStatusToFormValue(status));
  }, [open, challan]);

  async function onConfirm() {
    if (!challan || !form || saving) return;
    setError(null);
    setSaving(true);
    try {
      const result = await persistDeliveryStatusFromForm(challan, form);
      if (!result.ok) {
        setError(result.message);
        setSaving(false);
        return;
      }
      onSaved?.("Delivery status saved.");
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
      busy={saving}
      contentClassName="max-w-lg"
      onConfirm={() => void onConfirm()}
      onCancel={onClose}
    >
      {form ? (
        <div className="mt-4">
          {error ? <p className="mb-3 text-sm text-destructive">{error}</p> : null}
          <DeliveryStatusForm value={form} onChange={setForm} />
        </div>
      ) : null}
    </ConfirmDialog>
  );
}
