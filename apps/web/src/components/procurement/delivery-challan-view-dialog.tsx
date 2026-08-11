"use client";

import { useMemo, useState } from "react";
import { FileDown, FileText, ListChecks, Package, PenLine, Truck, X } from "lucide-react";

import { DeliverySectionCard } from "@/components/procurement/delivery-section-card";
import { procurementUi } from "@/components/procurement/procurement-ui";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  buildDeliveryChallanPdfInputFromRecord,
  downloadDeliveryChallanPdf,
  openDeliveryChallanPdfPreview,
} from "@/utils/delivery-challan-pdf";
import {
  formatChallanGrnSummary,
  formatDeliveryModeLabel,
  type DeliveryChallanLine,
  type DeliveryChallanRecord,
} from "@/utils/delivery-challan-storage";
import { computeDeliveryChallanTaxSummary } from "@/utils/delivery-challan-totals";
import { formatInrPdf } from "@/utils/purchase-order-amount-words";

type DeliveryChallanViewDialogProps = {
  open: boolean;
  challan: DeliveryChallanRecord | null;
  onClose: () => void;
};

function DetailBlock({ label, value }: { label: string; value: string }) {
  const text = value.trim();
  return (
    <div className="space-y-0.5">
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div
        className={cn(
          "text-sm text-foreground",
          text.includes("\n") && "whitespace-pre-wrap",
        )}
      >
        {text || "—"}
      </div>
    </div>
  );
}

