"use client";

import { useEffect, useMemo, useState } from "react";

import { ConfirmDialog } from "@/components/finance/journals/confirm-dialog";
import {
  FinanceField,
  FinanceTextarea,
} from "@/components/finance/journals/finance-form-field";
import { Input } from "@/components/ui/input";

export type ManualInventoryStockDraft = {
  product_name: string;
  description: string | null;
  serial_number: string;
  order_id: string | null;
  warranty_valid_till: string | null;
  vendor_name: string | null;
  vendor_invoice_number: string | null;
  vendor_invoice_date: string | null;
  part_no: string | null;
  unit_cost: number | null;
  customer_name: string | null;
  sales_spoc: string | null;
  payment_terms: string | null;
  payment_due_date: string | null;
  received_on: string | null;
};

type ProcurementInventoryAddStockDialogProps = {
  open: boolean;
  busy?: boolean;
  error?: string | null;
  onClose: () => void;
  onConfirm: (lines: ManualInventoryStockDraft[]) => void;
};

function resizeSerials(prev: string[], qty: number): string[] {
  if (qty < 1) return [""];
  if (prev.length === qty) return prev;
  if (prev.length > qty) return prev.slice(0, qty);
  return [...prev, ...Array.from({ length: qty - prev.length }, () => "")];
}

