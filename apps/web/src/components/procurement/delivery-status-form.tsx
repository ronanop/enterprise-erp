"use client";

import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { FileText, Truck, Upload } from "lucide-react";

import {
  FinanceField,
  FinanceSelect,
  FinanceTextarea,
} from "@/components/finance/journals/finance-form-field";
import { DeliverySectionCard } from "@/components/procurement/delivery-section-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fileToBase64 } from "@/services/sales-crm-service";
import {
  addCustomCourierProvider,
  allCourierProviderOptions,
  COURIER_ADD_OTHER,
  readCustomCourierProviders,
} from "@/utils/delivery-courier-providers";
import {
  deriveDeliveryStatusLabel,
  isFailedShipmentStatus,
  openStoredDeliveryFile,
  type DeliveryStatusAttachment,
  SURFACE_MODE_OPTIONS,
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
  mode?: "initial" | "tracking" | "shipment-only";
};

function withDerivedStatus(value: DeliveryStatusFormValue): DeliveryStatusFormValue {
  const explicit = (value.shipmentStatus || "").trim();
  if (isFailedShipmentStatus(explicit)) {
    return {
      ...value,
      shipmentStatus: "Failed delivery",
      actualDeliveryDate: "",
      requiresInstallation: false,
      trackingNumber: value.docketNumber ?? "",
    };
  }
  if (explicit === "Delivered") {
    return {
      ...value,
      shipmentStatus: "Delivered",
      trackingNumber: value.docketNumber ?? "",
    };
  }
  return {
    ...value,
    shipmentStatus: deriveDeliveryStatusLabel({ ...value, shipmentStatus: "" }),
    trackingNumber: value.docketNumber ?? "",
  };
}

function safeText(value: string | null | undefined): string {
  return value ?? "";
}

