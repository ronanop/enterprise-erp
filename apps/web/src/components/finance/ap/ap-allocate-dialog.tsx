"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  FinanceField,
  FinanceSelect,
} from "@/components/finance/journals/finance-form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiClientError } from "@/services/api-client";
import {
  allocatePayment,
  listApEntries,
  type ApEntry,
} from "@/services/ap-service";
import { formatInrPrecise } from "@/services/finance-service";

type Option = { id: string; label: string; balance: number };

type AllocationRow = {
  invoice_id: string;
  amount: string;
};

type Props = {
  open: boolean;
  payment?: ApEntry | null;
  onClose: () => void;
  onSaved: () => void;
};

export function ApAllocateDialog({ open, payment, onClose, onSaved }: Props) {
  const [payments, setPayments] = useState<Option[]>([]);
  const [invoices, setInvoices] = useState<Option[]>([]);
  const [paymentId, setPaymentId] = useState("");
  const [rows, setRows] = useState<AllocationRow[]>([{ invoice_id: "", amount: "" }]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedPayment = useMemo(
    () => payments.find((r) => r.id === paymentId),
    [payments, paymentId],
  );

  const loadData = useCallback(async (vendorId?: string) => {
    try {
      const [paymentData, invoiceData] = await Promise.all([
        listApEntries({ document_type: "payment", paged: true, page_size: 500 }),
        vendorId
          ? listApEntries({ vendor_id: vendorId, document_type: "invoice", paged: true, page_size: 500 })
          : listApEntries({ document_type: "invoice", paged: true, page_size: 500 }),
      ]);
      const paymentItems = paymentData.items.filter(
        (r) => (r.document_type === "payment" || r.document_type === "allocation") && r.balance_amount > 0,
      );
      setPayments(
        paymentItems.map((r) => ({
          id: r.id,
          label: `${r.document_number} · ${formatInrPrecise(r.balance_amount)}`,
          balance: r.balance_amount,
        })),
      );
      const openInvoices = invoiceData.items.filter(
        (i) => (i.status === "open" || i.status === "partial") && i.balance_amount > 0,
      );
      setInvoices(
        openInvoices.map((i) => ({
          id: i.id,
          label: `${i.document_number} · ${i.vendor_name ?? ""}`,
          balance: i.balance_amount,
        })),
      );
    } catch {
      setPayments([]);
      setInvoices([]);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const vendId = payment?.vendor_id;
    void loadData(vendId);
    setPaymentId(payment?.id ?? "");
    setRows([{ invoice_id: "", amount: "" }]);
    setError(null);
  }, [open, payment, loadData]);

  const totalAllocated = useMemo(
    () => rows.reduce((s, r) => s + (Number(r.amount) || 0), 0),
    [rows],
  );

  const paymentBalance = selectedPayment?.balance ?? payment?.balance_amount ?? 0;
  const remaining = paymentBalance - totalAllocated;

  function updateRow(index: number, patch: Partial<AllocationRow>) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  function addRow() {
    setRows((prev) => [...prev, { invoice_id: "", amount: "" }]);
  }

  function removeRow(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index));
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      if (!paymentId) {
        setError("Select a payment to allocate.");
        return;
      }
      const allocations = rows
        .filter((r) => r.invoice_id && Number(r.amount) > 0)
        .map((r) => ({ invoice_id: r.invoice_id, amount: Number(r.amount) }));
      if (allocations.length === 0) {
        setError("Add at least one allocation line.");
        return;
      }
      if (totalAllocated > paymentBalance + 0.0001) {
        setError("Total allocation exceeds payment balance.");
        return;
      }
      await allocatePayment({ payment_id: paymentId, allocations });
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to allocate payment");
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4" role="presentation" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-border/80 bg-card p-4 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-sm font-medium tracking-tight">Allocate payment</h2>
        <p className="mt-1 text-xs text-muted-foreground">Apply payment balance to open invoices.</p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <FinanceField label="Payment" className="sm:col-span-2">
            <FinanceSelect value={paymentId} onChange={(e) => setPaymentId(e.target.value)}>
              <option value="">Select payment</option>
              {payments.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </FinanceSelect>
          </FinanceField>
          <div className="rounded-lg border border-border/70 bg-muted/20 p-2 text-xs sm:col-span-2">
            <span className="text-muted-foreground">Payment balance: </span>
            <span className="font-mono tabular-nums">{formatInrPrecise(paymentBalance)}</span>
            <span className="mx-2 text-muted-foreground/40">·</span>
            <span className="text-muted-foreground">Remaining after allocation: </span>
            <span className={`font-mono tabular-nums ${remaining < 0 ? "text-destructive" : ""}`}>{formatInrPrecise(remaining)}</span>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Allocations</h3>
            <Button type="button" variant="outline" size="sm" className="h-7 cursor-pointer text-xs" onClick={addRow}>Add line</Button>
          </div>
          {rows.map((row, index) => {
            const inv = invoices.find((i) => i.id === row.invoice_id);
            const invBalance = inv?.balance ?? 0;
            const allocAmt = Number(row.amount) || 0;
            const lineRemaining = invBalance - allocAmt;
            return (
              <div key={index} className="grid gap-2 rounded-lg border border-border/60 p-2 sm:grid-cols-[1fr_120px_120px_120px_auto]">
                <FinanceField label="Invoice">
                  <FinanceSelect value={row.invoice_id} onChange={(e) => updateRow(index, { invoice_id: e.target.value })}>
                    <option value="">Select invoice</option>
                    {invoices.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                  </FinanceSelect>
                </FinanceField>
                <FinanceField label="Invoice balance">
                  <Input className="h-8 font-mono text-xs" readOnly value={inv ? formatInrPrecise(invBalance) : "—"} />
                </FinanceField>
                <FinanceField label="Allocation">
                  <Input type="number" min={0} step="0.01" className="h-8 font-mono" value={row.amount} onChange={(e) => updateRow(index, { amount: e.target.value })} />
                </FinanceField>
                <FinanceField label="Remaining">
                  <Input className="h-8 font-mono text-xs" readOnly value={row.invoice_id ? formatInrPrecise(lineRemaining) : "—"} />
                </FinanceField>
                <div className="flex items-end pb-0.5">
                  <Button type="button" variant="ghost" size="sm" className="h-8 cursor-pointer text-xs" onClick={() => removeRow(index)} disabled={rows.length <= 1}>Remove</Button>
                </div>
              </div>
            );
          })}
        </div>

        {error ? <p className="mt-3 text-xs text-destructive">{error}</p> : null}

        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="outline" className="cursor-pointer" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button type="button" className="cursor-pointer" onClick={() => void submit()} disabled={busy}>
            {busy ? "Allocating…" : "Allocate"}
          </Button>
        </div>
      </div>
    </div>
  );
}
