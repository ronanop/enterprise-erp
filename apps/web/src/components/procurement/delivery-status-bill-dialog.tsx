"use client";

import { useEffect, useMemo, useState } from "react";
import { Receipt } from "lucide-react";

import { ConfirmDialog } from "@/components/finance/journals/confirm-dialog";
import {
  FinanceField,
  FinanceSelect,
  FinanceTextarea,
} from "@/components/finance/journals/finance-form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fileToBase64 } from "@/services/sales-crm-service";
import {
  challanDeliveredQuantity,
  deriveBillStatusFromQuantities,
  formatDeliveryBillStatusLabel,
  resolveDeliveryBillStatus,
  type ActiveDeliveryBillStatus,
} from "@/utils/delivery-challan-bill";
import {
  getDeliveryChallan,
  type DeliveryChallanRecord,
} from "@/utils/delivery-challan-storage";
import {
  getDeliveryStatus,
  openStoredDeliveryFile,
  resolveDeliveryStatusForChallan,
  upsertDeliveryChallanBilling,
  type DeliveryStatusAttachment,
} from "@/utils/delivery-status-storage";
import { syncOvfTimelineForDeliveryStatus } from "@/utils/ovf-timeline-sync";

type DeliveryStatusBillDialogProps = {
  open: boolean;
  challanId: string | null;
  onClose: () => void;
  onSaved?: () => void;
};

