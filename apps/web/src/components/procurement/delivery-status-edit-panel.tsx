"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, MapPinned, Package, Truck } from "lucide-react";

import { DeliveryStatusOutcomeDialog } from "@/components/procurement/delivery-status-outcome-dialog";
import { PageHeader } from "@/components/layout/page-header";
import { procurementUi } from "@/components/procurement/procurement-ui";
import {
  DeliveryStatusForm,
  deliveryStatusToFormValue,
  type AccountsInvoiceDocumentRef,
  type DeliveryStatusFormValue,
} from "@/components/procurement/delivery-status-form";
import { DeliverySectionCard } from "@/components/procurement/delivery-section-card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  getInvoiceGenerationTaskForBatch,
  getPurchaseOrder,
  listInvoiceGenerationTasksForOrder,
  listOrderReceiptBatches,
  listReceiptBatchAttachments,
  openReceiptBatchAttachment,
  type ProcInvoiceGenerationTask,
} from "@/services/procurement-service";
import {
  deliveryStatusGrnItemRowsFromChallan,
  matchChallanReceiptBatches,
  resolveChallanReceiptBatches,
  resolveDeliveryStatusGrnItems,
  type DeliveryStatusGrnItemRow,
} from "@/utils/delivery-challan-grn";
import {
  buildDeliveryChallanPdfInputFromRecordResolved,
  downloadDeliveryChallanPdf,
} from "@/utils/delivery-challan-pdf";
import {
  getDeliveryChallan,
  type DeliveryChallanRecord,
} from "@/utils/delivery-challan-storage";
import { persistDeliveryStatusFromForm } from "@/utils/delivery-status-persist";
import { setDeliveryStatusFlash } from "@/utils/delivery-status-flash";
import {
  deliveryStatusUiMode,
  isFailedShipmentStatus,
  openStoredDeliveryFile,
  resolveDeliveryStatusForChallan,
  validateDeliveryStatusForm,
  type DeliveryStatusFormErrors,
} from "@/utils/delivery-status-storage";

type DeliveryStatusEditPanelProps = {
  challanId: string;
};

function pickBillingInvoiceTask(
  tasks: ProcInvoiceGenerationTask[],
): ProcInvoiceGenerationTask | null {
  if (tasks.length === 0) return null;
  const completed = tasks.find(
    (task) => task.status === "completed" && Boolean(task.invoice_number?.trim()),
  );
  if (completed) return completed;
  const pending = tasks.find((task) => task.status === "pending");
  return pending || tasks[0] || null;
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-0.5">
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="text-sm font-medium tabular-nums text-foreground">
        {(value ?? "").trim() || "-"}
      </div>
    </div>
  );
}

