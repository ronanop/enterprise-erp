"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Package, Receipt } from "lucide-react";

import { DeliveryStatusBillDialog } from "@/components/procurement/delivery-status-bill-dialog";
import { ProcurementPageHeader } from "@/components/procurement/procurement-page-header";
import { procurementUi } from "@/components/procurement/procurement-ui";
import {
  DeliveryStatusForm,
  deliveryStatusToFormValue,
  type DeliveryStatusFormValue,
} from "@/components/procurement/delivery-status-form";
import { DeliverySectionCard } from "@/components/procurement/delivery-section-card";
import { FinanceField } from "@/components/finance/journals/finance-form-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  getPurchaseOrder,
  listOrderReceiptBatches,
} from "@/services/procurement-service";
import {
  deliveryStatusGrnItemRowsFromBatches,
  deliveryStatusGrnItemRowsFromChallan,
  matchChallanReceiptBatches,
  resolveChallanReceiptBatches,
  type DeliveryStatusGrnItemRow,
} from "@/utils/delivery-challan-grn";
import {
  aggregatePoDcBillStatus,
  challanDeliveredQuantity,
  deliveryBillStatusBadgeVariant,
  formatDeliveryBillStatusLabel,
  resolveDeliveryBillStatus,
} from "@/utils/delivery-challan-bill";
import {
  formatChallanGrnSummary,
  getDeliveryChallan,
  type DeliveryChallanRecord,
} from "@/utils/delivery-challan-storage";
import { persistDeliveryStatusFromForm } from "@/utils/delivery-status-persist";
import { setDeliveryStatusFlash } from "@/utils/delivery-status-flash";
import {
  resolveDeliveryStatusForChallan,
  validateDeliveryStatusForm,
  type DeliveryStatusFormErrors,
} from "@/utils/delivery-status-storage";