export function DeliveryStatusBillDialog({
  open,
  challanId,
  onClose,
  onSaved,
}: DeliveryStatusBillDialogProps) {
  const [challan, setChallan] = useState<DeliveryChallanRecord | null>(null);
  const [mode, setMode] = useState<"partially_billed" | "fully_billed">("fully_billed");
  const [billedQty, setBilledQty] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState("");
  const [document, setDocument] = useState<DeliveryStatusAttachment | null>(null);
  const [remarks, setRemarks] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const challanQty = useMemo(
    () => (challan ? challanDeliveredQuantity(challan) : 0),
    [challan],
  );

  useEffect(() => {
    if (!open || !challanId) {
      setChallan(null);
      setError(null);
      setBusy(false);
      return;
    }
    const row = getDeliveryChallan(challanId);
    setChallan(row);
    if (!row) {
      setError("Delivery challan not found.");
      return;
    }
    const status = resolveDeliveryStatusForChallan(row);
    const bill = resolveDeliveryBillStatus(status, challanDeliveredQuantity(row));
    const total = challanDeliveredQuantity(row);
    setMode(bill === "partially_billed" ? "partially_billed" : "fully_billed");
    setBilledQty(
      status.billedQuantity?.trim() ||
        (bill === "fully_billed" || !status.billedQuantity ? String(total || "") : status.billedQuantity),
    );
    setInvoiceNumber(status.billInvoiceNumber || status.cacheInvoiceNumber || "");
    setInvoiceDate(status.billInvoiceDate || new Date().toISOString().slice(0, 10));
    setDocument(status.billDocument || status.cacheInvoiceDocument || null);
    setRemarks(status.billRemarks || "");
    setError(null);
  }, [open, challanId]);

  useEffect(() => {
    if (!open || !challan) return;
    if (mode === "fully_billed" && challanQty > 0) {
      setBilledQty(String(challanQty));
    }
  }, [mode, open, challan, challanQty]);

  async function onPickFile(fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file) return;
    const contentBase64 = await fileToBase64(file);
    setDocument({
      fileName: file.name,
      contentBase64,
      contentType: file.type || "application/octet-stream",
    });
  }

  function onConfirm() {
    if (!challan || busy) return;
    const qty = Number.parseFloat(String(billedQty).replace(/,/g, ""));
    if (!Number.isFinite(qty) || qty < 0) {
      setError("Enter a valid billed quantity.");
      return;
    }
    if (mode === "partially_billed" && qty <= 0) {
      setError("Partial billing needs a quantity greater than zero.");
      return;
    }
    if (mode === "partially_billed" && challanQty > 0 && qty + 1e-9 >= challanQty) {
      setError("For full quantity, choose Fully billed.");
      return;
    }
    if (mode === "fully_billed" && challanQty > 0 && qty + 1e-9 < challanQty) {
      setError("Fully billed quantity should cover the full challan quantity.");
      return;
    }
    if (!invoiceNumber.trim()) {
      setError("Invoice number is required when billing.");
      return;
    }

    const nextStatus: ActiveDeliveryBillStatus =
      mode === "fully_billed"
        ? "fully_billed"
        : deriveBillStatusFromQuantities(qty, challanQty);

    setBusy(true);
    setError(null);
    try {
      const previous = challan ? getDeliveryStatus(challan.id) : null;
      const saved = upsertDeliveryChallanBilling({
        challanId: challan.id,
        billStatus: nextStatus,
        billedQuantity: String(mode === "fully_billed" ? Math.max(qty, challanQty || qty) : qty),
        billInvoiceNumber: invoiceNumber.trim(),
        billInvoiceDate: invoiceDate.trim(),
        billDocument: document,
        billRemarks: remarks.trim(),
      });
      if (!saved) {
        setError("Could not save bill status.");
        setBusy(false);
        return;
      }
      if (challan) {
        syncOvfTimelineForDeliveryStatus(challan, saved, previous);
      }
      onSaved?.();
      onClose();
    } catch {
      setError("Could not save billing. Try again.");
      setBusy(false);
    }
  }

  if (!open) return null;

  const currentBill = challan
    ? formatDeliveryBillStatusLabel(
        resolveDeliveryBillStatus(
          resolveDeliveryStatusForChallan(challan),
          challanDeliveredQuantity(challan),
        ),
      )
    : "—";

  return (
    <ConfirmDialog
      open={open}
      title="Bill taken"
      description="DC is delivery without a bill. When you receive the customer bill, record it here — even after delivery status or installation."
      confirmLabel={busy ? "Saving…" : "Save bill status"}
      cancelLabel="Cancel"
      busy={busy}
      confirmDisabled={busy || !challan}
      contentClassName="max-w-lg"
      onConfirm={onConfirm}
      onCancel={onClose}
    >
      <div className="space-y-3 text-sm">
        {error ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-destructive">
            {error}
          </div>
        ) : null}

        <div className="grid gap-2 rounded-md border border-border bg-muted/20 p-3 sm:grid-cols-2">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Challan
            </div>
            <div className="font-medium tabular-nums">{challan?.challanNumber || "—"}</div>
          </div>
          <div>
            <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Current bill status
            </div>
            <div className="font-medium">{currentBill}</div>
          </div>
          <div>
            <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              DC quantity
            </div>
            <div className="font-medium tabular-nums">{challanQty || "—"}</div>
          </div>
          <div>
            <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              PO
            </div>
            <div className="font-medium tabular-nums">
              {challan?.companyPoNumber || challan?.purchaseOrderNumber || "—"}
            </div>
          </div>
        </div>

        <FinanceField label="Bill coverage *">
          <FinanceSelect
            value={mode}
            onChange={(e) =>
              setMode(e.target.value === "partially_billed" ? "partially_billed" : "fully_billed")
            }
          >
            <option value="fully_billed">Fully billed</option>
            <option value="partially_billed">Partially billed</option>
          </FinanceSelect>
        </FinanceField>

        <div className="grid gap-3 sm:grid-cols-2">
          <FinanceField label="Billed quantity *">
            <Input
              value={billedQty}
              onChange={(e) => setBilledQty(e.target.value)}
              className="h-9"
              inputMode="decimal"
              disabled={mode === "fully_billed" && challanQty > 0}
            />
          </FinanceField>
          <FinanceField label="Invoice date">
            <Input
              type="date"
              value={invoiceDate}
              onChange={(e) => setInvoiceDate(e.target.value)}
              className="h-9"
            />
          </FinanceField>
        </div>

        <FinanceField label="Invoice number *">
          <Input
            value={invoiceNumber}
            onChange={(e) => setInvoiceNumber(e.target.value)}
            className="h-9"
            placeholder="Customer / Cache invoice no."
          />
        </FinanceField>

        <FinanceField label="Invoice document">
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium transition-colors duration-200 hover:bg-muted">
              <Receipt className="size-3.5" />
              Upload
              <input
                type="file"
                className="sr-only"
                onChange={(e) => void onPickFile(e.target.files)}
              />
            </label>
            {document?.fileName ? (
              <>
                <button
                  type="button"
                  className="cursor-pointer text-xs text-[#0369A1] underline-offset-2 transition-colors duration-150 hover:underline"
                  onClick={() => openStoredDeliveryFile(document)}
                >
                  {document.fileName}
                </button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 cursor-pointer px-2 text-xs"
                  onClick={() => setDocument(null)}
                >
                  Clear
                </Button>
              </>
            ) : (
              <span className="text-xs text-muted-foreground">Optional</span>
            )}
          </div>
        </FinanceField>

        <FinanceField label="Remarks">
          <FinanceTextarea
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            rows={2}
            placeholder="e.g. billed after delivery / payment pending"
          />
        </FinanceField>
      </div>
    </ConfirmDialog>
  );
}
