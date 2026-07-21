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
  allocateReceipt,
  listArEntries,
  type ArEntry,
} from "@/services/ar-service";
import { formatInrPrecise } from "@/services/finance-service";

type Option = { id: string; label: string; balance: number };

type AllocationRow = {
  invoice_id: string;
  amount: string;
};

type Props = {
  open: boolean;
  receipt?: ArEntry | null;
  onClose: () => void;
  onSaved: () => void;
};

export function ArAllocateDialog({ open, receipt, onClose, onSaved }: Props) {
  const [receipts, setReceipts] = useState<Option[]>([]);
  const [invoices, setInvoices] = useState<Option[]>([]);
  const [receiptId, setReceiptId] = useState("");
  const [rows, setRows] = useState<AllocationRow[]>([{ invoice_id: "", amount: "" }]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedReceipt = useMemo(
    () => receipts.find((r) => r.id === receiptId),
    [receipts, receiptId],
  );

  const loadData = useCallback(async (customerId?: string) => {
    try {
      const [receiptData, invoiceData] = await Promise.all([
        listArEntries({ document_type: "receipt", paged: true, page_size: 500 }),
        customerId
          ? listArEntries({ customer_id: customerId, document_type: "invoice", paged: true, page_size: 500 })
          : listArEntries({ document_type: "invoice", paged: true, page_size: 500 }),
      ]);
      const receiptItems = receiptData.items.filter(
        (r) => (r.document_type === "receipt" || r.document_type === "payment") && r.balance_amount > 0,
      );
      setReceipts(
        receiptItems.map((r) => ({
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
          label: `${i.document_number} · ${i.customer_name ?? ""}`,
          balance: i.balance_amount,
        })),
      );
    } catch {
      setReceipts([]);
      setInvoices([]);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const custId = receipt?.customer_id;
    void loadData(custId);
    setReceiptId(receipt?.id ?? "");
    setRows([{ invoice_id: "", amount: "" }]);
    setError(null);
  }, [open, receipt, loadData]);

  const totalAllocated = useMemo(
    () => rows.reduce((s, r) => s + (Number(r.amount) || 0), 0),
    [rows],
  );

  const receiptBalance = selectedReceipt?.balance ?? receipt?.balance_amount ?? 0;
  const remaining = receiptBalance - totalAllocated;

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
      if (!receiptId) {
        setError("Select a receipt to allocate.");
        return;
      }
      const allocations = rows
        .filter((r) => r.invoice_id && Number(r.amount) > 0)
        .map((r) => ({ invoice_id: r.invoice_id, amount: Number(r.amount) }));
      if (allocations.length === 0) {
        setError("Add at least one allocation line.");
        return;
      }
      if (totalAllocated > receiptBalance + 0.0001) {
        setError("Total allocation exceeds receipt balance.");
        return;
      }
      await allocateReceipt({ receipt_id: receiptId, allocations });
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to allocate receipt");
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
        <h2 className="text-sm font-medium tracking-tight">Allocate receipt</h2>
        <p className="mt-1 text-xs text-muted-foreground">Apply receipt balance to open invoices.</p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <FinanceField label="Receipt" className="sm:col-span-2">
            <FinanceSelect value={receiptId} onChange={(e) => setReceiptId(e.target.value)}>
              <option value="">Select receipt</option>
              {receipts.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </FinanceSelect>
          </FinanceField>
          <div className="rounded-lg border border-border/70 bg-muted/20 p-2 text-xs sm:col-span-2">
            <span className="text-muted-foreground">Receipt balance: </span>
            <span className="font-mono tabular-nums">{formatInrPrecise(receiptBalance)}</span>
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