export function DeliveryStatusEditPanel({ challanId }: DeliveryStatusEditPanelProps) {
  const router = useRouter();
  const [challan, setChallan] = useState<DeliveryChallanRecord | null>(null);
  const [form, setForm] = useState<DeliveryStatusFormValue | null>(null);
  const [grnItems, setGrnItems] = useState<DeliveryStatusGrnItemRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<DeliveryStatusFormErrors>({});
  const [saving, setSaving] = useState(false);
  const [formPhase, setFormPhase] = useState<"initial" | "tracking">("initial");
  const [outcomeOpen, setOutcomeOpen] = useState(false);
  const [billTick, setBillTick] = useState(0);
  const [accountsInvoiceDocument, setAccountsInvoiceDocument] =
    useState<AccountsInvoiceDocumentRef | null>(null);
  const [dcPdfBusy, setDcPdfBusy] = useState(false);

  useEffect(() => {
    try {
      const row = getDeliveryChallan(challanId);
      setChallan(row);
      setAccountsInvoiceDocument(null);
      if (!row) {
        setForm(null);
        setGrnItems([]);
        return;
      }
      const seeded = deliveryStatusToFormValue(resolveDeliveryStatusForChallan(row));
      setFormPhase(deliveryStatusUiMode(seeded));
      const fromChallan =
        String(row.purchaseOrderNumber ?? "").trim() &&
          String(row.purchaseOrderNumber ?? "").trim() !==
          String(row.companyPoNumber ?? "").trim()
          ? String(row.purchaseOrderNumber ?? "").trim()
          : "";
      if (!String(seeded.customerPoNumber ?? "").trim() && fromChallan) {
        seeded.customerPoNumber = fromChallan;
      }
      if (!String(seeded.customerName ?? "").trim()) {
        seeded.customerName = String(row.customerName ?? "").trim();
      }
      const challanInvoice = String(row.invoiceNumber ?? "").trim();
      const dcNumber = String(row.challanNumber ?? "").trim();
      if (row.grnKind === "billing") {
        if (challanInvoice && !String(seeded.cacheInvoiceNumber ?? "").trim()) {
          seeded.cacheInvoiceNumber = challanInvoice;
        }
      } else if (dcNumber) {
        seeded.cacheInvoiceNumber = dcNumber;
      } else if (challanInvoice && !String(seeded.cacheInvoiceNumber ?? "").trim()) {
        seeded.cacheInvoiceNumber = challanInvoice;
      }
      setForm(seeded);
      setGrnItems(deliveryStatusGrnItemRowsFromChallan(row));
      setError(null);

      const orderId = row.orderId;
      if (!orderId) return;

      let cancelled = false;
      void (async () => {
        try {
          const [order, batches, orderInvoiceTasks] = await Promise.all([
            getPurchaseOrder(orderId),
            listOrderReceiptBatches(orderId).catch(() => []),
            listInvoiceGenerationTasksForOrder(orderId).catch(
              () => [] as ProcInvoiceGenerationTask[],
            ),
          ]);
          if (cancelled) return;
          const resolved = resolveChallanReceiptBatches(batches, order);
          const matched = matchChallanReceiptBatches(resolved, row);
          const orderInvoiceTask = pickBillingInvoiceTask(orderInvoiceTasks);
          const nextGrnItems = resolveDeliveryStatusGrnItems({
            challan: row,
            matchedBatches: matched,
            order,
            invoiceQuantity:
              row.grnKind === "billing"
                ? orderInvoiceTask?.invoice_quantity ?? null
                : null,
          });
          if (nextGrnItems.length > 0) setGrnItems(nextGrnItems);
          const fromOrder = String(order.customer_po_number ?? "").trim();
          const fromOrderCustomer = String(order.customer_name ?? "").trim();

          let accountsInvoice = "";
          let accountsDoc: AccountsInvoiceDocumentRef | null = null;
          const isBillingChallan = row.grnKind === "billing";
          if (isBillingChallan) {
            if (orderInvoiceTask?.invoice_number) {
              accountsInvoice = String(orderInvoiceTask.invoice_number).trim();
            }
            const primaryBatch = matched.find((b) => Boolean(b.id)) || matched[0] || null;
            if (primaryBatch?.id) {
              if (!accountsInvoice) {
                try {
                  const task = await getInvoiceGenerationTaskForBatch(String(primaryBatch.id));
                  if (task?.invoice_number) {
                    accountsInvoice = String(task.invoice_number).trim();
                  }
                } catch {
                  /* optional */
                }
              }
              if (!accountsInvoice && primaryBatch.vendor_invoice_number) {
                accountsInvoice = String(primaryBatch.vendor_invoice_number).trim();
              }
              try {
                const attachments =
                  primaryBatch.attachments && primaryBatch.attachments.length > 0
                    ? primaryBatch.attachments
                    : await listReceiptBatchAttachments(String(primaryBatch.id));
                const file = attachments[0];
                if (file?.id) {
                  accountsDoc = {
                    id: String(file.id),
                    fileName: file.file_name || "Invoice document",
                  };
                }
              } catch {
                /* optional */
              }
            }
            if (!accountsInvoice) {
              accountsInvoice = challanInvoice;
            }
          }
          if (!cancelled) setAccountsInvoiceDocument(accountsDoc);

          setForm((prev) => {
            if (!prev) return prev;
            let next = prev;
            if (!String(prev.customerPoNumber ?? "").trim()) {
              const seedPo = fromOrder || fromChallan;
              if (seedPo) next = { ...next, customerPoNumber: seedPo };
            }
            if (!String(prev.customerName ?? "").trim() && fromOrderCustomer) {
              next = { ...next, customerName: fromOrderCustomer };
            }
            if (isBillingChallan) {
              if (accountsInvoice) {
                next = { ...next, cacheInvoiceNumber: accountsInvoice };
              }
            } else {
              const fromDc = String(row.challanNumber ?? "").trim();
              if (fromDc) next = { ...next, cacheInvoiceNumber: fromDc };
            }
            return next === prev ? prev : next;
          });
        } catch {
          // Keep challan line items already shown.
        }
      })();

      return () => {
        cancelled = true;
      };
    } catch {
      setChallan(null);
      setForm(null);
      setGrnItems([]);
      setAccountsInvoiceDocument(null);
      setError("Could not load this delivery status record.");
    }
  }, [challanId, billTick]);

  const isBilling = challan?.grnKind === "billing";
  const dcNumber = String(challan?.challanNumber ?? "").trim();

  async function onDownloadDcPdf() {
    if (!challan || dcPdfBusy) return;
    setDcPdfBusy(true);
    setError(null);
    try {
      const input = await buildDeliveryChallanPdfInputFromRecordResolved(challan);
      await downloadDeliveryChallanPdf(input);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to download DC PDF");
    } finally {
      setDcPdfBusy(false);
    }
  }

  async function onSave() {
    if (!challan || !form || saving) return;
    const errors = validateDeliveryStatusForm(form, {
      requireDispatch: challan.grnKind !== "billing",
    });
    setFieldErrors(errors);
    const message = Object.values(errors).find(Boolean);
    if (message) {
      setError(message);
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
      setDeliveryStatusFlash({
        variant: result.emailWarning ? "warning" : "success",
        message: result.emailWarning
          ? `Dispatch saved. Out-for-delivery email failed: ${result.emailWarning}`
          : result.emailSkipped
            ? "Dispatch saved."
            : form.shipmentStatus === "Failed delivery"
            ? "Marked as failed delivery."
            : form.shipmentStatus === "Delivered" && form.requiresInstallation
              ? "Marked delivered. Open Procurement → Installation to fill site details."
              : form.shipmentStatus === "Delivered"
                ? "Marked delivered."
                : "Dispatch saved. Customer notified that the order is out for delivery.",
      });
      router.replace("/procurement/delivery-status");
    } catch {
      setError("Could not save delivery status. Try again.");
      setSaving(false);
    }
  }

  if (!challan) {
    return (
      <div className={procurementUi.page}>
        <PageHeader
          title="Delivery status"
          backHref="/procurement/delivery-status"
          backLabel="Delivery status"
        />
        <p className="text-sm text-muted-foreground">
          Record not found. Return to the list and try again.
        </p>
      </div>
    );
  }

  const readOnly = formPhase === "tracking";

  return (
    <div className={procurementUi.page}>
      <PageHeader
        backHref="/procurement/delivery-status"
        backLabel="Delivery status"
        title={readOnly ? "Delivery status" : "Set dispatch"}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {readOnly ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="cursor-pointer transition-colors duration-200"
                onClick={() => setOutcomeOpen(true)}
              >
                <MapPinned className="mr-1.5 size-3.5" />
                Update status
              </Button>
            ) : null}
          </div>
        }
      />

      {error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <DeliverySectionCard title="PO details" icon={FileText}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <ReadOnlyField
            label="Customer name"
            value={form?.customerName ?? challan.customerName ?? ""}
          />
          <ReadOnlyField
            label="Customer PO number"
            value={form?.customerPoNumber ?? ""}
          />
        </div>
      </DeliverySectionCard>

      <DeliverySectionCard
        title="GRN items"
        icon={Package}
        subtitle={
          isBilling
            ? "Items billed on this document"
            : "Items received on this GRN"
        }
      >
        <GrnItemsTable rows={grnItems} isBilling={isBilling} />
      </DeliverySectionCard>

      {/* Set dispatch: Dispatch detail replaces shipment milestone. */}
      {form && !readOnly ? (
        <>
          <DeliveryStatusForm
            mode="initial"
            value={form}
            showDispatchDetail
            challanKind={challan.grnKind || "delivery_challan"}
            dcNumber={dcNumber}
            onDownloadDcPdf={() => void onDownloadDcPdf()}
            dcPdfBusy={dcPdfBusy}
            accountsInvoiceDocument={accountsInvoiceDocument}
            onOpenAccountsInvoiceDocument={(id) => {
              void openReceiptBatchAttachment(id);
            }}
            onChange={(next) => {
              setForm(next);
              if (Object.keys(fieldErrors).length > 0) {
                setFieldErrors(
                  validateDeliveryStatusForm(next, {
                    requireDispatch: !isBilling,
                  }),
                );
              }
            }}
            fieldErrors={fieldErrors}
          />
          <div className="flex justify-end">
            <Button
              type="button"
              size="sm"
              className="cursor-pointer transition-colors duration-200"
              disabled={saving}
              onClick={() => void onSave()}
            >
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </>
      ) : null}

      {/* View: same sections/fields as Set dispatch (read-only). */}
      {form && readOnly ? (
        <>
          <DeliverySectionCard
            title="Dispatch detail"
            icon={Truck}
            subtitle="Saved dispatch details from Set dispatch"
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <ReadOnlyField
                label="Mode"
                value={
                  form.deliveryMode === "hand"
                    ? "By hand"
                    : form.deliveryMode === "courier"
                      ? "Courier"
                      : ""
                }
              />
              <ReadOnlyField label="Dispatch date" value={form.dispatchDate} />
            </div>

            {form.deliveryMode === "hand" ? (
              <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <ReadOnlyField label="Delivery person" value={form.deliveryBoyName} />
                <div className="space-y-0.5">
                  <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    POD
                  </div>
                  {form.podDocument ? (
                    <button
                      type="button"
                      className="cursor-pointer text-sm font-medium text-[#0369A1] transition-colors duration-200 hover:underline"
                      onClick={() => openStoredDeliveryFile(form.podDocument!)}
                    >
                      {form.podDocument.fileName}
                    </button>
                  ) : (
                    <div className="text-sm font-medium text-foreground">-</div>
                  )}
                </div>
              </div>
            ) : null}

            {form.deliveryMode === "courier" ? (
              <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <ReadOnlyField label="Courier" value={form.courierProvider} />
                <ReadOnlyField label="Docket number" value={form.docketNumber} />
              </div>
            ) : null}

            <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <ReadOnlyField label="Transporter name" value={form.transporterName} />
              <ReadOnlyField label="LR / GR number" value={form.lrGrNumber} />
              <ReadOnlyField label="No. of boxes" value={form.boxCount} />
              <ReadOnlyField label="Mode of surface" value={form.surfaceMode} />
              <div className="space-y-0.5">
                <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Customer tax invoice
                </div>
                {form.customerTaxInvoiceDocument ? (
                  <button
                    type="button"
                    className="cursor-pointer text-sm font-medium text-[#0369A1] transition-colors duration-200 hover:underline"
                    onClick={() => openStoredDeliveryFile(form.customerTaxInvoiceDocument!)}
                  >
                    {form.customerTaxInvoiceDocument.fileName}
                  </button>
                ) : (
                  <div className="text-sm font-medium text-foreground">-</div>
                )}
              </div>
              <div className="space-y-0.5">
                <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Packing list
                </div>
                {form.packingListDocument ? (
                  <button
                    type="button"
                    className="cursor-pointer text-sm font-medium text-[#0369A1] transition-colors duration-200 hover:underline"
                    onClick={() => openStoredDeliveryFile(form.packingListDocument!)}
                  >
                    {form.packingListDocument.fileName}
                  </button>
                ) : (
                  <div className="text-sm font-medium text-foreground">-</div>
                )}
              </div>
            </div>
            <div className="mt-3">
              <ReadOnlyField label="Remarks" value={form.remarks} />
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 border-t border-border/60 pt-4 sm:grid-cols-2 lg:grid-cols-3">
              <ReadOnlyField
                label="Delivery status"
                value={
                  isFailedShipmentStatus(form.shipmentStatus)
                    ? "Failed delivery"
                    : (form.shipmentStatus || "").toLowerCase() === "delayed"
                      ? "Delayed"
                      : form.shipmentStatus === "Delivered" || form.actualDeliveryDate?.trim()
                        ? "Delivered"
                        : form.shipmentStatus || "In transit"
                }
              />
              <ReadOnlyField label="Delivered date" value={form.actualDeliveryDate} />
              <ReadOnlyField
                label="Requires installation"
                value={form.requiresInstallation ? "Yes" : "No"}
              />
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Dispatch is locked after save. Use Update status to mark Delivered, Delayed, or Failed.
            </p>
          </DeliverySectionCard>

          {isBilling ? (
            <DeliverySectionCard title="Cache invoice" icon={FileText}>
              <p className="mb-3 text-xs text-muted-foreground">
                Invoice number and document are entered by Accounts and shown here read-only.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <ReadOnlyField label="Invoice number" value={form.cacheInvoiceNumber} />
                <div className="space-y-0.5">
                  <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Invoice document
                  </div>
                  {accountsInvoiceDocument?.id ? (
                    <button
                      type="button"
                      className="cursor-pointer text-sm font-medium text-[#0369A1] underline-offset-2 transition-colors duration-150 hover:underline"
                      onClick={() => void openReceiptBatchAttachment(accountsInvoiceDocument.id)}
                    >
                      {accountsInvoiceDocument.fileName}
                    </button>
                  ) : form.cacheInvoiceDocument?.fileName ? (
                    <button
                      type="button"
                      className="cursor-pointer text-sm font-medium text-[#0369A1] underline-offset-2 transition-colors duration-150 hover:underline"
                      onClick={() => openStoredDeliveryFile(form.cacheInvoiceDocument!)}
                    >
                      {form.cacheInvoiceDocument.fileName}
                    </button>
                  ) : (
                    <div className="text-sm text-muted-foreground">Not attached by Accounts yet</div>
                  )}
                </div>
              </div>
            </DeliverySectionCard>
          ) : (
            <DeliverySectionCard title="Delivery challan" icon={FileText}>
              <p className="mb-3 text-xs text-muted-foreground">
                DC number and PDF from the saved delivery challan.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <ReadOnlyField
                  label="DC number"
                  value={dcNumber || form.cacheInvoiceNumber || ""}
                />
                <div className="space-y-0.5">
                  <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    DC PDF
                  </div>
                  {dcNumber || form.cacheInvoiceNumber ? (
                    <button
                      type="button"
                      disabled={dcPdfBusy}
                      className="cursor-pointer text-sm font-medium text-[#0369A1] underline-offset-2 transition-colors duration-150 hover:underline disabled:cursor-wait disabled:opacity-60"
                      onClick={() => void onDownloadDcPdf()}
                    >
                      {dcPdfBusy ? "Preparing…" : "Download PDF"}
                    </button>
                  ) : (
                    <div className="text-sm text-muted-foreground">DC PDF not available yet</div>
                  )}
                </div>
              </div>
            </DeliverySectionCard>
          )}
        </>
      ) : null}

      <DeliveryStatusOutcomeDialog
        open={outcomeOpen}
        challan={challan}
        onClose={() => setOutcomeOpen(false)}
        onSaved={(message) => {
          setDeliveryStatusFlash({ variant: "success", message });
          setOutcomeOpen(false);
          setBillTick((n) => n + 1);
          router.replace("/procurement/delivery-status");
        }}
      />
    </div>
  );
}