export function DeliveryStatusForm({
  value,
  onChange,
  fieldErrors = {},
  mode: _mode = "initial",
}: DeliveryStatusFormProps) {
  const dispatchDate = safeText(value.dispatchDate);
  const expectedDeliveryDate = safeText(value.expectedDeliveryDate);
  const [customCouriers, setCustomCouriers] = useState(readCustomCourierProviders);
  const [otherCourierDraft, setOtherCourierDraft] = useState("");
  const courierOptions = useMemo(() => {
    const base = allCourierProviderOptions();
    const current = safeText(value.courierProvider).trim();
    if (current && !base.some((opt) => opt.toLowerCase() === current.toLowerCase())) {
      return [...base, current];
    }
    return base;
  }, [customCouriers, value.courierProvider]);
  const courierSelectValue = useMemo(() => {
    const current = safeText(value.courierProvider).trim();
    if (!current) return "";
    const match = courierOptions.find((opt) => opt.toLowerCase() === current.toLowerCase());
    return match ?? COURIER_ADD_OTHER;
  }, [value.courierProvider, courierOptions]);
  const showOtherCourierInput = courierSelectValue === COURIER_ADD_OTHER;

  function patch(partial: Partial<DeliveryStatusFormValue>) {
    onChange(withDerivedStatus({ ...value, ...partial }));
  }

  async function onPickFile(
    fileList: FileList | null,
    field: "cacheInvoiceDocument" | "podDocument",
  ) {
    const file = fileList?.[0];
    if (!file) return;
    const contentBase64 = await fileToBase64(file);
    patch({
      [field]: {
        fileName: file.name,
        contentBase64,
        contentType: file.type || "application/octet-stream",
      } satisfies DeliveryStatusAttachment,
    });
  }

  return (
    <div className="space-y-4">
      <DeliverySectionCard title="Cache invoice" icon={FileText}>
        <p className="mb-3 text-xs text-muted-foreground">
          Optional. DC is delivery without taking a bill. Record the customer bill later
          (any time — even after delivery status or installation).
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <FinanceField label="Cache invoice number" error={fieldErrors.cacheInvoiceNumber}>
            <Input
              value={safeText(value.cacheInvoiceNumber)}
              onChange={(e) => patch({ cacheInvoiceNumber: e.target.value })}
              className="h-8"
              placeholder="Invoice no. (optional)"
            />
          </FinanceField>
          <FileField
            label="Cache invoice document"
            error={fieldErrors.cacheInvoiceDocument}
          >
            <FilePickRow
              file={value.cacheInvoiceDocument}
              onPick={(files) => void onPickFile(files, "cacheInvoiceDocument")}
              onClear={() => patch({ cacheInvoiceDocument: null })}
              inputId="cache-invoice-document"
            />
          </FileField>
        </div>
      </DeliverySectionCard>

      <DeliverySectionCard title="Dispatch detail" icon={Truck}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <FinanceField label="Status *" error={fieldErrors.deliveryMode}>
            <FinanceSelect
              value={safeText(value.deliveryMode)}
              onChange={(e) => {
                const next = e.target.value === "courier" ? "courier" : e.target.value === "hand" ? "hand" : "";
                patch({
                  deliveryMode: next,
                  ...(next === "courier"
                    ? { deliveryBoyName: "", itemType: "", podDocument: null }
                    : { docketNumber: "", courierProvider: "" }),
                });
              }}
              className="h-8 cursor-pointer transition-colors duration-200"
            >
              <option value="">Select…</option>
              <option value="hand">By hand</option>
              <option value="courier">Courier</option>
            </FinanceSelect>
          </FinanceField>
        </div>

        {value.deliveryMode === "hand" || value.deliveryMode === "courier" ? (
          <>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <FinanceField label="No. of boxes" error={fieldErrors.boxCount}>
                <Input
                  type="text"
                  inputMode="numeric"
                  value={safeText(value.boxCount)}
                  onChange={(e) =>
                    patch({ boxCount: e.target.value.replace(/[^\d]/g, "") })
                  }
                  className="h-8"
                  placeholder="0"
                />
              </FinanceField>
              <FinanceField label="Mode of surface" error={fieldErrors.surfaceMode}>
                <FinanceSelect
                  value={safeText(value.surfaceMode)}
                  onChange={(e) => patch({ surfaceMode: e.target.value })}
                  className="h-8 cursor-pointer transition-colors duration-200"
                >
                  <option value="">Select…</option>
                  {SURFACE_MODE_OPTIONS.map((mode) => (
                    <option key={mode} value={mode}>
                      {mode}
                    </option>
                  ))}
                </FinanceSelect>
              </FinanceField>
            </div>
            <FinanceField label="Remarks" error={fieldErrors.remarks} className="mt-3">
              <FinanceTextarea
                value={safeText(value.remarks)}
                onChange={(e) => patch({ remarks: e.target.value })}
                rows={3}
                placeholder="Add remarks"
              />
            </FinanceField>
          </>
        ) : null}

        {value.deliveryMode === "hand" ? (
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <FinanceField label="Delivery person *" error={fieldErrors.deliveryBoyName}>
              <Input
                value={safeText(value.deliveryBoyName)}
                onChange={(e) => patch({ deliveryBoyName: e.target.value })}
                className="h-8"
              />
            </FinanceField>
            <FinanceField label="Item *" error={fieldErrors.itemType}>
              <FinanceSelect
                value={safeText(value.itemType)}
                onChange={(e) => {
                  const next =
                    e.target.value === "hardware"
                      ? "hardware"
                      : e.target.value === "software"
                        ? "software"
                        : "";
                  patch({
                    itemType: next,
                  });
                }}
                className="h-8 cursor-pointer transition-colors duration-200"
              >
                <option value="">Select…</option>
                <option value="hardware">Hardware</option>
                <option value="software">Software</option>
              </FinanceSelect>
            </FinanceField>
          </div>
        ) : null}

        {value.deliveryMode === "courier" ? (
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <FinanceField label="Courier *" error={fieldErrors.courierProvider}>
              <FinanceSelect
                value={courierSelectValue}
                onChange={(e) => {
                  const next = e.target.value;
                  if (next === COURIER_ADD_OTHER) {
                    setOtherCourierDraft(safeText(value.courierProvider));
                    patch({ courierProvider: "" });
                    return;
                  }
                  patch({ courierProvider: next });
                }}
                className="h-8 cursor-pointer transition-colors duration-200"
              >
                <option value="">Select…</option>
                {courierOptions.map((provider) => (
                  <option key={provider} value={provider}>
                    {provider}
                  </option>
                ))}
                <option value={COURIER_ADD_OTHER}>Add other…</option>
              </FinanceSelect>
            </FinanceField>
            {showOtherCourierInput ? (
              <div className="flex items-end gap-2 sm:col-span-2">
                <FinanceField label="Other courier" className="min-w-0 flex-1">
                  <Input
                    value={otherCourierDraft || safeText(value.courierProvider)}
                    onChange={(e) => setOtherCourierDraft(e.target.value)}
                    className="h-8"
                    placeholder="Enter courier name"
                  />
                </FinanceField>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 shrink-0 cursor-pointer transition-colors duration-200"
                  disabled={!otherCourierDraft.trim()}
                  onClick={() => {
                    const name = otherCourierDraft.trim();
                    if (!name) return;
                    const updated = addCustomCourierProvider(name);
                    setCustomCouriers(updated);
                    patch({ courierProvider: name });
                    setOtherCourierDraft("");
                  }}
                >
                  Add
                </Button>
              </div>
            ) : null}
            <FinanceField label="Docket number *" error={fieldErrors.docketNumber}>
              <Input
                value={safeText(value.docketNumber)}
                onChange={(e) => patch({ docketNumber: e.target.value })}
                className="h-8"
                placeholder="Docket / AWB no."
              />
            </FinanceField>
          </div>
        ) : null}
      </DeliverySectionCard>
    </div>
  );
}