function ChallanItemsTable({ lines }: { lines: DeliveryChallanLine[] }) {
  const rows = lines.filter((line) => line.itemName.trim());
  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No line items on this challan.</p>
    );
  }

  return (
    <div className={procurementUi.tableShell}>
      <div className={procurementUi.tableScroll}>
        <table className={cn(procurementUi.table, "min-w-[720px]")}>
          <thead className={procurementUi.thead}>
            <tr>
              <th className={cn(procurementUi.th, "w-12")}>S.No</th>
              <th className={procurementUi.th}>Description</th>
              <th className={cn(procurementUi.th, "w-24")}>HSN / SAC</th>
              <th className={cn(procurementUi.th, "w-20 text-right")}>Qty</th>
              <th className={cn(procurementUi.th, "w-28 text-right")}>Rate</th>
              <th className={cn(procurementUi.th, "w-28 text-right")}>Amount</th>
              <th className={procurementUi.th}>Ship to</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((line, index) => {
              const qty = Number(line.quantitySent) || 0;
              const rate = Number(line.rate) || 0;
              const amount = qty * rate;
              return (
                <tr key={line.id} className={procurementUi.tr}>
                  <td className={cn(procurementUi.tdNumeric, "text-muted-foreground")}>
                    {index + 1}
                  </td>
                  <td className={procurementUi.td}>{line.itemName}</td>
                  <td className={procurementUi.tdMuted}>{line.hsnSac.trim() || "—"}</td>
                  <td className={cn(procurementUi.tdNumeric, "text-right")}>
                    {line.quantitySent.trim() || "—"}
                  </td>
                  <td className={cn(procurementUi.tdNumeric, "text-right")}>
                    {line.rate.trim() ? formatInrPdf(rate) : "—"}
                  </td>
                  <td className={cn(procurementUi.tdNumeric, "text-right font-medium")}>
                    {amount > 0 ? formatInrPdf(amount) : "—"}
                  </td>
                  <td className={procurementUi.tdMuted}>{line.shipTo.trim() || "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function DeliveryChallanViewDialog({
  open,
  challan,
  onClose,
}: DeliveryChallanViewDialogProps) {
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  const taxSummary = useMemo(() => {
    if (!challan) return null;
    return computeDeliveryChallanTaxSummary({
      lines: challan.lines,
      taxPct: Number(challan.taxPercentage) || 18,
      sourceOfSupply: challan.billingState,
      destinationOfSupply: challan.shippingState,
      formatAmount: formatInrPdf,
    });
  }, [challan]);

  if (!open || !challan) return null;

  const pdfInput = buildDeliveryChallanPdfInputFromRecord(challan);
  const grnLabel = formatChallanGrnSummary(challan);
  const itemsSourceLabel =
    challan.itemsSourceMode === "selected_grns"
      ? `Selected GRN(s): ${challan.selectedGrnNumbers.join(", ") || grnLabel}`
      : "All PO line items";

  async function onDownloadPdf() {
    setPdfBusy(true);
    setPdfError(null);
    try {
      await downloadDeliveryChallanPdf(pdfInput);
    } catch (err) {
      setPdfError(err instanceof Error ? err.message : "Failed to download PDF");
    } finally {
      setPdfBusy(false);
    }
  }

  async function onPreviewPdf() {
    setPdfBusy(true);
    setPdfError(null);
    try {
      await openDeliveryChallanPdfPreview(pdfInput);
    } catch (err) {
      setPdfError(err instanceof Error ? err.message : "Failed to open PDF preview");
    } finally {
      setPdfBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="delivery-challan-view-title"
        className="flex max-h-[min(90vh,880px)] w-full max-w-3xl flex-col rounded-xl border border-border/80 bg-card shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border/60 px-5 py-4">
          <div className="min-w-0">
            <h2
              id="delivery-challan-view-title"
              className="text-sm font-medium tracking-tight text-foreground"
            >
              Delivery challan
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {challan.challanNumber}
              {challan.documentType ? ` · ${challan.documentType}` : ""}
              {challan.copyLabel ? ` · ${challan.copyLabel}` : ""}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 shrink-0 cursor-pointer"
            aria-label="Close"
            onClick={onClose}
          >
            <X className="size-4" />
          </Button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {pdfError ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {pdfError}
            </div>
          ) : null}

          <DeliverySectionCard title="Challan & purchase order" icon={FileText}>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <DetailBlock label="Challan number" value={challan.challanNumber} />
              <DetailBlock label="Challan date" value={challan.challanDate} />
              <DetailBlock label="PO number" value={challan.purchaseOrderNumber} />
              <DetailBlock label="PO date" value={challan.poDate} />
              <DetailBlock label="GRN" value={grnLabel} />
              <DetailBlock label="Vendor" value={challan.vendorName} />
              <DetailBlock label="Items source" value={itemsSourceLabel} />
            </div>
          </DeliverySectionCard>

          <DeliverySectionCard title="Entity" icon={Package}>
            <div className="grid gap-4 sm:grid-cols-2">
              <DetailBlock label="Entity name" value={challan.entityName} />
              <DetailBlock label="GST / registration" value={challan.entityGstBlock} />
              <div className="sm:col-span-2">
                <DetailBlock label="Address" value={challan.entityAddressBlock} />
              </div>
            </div>
          </DeliverySectionCard>

          <DeliverySectionCard title="Customer & delivery" icon={FileText}>
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <DetailBlock label="Customer name" value={challan.customerName} />
                <DetailBlock label="Customer GST no." value={challan.customerGstNo} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <DetailBlock label="Bill to" value={challan.customerBillTo} />
                <DetailBlock label="Ship to" value={challan.customerShipTo} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <DetailBlock label="Billing state" value={challan.billingState} />
                <DetailBlock label="Shipping state" value={challan.shippingState} />
              </div>
              <DetailBlock label="Kind attn / site contact" value={challan.kindAttn} />
            </div>
          </DeliverySectionCard>

          <DeliverySectionCard title="Items on challan" icon={ListChecks}>
            <ChallanItemsTable lines={challan.lines} />
          </DeliverySectionCard>

          {taxSummary ? (
            <DeliverySectionCard title="Tax summary" icon={ListChecks}>
              <div className="overflow-hidden rounded-md border border-border/80">
                <table className="w-full text-sm">
                  <tbody>
                    {taxSummary.rows.map((row) => (
                      <tr key={row.label} className="border-b border-border/60 last:border-0">
                        <td className="px-3 py-2 text-muted-foreground">
                          {row.label}
                          {row.rateLabel ? ` (${row.rateLabel})` : ""}
                        </td>
                        <td
                          className={cn(
                            "px-3 py-2 text-right tabular-nums",
                            row.emphasis && "font-medium text-foreground",
                          )}
                        >
                          {row.amount}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {challan.taxRemarks.trim() ? (
                <p className="mt-2 text-xs text-muted-foreground">{challan.taxRemarks}</p>
              ) : null}
            </DeliverySectionCard>
          ) : null}

          <DeliverySectionCard title="Transport" icon={Truck}>
            <div className="grid gap-4 sm:grid-cols-2">
              <DetailBlock
                label="Mode of delivery"
                value={formatDeliveryModeLabel(challan.deliveryMode)}
              />
              <DetailBlock label="Transport details" value={challan.transportDetails} />
              <DetailBlock label="Driver / vehicle" value={challan.driverVehicleDetails} />
            </div>
          </DeliverySectionCard>

          <DeliverySectionCard title="Prepared & signatures" icon={PenLine}>
            <div className="grid gap-4 sm:grid-cols-2">
              <DetailBlock label="Prepared by" value={challan.preparedBy} />
              <DetailBlock label="Delivered by" value={challan.deliveredBy} />
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <DetailBlock label="Sender signature" value={challan.senderSignature} />
              <DetailBlock label="Receiver signature" value={challan.receiverSignature} />
            </div>
          </DeliverySectionCard>
        </div>

        <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-border/60 px-5 py-4">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="cursor-pointer transition-colors duration-200"
            disabled={pdfBusy}
            onClick={() => void onPreviewPdf()}
          >
            Preview PDF
          </Button>
          <Button
            type="button"
            size="sm"
            className="cursor-pointer transition-colors duration-200"
            disabled={pdfBusy}
            onClick={() => void onDownloadPdf()}
          >
            <FileDown className="mr-1.5 size-3.5" />
            {pdfBusy ? "Working…" : "Download PDF"}
          </Button>
        </div>
      </div>
    </div>
  );
}