function GrnItemsTable({
  rows,
  isBilling = false,
}: {
  rows: DeliveryStatusGrnItemRow[];
  isBilling?: boolean;
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No GRN items recorded yet.</p>;
  }

  return (
    <div className={procurementUi.tableShell}>
      <div className={procurementUi.tableScroll}>
        <table className={cn(procurementUi.table, "min-w-[760px]")}>
          <thead className={procurementUi.thead}>
            <tr>
              <th className={procurementUi.th}>Product name</th>
              <th className={procurementUi.th}>Description</th>
              <th className={cn(procurementUi.th, "w-24 text-right")}>
                {isBilling ? "Billed qty" : "GRN qty"}
              </th>
              <th className={cn(procurementUi.th, "w-28 text-right")}>Unit rate</th>
              <th className={cn(procurementUi.th, "w-28 text-right")}>Tax</th>
              <th className={cn(procurementUi.th, "w-32 text-right")}>Total amount</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className={procurementUi.tr}>
                <td className={procurementUi.td}>{row.product}</td>
                <td className={procurementUi.tdMuted}>{row.description || "-"}</td>
                <td className={cn(procurementUi.tdNumeric, "text-right font-medium")}>
                  {row.grnQty}
                </td>
                <td className={cn(procurementUi.tdNumeric, "text-right")}>{row.unitCost}</td>
                <td className={cn(procurementUi.tdNumeric, "text-right")}>{row.tax}</td>
                <td className={cn(procurementUi.tdNumeric, "text-right font-medium")}>
                  {row.totalAmount}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
