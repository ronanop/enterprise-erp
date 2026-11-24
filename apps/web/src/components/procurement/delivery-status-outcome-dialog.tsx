"use client";

import { useEffect, useState } from "react";
import { Upload } from "lucide-react";

import { ConfirmDialog } from "@/components/finance/journals/confirm-dialog";
import {
  FinanceField,
  FinanceSelect,
  FinanceTextarea,
} from "@/components/finance/journals/finance-form-field";
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
  isDelayedShipmentStatus,
  isFailedShipmentStatus,
  openStoredDeliveryFile,
  resolveDeliveryStatusForChallan,
  type DeliveryStatusAttachment,
} from "@/utils/delivery-status-storage";

type DeliveryOutcome = "" | "Delivered" | "Failed delivery" | "Delayed";

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
  const [outcome, setOutcome] = useState<DeliveryOutcome>("");
  const [remarks, setRemarks] = useState("");
  const [requiresInstallation, setRequiresInstallation] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !challan) {
      setForm(null);
      setOutcome("");
      setRemarks("");
      setRequiresInstallation(false);
      setError(null);
      setSaving(false);
      return;
    }
    const status = resolveDeliveryStatusForChallan(challan);
    const seeded = deliveryStatusToFormValue(status);
    setForm(seeded);
    setRemarks(seeded.remarks || "");
    if (isFailedShipmentStatus(seeded.shipmentStatus)) {
      setOutcome("Failed delivery");
      setRequiresInstallation(false);
    } else if (isDelayedShipmentStatus(seeded.shipmentStatus)) {
      setOutcome("Delayed");
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

  const alreadyDelivered =
    Boolean(form) &&
    (form!.shipmentStatus === "Delivered" ||
      Boolean(form!.actualDeliveryDate?.trim()));
  const needsRemarks = outcome === "Failed delivery" || outcome === "Delayed";

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
    if (
      outcome !== "Delivered" &&
      outcome !== "Failed delivery" &&
      outcome !== "Delayed"
    ) {
      setError("Select Delivered, Delayed, or Failed.");
      return;
    }
    if (needsRemarks && !remarks.trim()) {
      setError("Enter remarks for delayed or failed delivery.");
      return;
    }
    if (
      !alreadyDelivered &&
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
        actualDeliveryDate:
          outcome === "Failed delivery" || outcome === "Delayed"
            ? ""
            : form.actualDeliveryDate,
        requiresInstallation: outcome === "Delivered" ? requiresInstallation : false,
        remarks: needsRemarks ? remarks.trim() : form.remarks || "",
      };
      const result = await persistDeliveryStatusFromForm(challan, next);
      if (!result.ok) {
        setError(result.message);
        setSaving(false);
        return;
      }
      let message: string;
      if (alreadyDelivered) {
        message = requiresInstallation
          ? "Updated. Open Procurement → Installation to fill site details."
          : "Installation flag updated.";
      } else if (outcome === "Failed delivery") {
        message = "Marked as failed delivery.";
      } else if (outcome === "Delayed") {
        message = "Marked as delayed.";
      } else if (requiresInstallation) {
        message =
          "Marked delivered. Open Procurement → Installation to fill site details.";
      } else {
        message = "Marked delivered.";
      }
      if (!alreadyDelivered && result.ok && result.deliveredEmailTo) {
        message = result.emailWarning
          ? `${message} Customer email failed (${result.deliveredEmailTo}): ${result.emailWarning}`
          : `${message} Customer notified at ${result.deliveredEmailTo}.`;
      } else if (!alreadyDelivered && result.ok && result.emailWarning) {
        message = `${message} Customer email failed: ${result.emailWarning}`;
      }
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

        {alreadyDelivered ? (
          <p className="text-xs text-muted-foreground">
            This delivery is already marked delivered. Toggle installation if needed.
          </p>
        ) : (
          <>
            <FinanceField label="Delivery outcome *">
              <FinanceSelect
                value={outcome}
                onChange={(e) => {
                  const next = e.target.value;
                  if (next === "Delivered") {
                    setOutcome("Delivered");
                    return;
                  }
                  if (next === "Delayed") {
                    setOutcome("Delayed");
                    setRequiresInstallation(false);
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
                <option value="Delayed">Delayed</option>
                <option value="Failed delivery">Failed</option>
              </FinanceSelect>
            </FinanceField>

            {needsRemarks ? (
              <FinanceField label="Remarks *">
                <FinanceTextarea
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  rows={3}
                  placeholder={
                    outcome === "Delayed"
                      ? "Explain the delay for the customer…"
                      : "Explain why delivery failed…"
                  }
                  className="cursor-text transition-colors duration-200"
                />
              </FinanceField>
            ) : null}

            {outcome === "Delivered" ? (
              <>
                <p className="text-xs text-muted-foreground">
                  Delivered date is assigned automatically when you save. Customer is emailed the
                  outcome.
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
                            onClick={() =>
                              document.getElementById("outcome-pod-document")?.click()
                            }
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
                          onClick={() =>
                            document.getElementById("outcome-pod-document")?.click()
                          }
                        >
                          <Upload className="size-3.5" />
                          Upload
                        </Button>
                      )}
                    </div>
                  </div>
                ) : null}
              </>
            ) : null}

            {needsRemarks ? (
              <p className="text-xs text-muted-foreground">
                Saving emails the customer this outcome and includes your remarks.
              </p>
            ) : null}
          </>
        )}

        {outcome === "Delivered" ? (
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
        ) : null}
      </div>
    </ConfirmDialog>
  );
}
