"use client";

import { useState } from "react";
import { Mail, Route } from "lucide-react";

import { DeliverySectionCard } from "@/components/procurement/delivery-section-card";
import type { DeliveryStatusFormValue } from "@/components/procurement/delivery-status-form";
import { FinanceField } from "@/components/finance/journals/finance-form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiClientError } from "@/services/api-client";
import { DELIVERY_MILESTONES, updateDeliveryMilestone } from "@/services/crm-deal-controls-service";
import type { DeliveryChallanRecord } from "@/utils/delivery-challan-storage";
import { sendDeliveryDispatchNotification } from "@/utils/delivery-dispatch-email";

const SELECT_CLASS =
  "h-9 w-full cursor-pointer rounded-lg border border-input bg-background px-2.5 text-[13px] transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";

type Props = {
  orderId: string;
  initialMilestone?: string | null;
  initialAwb?: string | null;
  initialCustomerEmail?: string | null;
  challan?: DeliveryChallanRecord | null;
  deliveryStatus?: DeliveryStatusFormValue | null;
  onCustomerEmailChange?: (email: string) => void;
};

/** Factory → India → warehouse → site: shipment milestone + customer dispatch email. */
export function DeliveryMilestoneCard({
  orderId,
  initialMilestone,
  initialAwb,
  initialCustomerEmail,
  challan,
  deliveryStatus,
  onCustomerEmailChange,
}: Props) {
  const [milestone, setMilestone] = useState(initialMilestone ?? "order_placed");
  const [awb, setAwb] = useState(initialAwb ?? "");
  const [note, setNote] = useState("");
  const [customerEmail, setCustomerEmail] = useState(
    (initialCustomerEmail || "").trim(),
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  async function save() {
    setBusy(true);
    setMessage(null);
    try {
      await updateDeliveryMilestone(orderId, {
        milestone,
        awb_number: awb.trim() || null,
        note: note.trim() || null,
      });
      setNote("");

      const to = customerEmail.trim();
      onCustomerEmailChange?.(to);

      const isDispatchMilestone =
        milestone === "dispatched_from_factory" || milestone === "dispatched_to_site";

      if (to && challan && isDispatchMilestone) {
        const statusForEmail: DeliveryStatusFormValue = {
          shipmentStatus: deliveryStatus?.shipmentStatus || "Dispatched",
          dispatchDate:
            deliveryStatus?.dispatchDate || new Date().toISOString().slice(0, 10),
          reminderEmail: to,
          expectedDeliveryDate: deliveryStatus?.expectedDeliveryDate || "",
          actualDeliveryDate: deliveryStatus?.actualDeliveryDate || "",
          courierTransportDetails: deliveryStatus?.courierTransportDetails || "",
          courierProvider: deliveryStatus?.courierProvider || "",
          trackingNumber: awb.trim() || deliveryStatus?.trackingNumber || "",
          deliveryLocation: deliveryStatus?.deliveryLocation || "",
          receiverDetails: deliveryStatus?.receiverDetails || "",
          cachePoNumber: deliveryStatus?.cachePoNumber || "",
          customerPoNumber: deliveryStatus?.customerPoNumber || "",
          customerName: deliveryStatus?.customerName || challan.customerName || "",
          cacheInvoiceNumber: deliveryStatus?.cacheInvoiceNumber || "",
          cacheInvoiceDocument: deliveryStatus?.cacheInvoiceDocument ?? null,
          deliveryMode: deliveryStatus?.deliveryMode || "",
          deliveryBoyName: deliveryStatus?.deliveryBoyName || "",
          itemType: deliveryStatus?.itemType || "",
          docketNumber: awb.trim() || deliveryStatus?.docketNumber || "",
          podDocument: deliveryStatus?.podDocument ?? null,
          transporterName: deliveryStatus?.transporterName || "",
          lrGrNumber: deliveryStatus?.lrGrNumber || "",
          customerTaxInvoiceDocument:
            deliveryStatus?.customerTaxInvoiceDocument ?? null,
          packingListDocument: deliveryStatus?.packingListDocument ?? null,
          boxCount: deliveryStatus?.boxCount || "",
          surfaceMode: deliveryStatus?.surfaceMode || "",
          remarks: note.trim() || deliveryStatus?.remarks || "",
          requiresInstallation: deliveryStatus?.requiresInstallation ?? false,
          billStatus: deliveryStatus?.billStatus || "unbilled",
          billedQuantity: deliveryStatus?.billedQuantity || "",
          billInvoiceNumber: deliveryStatus?.billInvoiceNumber || "",
          billInvoiceDate: deliveryStatus?.billInvoiceDate || "",
          billDocument: deliveryStatus?.billDocument ?? null,
          billRemarks: deliveryStatus?.billRemarks || "",
          billedAt: deliveryStatus?.billedAt || "",
          outForDeliveryEmailSentAt:
            deliveryStatus?.outForDeliveryEmailSentAt || "",
          outcomeEmailSentAt: deliveryStatus?.outcomeEmailSentAt || "",
          outcomeEmailKind: deliveryStatus?.outcomeEmailKind || "",
        };
        const emailResult = await sendDeliveryDispatchNotification(challan, statusForEmail);
        if (!emailResult.ok) {
          setMessage({
            tone: "error",
            text: `Milestone saved, but dispatch email failed: ${emailResult.message || "Unknown error"}`,
          });
          return;
        }
        setMessage({
          tone: "ok",
          text: "Shipment milestone saved. Dispatch email sent to customer.",
        });
        return;
      }

      setMessage({
        tone: "ok",
        text: to
          ? "Shipment milestone saved. Email is stored for dispatch notification."
          : "Shipment milestone saved.",
      });
    } catch (err) {
      setMessage({
        tone: "error",
        text: err instanceof ApiClientError ? err.message : "Failed to save milestone",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <DeliverySectionCard
      title="Shipment milestone"
      icon={Route}
      subtitle="Customer-facing tracker for this vendor PO"
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <FinanceField label="Milestone">
          <select
            className={SELECT_CLASS}
            value={milestone}
            onChange={(e) => setMilestone(e.target.value)}
          >
            {DELIVERY_MILESTONES.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </FinanceField>
        <FinanceField label="AWB / docket no.">
          <Input
            value={awb}
            onChange={(e) => setAwb(e.target.value)}
            className="h-9 text-[13px]"
          />
        </FinanceField>
        <FinanceField label="Note">
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="h-9 text-[13px]"
          />
        </FinanceField>
        <FinanceField label="Customer email (dispatch)">
          <div className="relative">
            <Mail
              className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              type="email"
              value={customerEmail}
              onChange={(e) => {
                const next = e.target.value;
                setCustomerEmail(next);
                onCustomerEmailChange?.(next);
              }}
              className="h-9 pl-8 text-[13px]"
              placeholder="customer@company.com"
              autoComplete="email"
            />
          </div>
        </FinanceField>
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">
        Enter the customer email to notify them when the order is dispatched (factory or site
        dispatch milestones).
      </p>
      <div className="mt-3 flex justify-end">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={busy}
          className="h-9 cursor-pointer transition-colors duration-200"
          onClick={() => void save()}
        >
          {busy ? "Saving…" : "Save milestone"}
        </Button>
      </div>
      {message ? (
        <p
          className={`mt-2 text-xs ${message.tone === "ok"
              ? "text-emerald-700 dark:text-emerald-400"
              : "text-destructive"
            }`}
        >
          {message.text}
        </p>
      ) : null}
    </DeliverySectionCard>
  );
}