function defaultWarrantyDate(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function parseMoney(raw: string): number | null {
  const cleaned = raw.replace(/,/g, "").trim();
  if (!cleaned) return null;
  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function ageingFromInvoiceDate(invoiceDate: string): number | null {
  const text = invoiceDate.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const start = new Date(`${text}T00:00:00`);
  if (Number.isNaN(start.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.floor((today.getTime() - start.getTime()) / 86_400_000);
  return days >= 0 ? days : 0;
}

export function ProcurementInventoryAddStockDialog({
  open,
  busy,
  error,
  onClose,
  onConfirm,
}: ProcurementInventoryAddStockDialogProps) {
  const [itemDescription, setItemDescription] = useState("");
  const [vendorName, setVendorName] = useState("");
  const [invoiceNo, setInvoiceNo] = useState("");
  const [invoiceDate, setInvoiceDate] = useState("");
  const [partNo, setPartNo] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unitPrice, setUnitPrice] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [salesSpoc, setSalesSpoc] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("");
  const [paymentDueDate, setPaymentDueDate] = useState("");
  const [serials, setSerials] = useState<string[]>([""]);
  const [warrantyValidTill, setWarrantyValidTill] = useState(defaultWarrantyDate);
  const [localError, setLocalError] = useState<string | null>(null);

  const qty = useMemo(() => {
    const n = Number.parseInt(quantity, 10);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }, [quantity]);

  const unitPriceValue = useMemo(() => parseMoney(unitPrice), [unitPrice]);
  const amountValue = useMemo(() => {
    if (qty < 1 || unitPriceValue == null) return null;
    return Math.round(qty * unitPriceValue * 100) / 100;
  }, [qty, unitPriceValue]);
  const ageingDays = useMemo(() => ageingFromInvoiceDate(invoiceDate), [invoiceDate]);

  useEffect(() => {
    if (!open) {
      setItemDescription("");
      setVendorName("");
      setInvoiceNo("");
      setInvoiceDate("");
      setPartNo("");
      setQuantity("1");
      setUnitPrice("");
      setCustomerName("");
      setSalesSpoc("");
      setPaymentTerms("");
      setPaymentDueDate("");
      setSerials([""]);
      setWarrantyValidTill(defaultWarrantyDate());
      setLocalError(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setSerials((prev) => resizeSerials(prev, qty > 0 ? qty : 1));
  }, [open, qty]);

  function setSerialAt(index: number, value: string) {
    setSerials((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  }

  function onSave() {
    const name = itemDescription.trim();
    if (!name) {
      setLocalError("Item Description is required.");
      return;
    }
    if (qty < 1) {
      setLocalError("Enter a Qty of at least 1.");
      return;
    }
    if (unitPrice.trim() && unitPriceValue == null) {
      setLocalError("Enter a valid Unit Price.");
      return;
    }
    const trimmed = serials.slice(0, qty).map((s) => s.trim());
    const emptyIndex = trimmed.findIndex((s) => !s);
    if (emptyIndex >= 0) {
      setLocalError(`Enter serial number for unit ${emptyIndex + 1}.`);
      return;
    }
    const unique = new Set(trimmed.map((s) => s.toLowerCase()));
    if (unique.size !== trimmed.length) {
      setLocalError("Each unit needs a unique serial number.");
      return;
    }

    const invoice = invoiceDate.trim() || null;
    const due = paymentDueDate.trim() || null;
    const warranty = warrantyValidTill.trim() || null;
    setLocalError(null);
    onConfirm(
      trimmed.map((serial_number) => ({
        product_name: name,
        description: name,
        serial_number,
        order_id: null,
        warranty_valid_till: warranty,
        vendor_name: vendorName.trim() || null,
        vendor_invoice_number: invoiceNo.trim() || null,
        vendor_invoice_date: invoice,
        part_no: partNo.trim() || null,
        unit_cost: unitPriceValue,
        customer_name: customerName.trim() || null,
        sales_spoc: salesSpoc.trim() || null,
        payment_terms: paymentTerms.trim() || null,
        payment_due_date: due,
        received_on: invoice,
      })),
    );
  }

  const displayError = localError || error;

  return (
    <ConfirmDialog
      open={open}
      title="Add stock manually"
      confirmLabel={busy ? "Saving…" : "Add to stock"}
      cancelLabel="Cancel"
      busy={busy}
      confirmDisabled={busy}
      contentClassName="max-w-3xl"
      onConfirm={onSave}
      onCancel={() => {
        if (!busy) onClose();
      }}
    >
      <div className="mt-3 space-y-3">
        {displayError ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {displayError}
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FinanceField label="Item Description *" className="sm:col-span-2">
            <FinanceTextarea
              value={itemDescription}
              onChange={(e) => setItemDescription(e.target.value)}
              rows={2}
              placeholder="Item description"
              disabled={busy}
              autoFocus
            />
          </FinanceField>

          <FinanceField label="Vendor Name">
            <Input
              value={vendorName}
              onChange={(e) => setVendorName(e.target.value)}
              className="h-9"
              placeholder="Vendor name"
              disabled={busy}
            />
          </FinanceField>

          <FinanceField label="Invoice No.">
            <Input
              value={invoiceNo}
              onChange={(e) => setInvoiceNo(e.target.value)}
              className="h-9"
              placeholder="Vendor invoice number"
              disabled={busy}
            />
          </FinanceField>

          <FinanceField label="Invoice Date">
            <Input
              type="date"
              value={invoiceDate}
              onChange={(e) => setInvoiceDate(e.target.value)}
              className="h-9"
              disabled={busy}
            />
          </FinanceField>

          <FinanceField label="Part No.">
            <Input
              value={partNo}
              onChange={(e) => setPartNo(e.target.value)}
              className="h-9"
              placeholder="Part / SKU"
              disabled={busy}
            />
          </FinanceField>

          <FinanceField label="Qty *">
            <Input
              type="number"
              min={1}
              step={1}
              value={quantity}
              onChange={(e) => {
                const raw = e.target.value.replace(/[^\d]/g, "");
                setQuantity(raw === "" ? "" : String(Math.max(1, Number.parseInt(raw, 10) || 1)));
              }}
              className="h-9"
              disabled={busy}
            />
          </FinanceField>

          <FinanceField label="Unit Price">
            <Input
              type="number"
              min={0}
              step="0.01"
              value={unitPrice}
              onChange={(e) => setUnitPrice(e.target.value)}
              className="h-9"
              placeholder="0.00"
              disabled={busy}
            />
          </FinanceField>

          <FinanceField label="Amount">
            <Input
              value={
                amountValue == null
                  ? ""
                  : amountValue.toLocaleString("en-IN", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })
              }
              className="h-9 bg-muted/40"
              readOnly
              tabIndex={-1}
              placeholder="Qty × Unit Price"
              disabled={busy}
            />
          </FinanceField>

          <FinanceField label="Aging">
            <Input
              value={ageingDays == null ? "" : `${ageingDays} day${ageingDays === 1 ? "" : "s"}`}
              className="h-9 bg-muted/40"
              readOnly
              tabIndex={-1}
              placeholder="From Invoice Date"
              disabled={busy}
            />
          </FinanceField>

          <FinanceField label="Customer Name">
            <Input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="h-9"
              placeholder="Customer name"
              disabled={busy}
            />
          </FinanceField>

          <FinanceField label="Sales SPOC">
            <Input
              value={salesSpoc}
              onChange={(e) => setSalesSpoc(e.target.value)}
              className="h-9"
              placeholder="Sales SPOC"
              disabled={busy}
            />
          </FinanceField>

          <FinanceField label="Payment Terms">
            <Input
              value={paymentTerms}
              onChange={(e) => setPaymentTerms(e.target.value)}
              className="h-9"
              placeholder="e.g. Net 30"
              disabled={busy}
            />
          </FinanceField>

          <FinanceField label="Payment Due Date">
            <Input
              type="date"
              value={paymentDueDate}
              onChange={(e) => setPaymentDueDate(e.target.value)}
              className="h-9"
              disabled={busy}
            />
          </FinanceField>

          <FinanceField label="Warranty valid till" className="sm:col-span-2">
            <Input
              type="date"
              value={warrantyValidTill}
              onChange={(e) => setWarrantyValidTill(e.target.value)}
              className="h-9"
              disabled={busy}
            />
          </FinanceField>
        </div>

        <div className="space-y-2">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Serial numbers * ({qty > 0 ? qty : 1} required)
          </p>
          <div className="max-h-40 space-y-2 overflow-y-auto pr-0.5">
            {(qty > 0 ? serials.slice(0, qty) : serials.slice(0, 1)).map((serial, index) => (
              <FinanceField key={`serial-${index}`} label={`Serial ${index + 1}`}>
                <Input
                  value={serial}
                  onChange={(e) => setSerialAt(index, e.target.value)}
                  className="h-9"
                  placeholder={`Serial for unit ${index + 1}`}
                  disabled={busy}
                />
              </FinanceField>
            ))}
          </div>
        </div>
      </div>
    </ConfirmDialog>
  );
}
