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
  isDeliveryStatusPersisted,
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
  const [fieldErrors, setFieldErrors] = useState<DeliveryStatusFormErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const trackingOnly = challan ? isDeliveryStatusPersisted(challan.id) : false;

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
    if (!trackingOnly) {
      onClose();
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
      onSaved?.("Shipment status updated.");
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
      title="Delivery challan"
      description={challan.challanNumber}
      confirmLabel={trackingOnly ? "Save status" : "Close"}
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

        {form && trackingOnly ? (
          <>
            <p className="text-xs text-muted-foreground">
              Update shipment status below and save.
            </p>
            <DeliveryStatusForm
              value={form}
              onChange={(next) => {
                setForm(next);
                if (Object.keys(fieldErrors).length > 0) {
                  setFieldErrors(validateDeliveryStatusForm(next));
                }
              }}
              showLocationSection={false}
              fieldErrors={fieldErrors}
              mode="tracking"
            />
          </>
        ) : null}

        {form && !trackingOnly ? (
          <div className="flex justify-end">
            <Link href={deliveryStatusUpdateHref(challan.id)} onClick={onClose}>
              <Button type="button" size="sm" className="cursor-pointer transition-colors duration-200">
                Set up delivery status
              </Button>
            </Link>
          </div>
        ) : null}
      </div>
    </ConfirmDialog>
  );
}
