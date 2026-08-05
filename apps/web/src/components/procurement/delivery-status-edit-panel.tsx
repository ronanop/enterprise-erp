"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { ProcurementPageHeader } from "@/components/procurement/procurement-page-header";
import { procurementUi } from "@/components/procurement/procurement-ui";
import {
  DeliveryStatusForm,
  deliveryStatusToFormValue,
  type DeliveryStatusFormValue,
} from "@/components/procurement/delivery-status-form";
import { DeliverySectionCard } from "@/components/procurement/delivery-section-card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  formatChallanGrnSummary,
  getDeliveryChallan,
  type DeliveryChallanLine,
  type DeliveryChallanRecord,
} from "@/utils/delivery-challan-storage";
import { sendDeliveryDispatchNotification } from "@/utils/delivery-dispatch-email";
import { setDeliveryStatusFlash } from "@/utils/delivery-status-flash";
import {
  applyShipmentStatusToActualDate,
  firstDeliveryStatusFormError,
  getDeliveryStatus,
  isDeliveryStatusPersisted,
  resolveDeliveryStatusForChallan,
  upsertDeliveryStatus,
  validateDeliveryStatusForm,
  type DeliveryStatusFormErrors,
} from "@/utils/delivery-status-storage";
import { runDeliveryReminderSweep } from "@/utils/delivery-status-reminders";
import { FileText } from "lucide-react";

type DeliveryStatusEditPanelProps = {
  challanId: string;
};

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-0.5">
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="text-sm font-medium text-foreground">{value.trim() || "—"}</div>
    </div>
  );
}

function ChallanLinesTable({ lines }: { lines: DeliveryChallanLine[] }) {
  const rows = lines.filter((line) => line.itemName.trim());
  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No line items recorded on this challan.</p>
    );
  }

  return (
    <div className={procurementUi.tableShell}>
      <div className={procurementUi.tableScroll}>
        <table className={cn(procurementUi.table, "min-w-[640px]")}>
          <thead className={procurementUi.thead}>
            <tr>
              <th className={cn(procurementUi.th, "w-12")}>S.No</th>
              <th className={procurementUi.th}>Description</th>
              <th className={cn(procurementUi.th, "w-28")}>HSN / SAC</th>
              <th className={cn(procurementUi.th, "w-24")}>Asset no.</th>
              <th className={cn(procurementUi.th, "w-20 text-right")}>Qty sent</th>
              <th className={cn(procurementUi.th, "w-28 text-right")}>Rate (vendor)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((line, index) => (
              <tr key={line.id} className={procurementUi.tr}>
                <td className={cn(procurementUi.tdNumeric, "text-muted-foreground")}>
                  {index + 1}
                </td>
                <td className={procurementUi.td}>{line.itemName}</td>
                <td className={procurementUi.tdMuted}>{line.hsnSac.trim() || "—"}</td>
                <td className={procurementUi.tdMuted}>{line.assetNo.trim() || "—"}</td>
                <td className={cn(procurementUi.tdNumeric, "text-right font-medium")}>
                  {line.quantitySent.trim() || "—"}
                </td>
                <td className={cn(procurementUi.tdNumeric, "text-right")}>
                  {line.rate.trim() || "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function DeliveryStatusEditPanel({ challanId }: DeliveryStatusEditPanelProps) {
  const router = useRouter();
  const [challan, setChallan] = useState<DeliveryChallanRecord | null>(null);
  const [form, setForm] = useState<DeliveryStatusFormValue | null>(null);
  const [trackingOnly, setTrackingOnly] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<DeliveryStatusFormErrors>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const row = getDeliveryChallan(challanId);
    setChallan(row);
    setTrackingOnly(isDeliveryStatusPersisted(challanId));
    if (row) {
      const status = resolveDeliveryStatusForChallan(row);
      setForm(deliveryStatusToFormValue(status));
    } else {
      setForm(null);
    }
  }, [challanId]);

  async function onSave() {
    if (!challan || !form || saving) return;

    if (!trackingOnly) {
      const errors = validateDeliveryStatusForm(form);
      setFieldErrors(errors);
      const message = firstDeliveryStatusFormError(errors);
      if (message) {
        setError(message);
        return;
      }
    }

    setError(null);
    setSaving(true);
    try {
      const saved = getDeliveryStatus(challan.id);
      const base =
        trackingOnly && saved
          ? deliveryStatusToFormValue(saved)
          : form;
      const normalized = applyShipmentStatusToActualDate({
        ...base,
        shipmentStatus: form.shipmentStatus,
      });

      upsertDeliveryStatus({
        challanId: challan.id,
        ...normalized,
      });
      runDeliveryReminderSweep();

      if (!trackingOnly) {
        const email = await sendDeliveryDispatchNotification(challan, normalized);
        if (email.ok) {
          setDeliveryStatusFlash({
            variant: "success",
            message: "Delivery status saved. Dispatch email sent to the reminder address.",
          });
        } else {
          setDeliveryStatusFlash({
            variant: "warning",
            message: `Delivery status saved. Dispatch email failed: ${email.message ?? "Unknown error"}`,
          });
        }
      } else {
        setDeliveryStatusFlash({
          variant: "success",
          message: "Shipment status updated.",
        });
      }

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
          backLabel="Status"
        />
        <p className="text-sm text-muted-foreground">
          Challan not found. It may have been removed — return to the list and try again.
        </p>
      </div>
    );
  }

  return (
    <div className={procurementUi.page}>
      <ProcurementPageHeader
        backHref="/procurement/delivery-status"
        backLabel="Status"
        title={trackingOnly ? "Update shipment status" : "Set up delivery status"}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/procurement/delivery-status">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="cursor-pointer transition-colors duration-200"
              >
                Cancel
              </Button>
            </Link>
            <Button
              type="button"
              size="sm"
              className="cursor-pointer transition-colors duration-200"
              disabled={!form || saving}
              onClick={() => void onSave()}
            >
              {saving ? "Saving…" : "Save status"}
            </Button>
          </div>
        }
      />

      {error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <DeliverySectionCard title="From delivery challan" icon={FileText}>
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <ReadOnlyField label="Challan number" value={challan.challanNumber} />
            <ReadOnlyField label="Challan date" value={challan.challanDate} />
            <ReadOnlyField label="PO number" value={challan.purchaseOrderNumber} />
            <ReadOnlyField label="GRN" value={formatChallanGrnSummary(challan)} />
            <ReadOnlyField label="Customer" value={challan.customerName} />
            <ReadOnlyField label="Vendor" value={challan.vendorName} />
            <ReadOnlyField label="Entity" value={challan.entityName} />
          </div>
          <div className="space-y-2">
            <h3 className={procurementUi.sectionTitle}>Line items</h3>
            <ChallanLinesTable lines={challan.lines} />
          </div>
        </div>
      </DeliverySectionCard>

      <p className="text-xs text-muted-foreground">
        {trackingOnly
          ? "Challan details are read-only. Change shipment status below and save."
          : "Complete dispatch details and reminder email, then save to send the dispatch notification."}
      </p>

      {form ? (
        <DeliveryStatusForm
          value={form}
          onChange={(next) => {
            setForm(next);
            if (!trackingOnly && Object.keys(fieldErrors).length > 0) {
              setFieldErrors(validateDeliveryStatusForm(next));
            }
          }}
          showLocationSection={false}
          fieldErrors={fieldErrors}
          mode={trackingOnly ? "tracking" : "initial"}
        />
      ) : null}
    </div>
  );
}