function FileField({
  label,
  error,
  className,
  children,
}: {
  label: string;
  error?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={className}>
      <div className="space-y-1">
        <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
          {label}
        </span>
        {children}
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
      </div>
    </div>
  );
}

function FilePickRow({
  file,
  onPick,
  onClear,
  inputId,
}: {
  file: DeliveryStatusAttachment | null;
  onPick: (files: FileList | null) => void;
  onClear: () => void;
  inputId: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <input
        id={inputId}
        type="file"
        accept=".pdf,.png,.jpg,.jpeg,.webp"
        className="sr-only"
        onChange={(e) => {
          onPick(e.target.files);
          e.currentTarget.value = "";
        }}
      />
      {file ? (
        <>
          <button
            type="button"
            className="min-w-0 cursor-pointer truncate text-left text-sm font-medium text-[#0369A1] transition-colors duration-200 hover:underline"
            onClick={() => openStoredDeliveryFile(file)}
          >
            {file.fileName}
          </button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 shrink-0 cursor-pointer transition-colors duration-200"
            onClick={() => document.getElementById(inputId)?.click()}
          >
            Replace
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-8 shrink-0 cursor-pointer transition-colors duration-200"
            onClick={onClear}
          >
            Remove
          </Button>
        </>
      ) : (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 cursor-pointer gap-1.5 transition-colors duration-200"
          onClick={() => document.getElementById(inputId)?.click()}
        >
          <Upload className="size-3.5" />
          Upload
        </Button>
      )}
    </div>
  );
}

export function deliveryStatusToFormValue(
  record: DeliveryStatusRecord,
): DeliveryStatusFormValue {
  return {
    shipmentStatus: record.shipmentStatus || "Pending",
    dispatchDate: record.dispatchDate ?? "",
    reminderEmail: record.reminderEmail ?? "",
    expectedDeliveryDate: record.expectedDeliveryDate ?? "",
    actualDeliveryDate: record.actualDeliveryDate ?? "",
    courierTransportDetails: record.courierTransportDetails ?? "",
    courierProvider: record.courierProvider ?? record.courierTransportDetails ?? "",
    trackingNumber: record.docketNumber || record.trackingNumber || "",
    deliveryLocation: record.deliveryLocation ?? "",
    receiverDetails: record.receiverDetails ?? "",
    cachePoNumber: record.cachePoNumber ?? "",
    customerPoNumber: record.customerPoNumber ?? "",
    customerName: record.customerName ?? "",
    cacheInvoiceNumber: record.cacheInvoiceNumber ?? "",
    cacheInvoiceDocument: record.cacheInvoiceDocument ?? null,
    deliveryMode: record.deliveryMode ?? "",
    deliveryBoyName: record.deliveryBoyName ?? "",
    itemType: record.itemType ?? "",
    podDocument: record.podDocument ?? null,
    docketNumber: record.docketNumber || record.trackingNumber || "",
    boxCount: record.boxCount ?? "",
    surfaceMode: record.surfaceMode ?? "",
    remarks: record.remarks ?? "",
    billStatus: record.billStatus ?? "unbilled",
    billedQuantity: record.billedQuantity ?? "",
    billInvoiceNumber: record.billInvoiceNumber ?? "",
    billInvoiceDate: record.billInvoiceDate ?? "",
    billDocument: record.billDocument ?? null,
    billRemarks: record.billRemarks ?? "",
    billedAt: record.billedAt ?? "",
    requiresInstallation: Boolean(record.requiresInstallation),
  };
}
