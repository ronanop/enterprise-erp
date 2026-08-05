"use client";

import { CalendarClock, MapPin, PackageSearch } from "lucide-react";

import { FinanceField, FinanceSelect, FinanceTextarea } from "@/components/finance/journals/finance-form-field";
import { DeliverySectionCard } from "@/components/procurement/delivery-section-card";
import { Input } from "@/components/ui/input";
import {
  SHIPMENT_STATUS_OPTIONS,
  applyShipmentStatusToActualDate,
  isDeliveredShipmentStatus,
  type DeliveryStatusFormErrors,
  type DeliveryStatusRecord,
} from "@/utils/delivery-status-storage";

export type DeliveryStatusFormValue = Omit<DeliveryStatusRecord, "challanId" | "updatedAt">;

type DeliveryStatusFormProps = {
  value: DeliveryStatusFormValue;
  onChange: (next: DeliveryStatusFormValue) => void;
  compact?: boolean;
  showLocationSection?: boolean;
  fieldErrors?: DeliveryStatusFormErrors;
  /** After first save — only shipment status is editable. */
  mode?: "initial" | "tracking" | "shipment-only";
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function DeliveryStatusForm({
  value,
  onChange,
  compact,
  showLocationSection = true,
  fieldErrors = {},
  mode = "initial",
}: DeliveryStatusFormProps) {
  function patch(partial: Partial<DeliveryStatusFormValue>) {
    onChange(applyShipmentStatusToActualDate({ ...value, ...partial }));
  }

  function onShipmentStatusChange(nextStatus: string) {
    const base = { ...value, shipmentStatus: nextStatus };
    onChange(applyShipmentStatusToActualDate(base));
  }

  const statusCard = (
    <DeliverySectionCard title="Shipment status" icon={PackageSearch}>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <FinanceField label="Shipment status">
          <FinanceSelect
            value={value.shipmentStatus}
            onChange={(e) => onShipmentStatusChange(e.target.value)}
            className="h-8"
          >
            {SHIPMENT_STATUS_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </FinanceSelect>
        </FinanceField>
        {isDeliveredShipmentStatus(value.shipmentStatus) && value.actualDeliveryDate ? (
          <p className="text-xs text-muted-foreground sm:col-span-2 lg:col-span-3">
            Actual delivery date recorded:{" "}
            <span className="font-medium tabular-nums text-foreground">
              {value.actualDeliveryDate}
            </span>
          </p>
        ) : null}
      </div>
    </DeliverySectionCard>
  );

  const datesCard = (
    <DeliverySectionCard title="Delivery dates" icon={CalendarClock}>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <FinanceField label="Dispatch date *" error={fieldErrors.dispatchDate}>
          <Input
            type="date"
            required
            value={value.dispatchDate}
            onChange={(e) => patch({ dispatchDate: e.target.value })}
            className="h-8"
          />
        </FinanceField>
        <FinanceField label="Reminder email *" error={fieldErrors.reminderEmail}>
          <Input
            type="email"
            required
            autoComplete="email"
            value={value.reminderEmail}
            onChange={(e) => patch({ reminderEmail: e.target.value })}
            className="h-8"
            placeholder="name@company.com"
          />
        </FinanceField>
        <FinanceField label="Expected delivery date *" error={fieldErrors.expectedDeliveryDate}>
          <Input
            type="date"
            required
            value={value.expectedDeliveryDate}
            onChange={(e) => patch({ expectedDeliveryDate: e.target.value })}
            className="h-8"
            min={value.dispatchDate || todayIso()}
          />
        </FinanceField>
      </div>
    </DeliverySectionCard>
  );

  const courierCard = (
    <DeliverySectionCard title="Courier & tracking" icon={PackageSearch}>
      <div className="grid gap-3 sm:grid-cols-2">
        <FinanceField label="Courier / transport details">
          <FinanceTextarea
            value={value.courierTransportDetails}
            onChange={(e) => patch({ courierTransportDetails: e.target.value })}
            rows={compact ? 2 : 3}
            placeholder="Courier name, contact, vehicle, etc."
          />
        </FinanceField>
        <FinanceField label="Tracking number (if applicable)">
          <Input
            value={value.trackingNumber}
            onChange={(e) => patch({ trackingNumber: e.target.value })}
            className="h-8"
            placeholder="AWB / tracking ID"
          />
        </FinanceField>
      </div>
    </DeliverySectionCard>
  );

  const locationCard = (
    <DeliverySectionCard title="Delivery location & receiver" icon={MapPin}>
      <div className="grid gap-3 sm:grid-cols-2">
        <FinanceField label="Delivery location">
          <FinanceTextarea
            value={value.deliveryLocation}
            onChange={(e) => patch({ deliveryLocation: e.target.value })}
            rows={compact ? 2 : 4}
            placeholder="Full delivery address"
          />
        </FinanceField>
        <FinanceField label="Receiver details">
          <FinanceTextarea
            value={value.receiverDetails}
            onChange={(e) => patch({ receiverDetails: e.target.value })}
            rows={compact ? 2 : 4}
            placeholder="Receiver name, phone, ID proof, remarks"
          />
        </FinanceField>
      </div>
    </DeliverySectionCard>
  );

  if (mode === "shipment-only") {
    return <div className="space-y-4">{statusCard}</div>;
  }

  const savedDetailsCard =
    mode === "tracking" ? (
      <DeliverySectionCard title="Saved shipment details" icon={CalendarClock}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <ReadOnlySummary label="Dispatch date" value={value.dispatchDate} />
          <ReadOnlySummary label="Reminder email" value={value.reminderEmail} />
          <ReadOnlySummary label="Expected delivery" value={value.expectedDeliveryDate} />
          <ReadOnlySummary label="Courier / transport" value={value.courierTransportDetails} />
          <ReadOnlySummary label="Tracking number" value={value.trackingNumber} />
        </div>
      </DeliverySectionCard>
    ) : null;

  if (compact) {
    return (
      <div className="space-y-3">
        {savedDetailsCard}
        {statusCard}
        {mode === "initial" ? datesCard : null}
        {mode === "initial" ? courierCard : null}
        {showLocationSection && mode === "initial" ? locationCard : null}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {savedDetailsCard}
      {statusCard}
      {mode === "initial" ? datesCard : null}
      {mode === "initial" ? courierCard : null}
      {showLocationSection && mode === "initial" ? locationCard : null}
    </div>
  );
}

function ReadOnlySummary({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-0.5">
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="text-sm text-foreground">{value.trim() || "—"}</div>
    </div>
  );
}

export function deliveryStatusToFormValue(
  record: DeliveryStatusRecord,
): DeliveryStatusFormValue {
  return {
    shipmentStatus: record.shipmentStatus,
    dispatchDate: record.dispatchDate,
    reminderEmail: record.reminderEmail,
    expectedDeliveryDate: record.expectedDeliveryDate,
    actualDeliveryDate: record.actualDeliveryDate,
    courierTransportDetails: record.courierTransportDetails,
    trackingNumber: record.trackingNumber,
    deliveryLocation: record.deliveryLocation,
    receiverDetails: record.receiverDetails,
  };
}