type DeliveryStatusEditPanelProps = {
  challanId: string;
};

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-0.5">
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="text-sm font-medium tabular-nums text-foreground">
        {(value ?? "").trim() || "—"}
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
  const [billOpen, setBillOpen] = useState(false);
  const [billTick, setBillTick] = useState(0);

  useEffect(() => {
    try {
      const row = getDeliveryChallan(challanId);
      setChallan(row);
      if (!row) {
        setForm(null);
        setGrnItems([]);
        return;
      }
      const seeded = deliveryStatusToFormValue(resolveDeliveryStatusForChallan(row));
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
      setForm(seeded);
      setGrnItems(deliveryStatusGrnItemRowsFromChallan(row));
      setError(null);

      const orderId = row.orderId;
      if (!orderId) return;

      let cancelled = false;
      void (async () => {
        try {
          const [order, batches] = await Promise.all([
            getPurchaseOrder(orderId),
            listOrderReceiptBatches(orderId).catch(() => []),
          ]);
          if (cancelled) return;
          const resolved = resolveChallanReceiptBatches(batches, order);
          const matched = matchChallanReceiptBatches(resolved, row);
          const liveRows = deliveryStatusGrnItemRowsFromBatches(matched, order);
          if (liveRows.length > 0) setGrnItems(liveRows);
          const fromOrder = String(order.customer_po_number ?? "").trim();
          const fromOrderCustomer = String(order.customer_name ?? "").trim();
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
      setError("Could not load this delivery status record.");
    }
  }, [challanId, billTick]);

  async function onSave() {
    if (!challan || !form || saving) return;
    const errors = validateDeliveryStatusForm(form);
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
          ? `Delivery status saved. Dispatch email failed: ${result.emailWarning}`
          : "Delivery status saved. DC stays unbilled until you mark it billed.",
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
        <ProcurementPageHeader
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

  const poNumber =
    String(form?.cachePoNumber ?? "").trim() ||
    String(challan.companyPoNumber ?? "").trim() ||
    String(challan.purchaseOrderNumber ?? "").trim();

  const status = resolveDeliveryStatusForChallan(challan);
  const billKey = resolveDeliveryBillStatus(status, challanDeliveredQuantity(challan));
  const canBill =
    billKey === "unbilled" ||
    billKey === "partially_billed" ||
    billKey === "fully_billed";

  return (
    <div className={procurementUi.page}>
      <ProcurementPageHeader
        backHref="/procurement/delivery-status"
        backLabel="Delivery status"
        title="Delivery status"
        actions={
          canBill ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="cursor-pointer transition-colors duration-200"
              onClick={() => setBillOpen(true)}
            >
              <Receipt className="mr-1.5 size-3.5" />
              {billKey === "fully_billed" ? "Update bill" : "Bill DC"}
            </Button>
          ) : null
        }
      />

      {error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <DeliverySectionCard title="Bill status" icon={Receipt}>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1">
            <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              DC bill
            </div>
            <Badge
              variant={deliveryBillStatusBadgeVariant(billKey)}
              className={procurementUi.statusBadge}
            >
              {formatDeliveryBillStatusLabel(billKey)}
            </Badge>
          </div>
          <div className="space-y-1">
            <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              PO bill
            </div>
            <div className="text-sm font-medium">
              {aggregatePoDcBillStatus(challan.orderId)}
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Billed qty
            </div>
            <div className="text-sm font-medium tabular-nums">
              {status.billedQuantity?.trim() || "—"}
              {challanDeliveredQuantity(challan) > 0
                ? ` / ${challanDeliveredQuantity(challan)}`
                : ""}
            </div>
          </div>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Delivery challan means goods are delivered. Bill this material later (partial or
          full) when payment is due — that updates PO bill status.
        </p>
      </DeliverySectionCard>

      <DeliverySectionCard title="PO details" icon={FileText}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <ReadOnlyField label="PO number" value={poNumber} />
          <ReadOnlyField label="GRN number" value={formatChallanGrnSummary(challan)} />
          {form ? (
            <FinanceField label="Customer name" error={fieldErrors.customerName}>
              <Input
                value={form.customerName ?? ""}
                onChange={(e) => {
                  const next = { ...form, customerName: e.target.value };
                  setForm(next);
                  if (Object.keys(fieldErrors).length > 0) {
                    setFieldErrors(validateDeliveryStatusForm(next));
                  }
                }}
                className="h-8"
                placeholder="Enter customer name"
              />
            </FinanceField>
          ) : null}
          {form ? (
            <FinanceField label="Customer PO number" error={fieldErrors.customerPoNumber}>
              <Input
                value={form.customerPoNumber ?? ""}
                onChange={(e) => {
                  const next = { ...form, customerPoNumber: e.target.value };
                  setForm(next);
                  if (Object.keys(fieldErrors).length > 0) {
                    setFieldErrors(validateDeliveryStatusForm(next));
                  }
                }}
                className="h-8"
                placeholder="Enter customer PO number"
              />
            </FinanceField>
          ) : null}
        </div>
      </DeliverySectionCard>

      <DeliverySectionCard
        title="GRN items"
        icon={Package}
        subtitle="Items received on this GRN"
      >
        <GrnItemsTable rows={grnItems} />
      </DeliverySectionCard>

      {form ? (
        <>
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

      <DeliveryStatusBillDialog
        open={billOpen}
        challanId={challan.id}
        onClose={() => setBillOpen(false)}
        onSaved={() => setBillTick((n) => n + 1)}
      />
    </div>
  );
}

function GrnItemsTable({ rows }: { rows: DeliveryStatusGrnItemRow[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No GRN items recorded yet.</p>;
  }

  return (
    <div className={procurementUi.tableShell}>
      <div className={procurementUi.tableScroll}>
        <table className={cn(procurementUi.table, "min-w-[560px]")}>
          <thead className={procurementUi.thead}>
            <tr>
              <th className={procurementUi.th}>Product name</th>
              <th className={procurementUi.th}>Description</th>
              <th className={cn(procurementUi.th, "w-24 text-right")}>GRN qty</th>
              <th className={cn(procurementUi.th, "w-28 text-right")}>Unit rate</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className={procurementUi.tr}>
                <td className={procurementUi.td}>{row.product}</td>
                <td className={procurementUi.tdMuted}>{row.description || "—"}</td>
                <td className={cn(procurementUi.tdNumeric, "text-right font-medium")}>
                  {row.grnQty}
                </td>
                <td className={cn(procurementUi.tdNumeric, "text-right")}>{row.unitCost}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
