"use client";

import { useEffect, useState } from "react";
import { Upload } from "lucide-react";

import { ConfirmDialog } from "@/components/finance/journals/confirm-dialog";
import { FinanceField, FinanceSelect } from "@/components/finance/journals/finance-form-field";
import {
  deliveryStatusToFormValue,
  type DeliveryStatusFormValue,
} from "@/components/procurement/delivery-status-form";
import { Button } from "@/components/ui/button";
import type { DeliveryChallanRecord } from "@/utils/delivery-challan-storage";
import { formatChallanGrnSummary } from "@/utils/delivery-challan-storage";
import { persistDeliveryStatusFromForm } from "@/utils/delivery-status-persist";
import { fileToBase64 } from "@/services/sales-crm-service";
import {
  isFailedShipmentStatus,
  openStoredDeliveryFile,
  resolveDeliveryStatusForChallan,
  type DeliveryStatusAttachment,
} from "@/utils/delivery-status-storage";

type DeliveryStatusOutcomeDialogProps = {
  open: boolean;
  challan: DeliveryChallanRecord | null;
  onClose: () => void;
  onSaved?: (message: string) => void;
};

export function DeliveryStatusOutcomeDialog({
  open,
  challan,
  onClose,
  onSaved,
}: DeliveryStatusOutcomeDialogProps) {
  const [form, setForm] = useState<DeliveryStatusFormValue | null>(null);
  const [outcome, setOutcome] = useState<"" | "Delivered" | "Failed delivery">("");
  const [requiresInstallation, setRequiresInstallation] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !challan) {
      setForm(null);
      setOutcome("");
      setRequiresInstallation(false);
      setError(null);
      setSaving(false);
      return;
    }
    const status = resolveDeliveryStatusForChallan(challan);
    const seeded = deliveryStatusToFormValue(status);
    setForm(seeded);
    if (isFailedShipmentStatus(seeded.shipmentStatus)) {
      setOutcome("Failed delivery");
      setRequiresInstallation(false);
    } else if (
      seeded.shipmentStatus === "Delivered" ||
      Boolean(seeded.actualDeliveryDate?.trim())
    ) {
      setOutcome("Delivered");
      setRequiresInstallation(Boolean(seeded.requiresInstallation));
    } else {
      setOutcome("");
      setRequiresInstallation(false);
    }
  }, [open, challan]);

  async function onPickPod(fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file || !form) return;
    const contentBase64 = await fileToBase64(file);
    setForm({
      ...form,
      podDocument: {
        fileName: file.name,
        contentBase64,
        contentType: file.type || "application/octet-stream",
      } satisfies DeliveryStatusAttachment,
    });
  }

  async function onConfirm() {
    if (!challan || !form || saving) return;
    if (outcome !== "Delivered" && outcome !== "Failed delivery") {
      setError("Select Delivered or Failed.");
      return;
    }
    if (
      outcome === "Delivered" &&
      form.deliveryMode === "hand" &&
      !form.podDocument?.fileName
    ) {
      setError("POD attachment is required when marking delivered for by-hand.");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const next: DeliveryStatusFormValue = {
        ...form,
        shipmentStatus: outcome,
        actualDeliveryDate: outcome === "Failed delivery" ? "" : form.actualDeliveryDate,
        requiresInstallation: outcome === "Delivered" ? requiresInstallation : false,
      };
      const result = await persistDeliveryStatusFromForm(challan, next);
      if (!result.ok) {
        setError(result.message);
        setSaving(false);
        return;
      }
      const message =
        outcome === "Failed delivery"
          ? "Marked as failed delivery."
          : requiresInstallation
            ? "Marked delivered. Open Procurement → Installation to fill site details."
            : "Marked delivered.";
      onSaved?.(message);
      onClose();
    } catch {
      setError("Could not update delivery status. Try again.");
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
      title="Update status"
      description={subtitle}
      confirmLabel="Save"
      cancelLabel="Cancel"
      busy={saving}
      confirmDisabled={!outcome}
      contentClassName="max-w-md"
      onConfirm={() => void onConfirm()}
      onCancel={onClose}
    >
      <div className="mt-4 space-y-3">
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <FinanceField label="Delivery outcome *">
          <FinanceSelect
            value={outcome}
            onChange={(e) => {
              const next = e.target.value;
              if (next === "Delivered") {
                setOutcome("Delivered");
                return;
              }
              if (next === "Failed delivery") {
                setOutcome("Failed delivery");
                setRequiresInstallation(false);
                return;
              }
              setOutcome("");
              setRequiresInstallation(false);
            }}
            className="h-8 cursor-pointer transition-colors duration-200"
          >
            <option value="">Select…</option>
            <option value="Delivered">Delivered</option>
            <option value="Failed delivery">Failed</option>
          </FinanceSelect>
        </FinanceField>
        {outcome === "Delivered" ? (
          <>
            <p className="text-xs text-muted-foreground">
              Delivered date is assigned automatically when you save.
            </p>
            {form?.deliveryMode === "hand" ? (
              <div className="space-y-1">
                <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                  POD attachment *
                </span>
                <div className="flex min-w-0 items-center gap-2">
                  <input
                    id="outcome-pod-document"
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,.webp"
                    className="sr-only"
                    onChange={(e) => {
                      void onPickPod(e.target.files);
                      e.currentTarget.value = "";
                    }}
                  />
                  {form.podDocument ? (
                    <>
                      <button
                        type="button"
                        className="min-w-0 cursor-pointer truncate text-left text-sm font-medium text-[#0369A1] transition-colors duration-200 hover:underline"
                        onClick={() => openStoredDeliveryFile(form.podDocument!)}
                      >
                        {form.podDocument.fileName}
                      </button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 shrink-0 cursor-pointer transition-colors duration-200"
                        onClick={() => document.getElementById("outcome-pod-document")?.click()}
                      >
                        Replace
                      </Button>
                    </>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 cursor-pointer gap-1.5 transition-colors duration-200"
                      onClick={() => document.getElementById("outcome-pod-document")?.click()}
                    >
                      <Upload className="size-3.5" />
                      Upload
                    </Button>
                  )}
                </div>
              </div>
            ) : null}
            <label className="flex cursor-pointer items-start gap-2.5 rounded-md border border-border/80 bg-muted/20 px-3 py-2.5 text-sm transition-colors duration-200 hover:bg-muted/35">
              <input
                type="checkbox"
                className="mt-0.5 size-4 cursor-pointer accent-slate-900"
                checked={requiresInstallation}
                onChange={(e) => setRequiresInstallation(e.target.checked)}
              />
              <span>
                <span className="font-medium text-foreground">Requires installation</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  After save, fill site details under Procurement → Installation.
                </span>
              </span>
            </label>
          </>
        ) : null}
      </div>
    </ConfirmDialog>
  );
}
