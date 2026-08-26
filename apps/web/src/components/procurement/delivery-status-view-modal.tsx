"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FileText } from "lucide-react";

import { ConfirmDialog } from "@/components/finance/journals/confirm-dialog";
import { DeliveryChallanReadOnlyPanel } from "@/components/procurement/delivery-challan-readonly-panel";
import { DeliverySectionCard } from "@/components/procurement/delivery-section-card";
import {
  DeliveryStatusForm,
  deliveryStatusToFormValue,
  type DeliveryStatusFormValue,
} from "@/components/procurement/delivery-status-form";
import { Button } from "@/components/ui/button";
import type { DeliveryChallanRecord } from "@/utils/delivery-challan-storage";
import {
  deliveryStatusUiMode,
  resolveDeliveryStatusForChallan,
  validateDeliveryStatusForm,
  type DeliveryStatusFormErrors,
} from "@/utils/delivery-status-storage";
import { persistDeliveryStatusFromForm } from "@/utils/delivery-status-persist";
import { deliveryStatusUpdateHref } from "@/utils/delivery-status-routes";

type DeliveryStatusViewModalProps = {
  open: boolean;
  challan: DeliveryChallanRecord | null;
  onClose: () => void;
  onSaved?: (message: string) => void;
};

export function DeliveryStatusViewModal({
  open,
  challan,
  onClose,
  onSaved,
}: DeliveryStatusViewModalProps) {
  const [form, setForm] = useState<DeliveryStatusFormValue | null>(null);
  const [formPhase, setFormPhase] = useState<"initial" | "tracking">("initial");
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
    setFormPhase(deliveryStatusUiMode(status));
  }, [open, challan]);

  async function onConfirm() {
    if (!challan || !form || saving) return;
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
      onSaved?.("Delivery status saved.");
      onClose();
    } catch {
      setError("Could not save delivery status. Try again.");
      setSaving(false);
    }
  }

  if (!challan) return null;

  return (
    <ConfirmDialog
      open={open}
      title="Delivery status"
      description={challan.companyPoNumber || challan.purchaseOrderNumber}
      confirmLabel="Save"
      cancelLabel="Cancel"
      busy={saving}
      contentClassName="max-w-3xl"
      onConfirm={() => void onConfirm()}
      onCancel={onClose}
    >
      <div className="mt-4 space-y-4">
        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <DeliverySectionCard title="From delivery challan" icon={FileText}>
          <DeliveryChallanReadOnlyPanel challan={challan} />
        </DeliverySectionCard>

        {form ? (
          <DeliveryStatusForm
            mode={formPhase}
            value={form}
            onChange={(next) => {
              setForm(next);
              if (Object.keys(fieldErrors).length > 0) {
                setFieldErrors(validateDeliveryStatusForm(next));
              }
            }}
            fieldErrors={fieldErrors}
          />
        ) : null}

        <div className="flex justify-end">
          <Link href={deliveryStatusUpdateHref(challan.id)} onClick={onClose}>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="cursor-pointer transition-colors duration-200"
            >
              Open full page
            </Button>
          </Link>
        </div>
      </div>
    </ConfirmDialog>
  );
}
