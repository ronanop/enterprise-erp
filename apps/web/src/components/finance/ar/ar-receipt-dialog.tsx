"use client";

import { useCallback, useEffect, useState } from "react";

import {
  FinanceField,
  FinanceSelect,
} from "@/components/finance/journals/finance-form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiClientError, resourceService } from "@/services/api-client";
import { createReceipt, listArEntries, runArAction, type ArEntry } from "@/services/ar-service";

type Option = { id: string; label: string };

type Props = {
  open: boolean;
  defaultCustomerId?: string;
  defaultInvoiceId?: string;
  onClose: () => void;
  onSaved: () => void;
};

export function ArReceiptDialog({
  open,
  defaultCustomerId,
  defaultInvoiceId,
  onClose,
  onSaved,
}: Props) {
  const [customers, setCustomers] = useState<Option[]>([]);
  const [branches, setBranches] = useState<Option[]>([]);
  const [invoices, setInvoices] = useState<Option[]>([]);
  const [branchId, setBranchId] = useState("");
  const [customerId, setCustomerId] = useState(defaultCustomerId ?? "");
  const [documentDate, setDocumentDate] = useState(new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState("");
  const [currencyCode, setCurrencyCode] = useState("INR");
  const [allocateToInvoiceId, setAllocateToInvoiceId] = useState(defaultInvoiceId ?? "");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadLookups = useCallback(async () => {
    const results = await Promise.allSettled([
      resourceService.list("/customers"),
      resourceService.list("/branches"),
    ]);
    if (results[0].status === "fulfilled") {
      const data = results[0].value.data;
      const list = Array.isArray(data) ? data : (data as { items?: unknown[] })?.items ?? [];
      setCustomers(
        list.map((row) => {
          const r = row as Record<string, unknown>;
          return { id: String(r.id), label: String(r.customer_name ?? r.name ?? r.customer_code ?? r.id) };
        }),
      );
    }
    if (results[1].status === "fulfilled") {
      const data = results[1].value.data;
      const list = Array.isArray(data) ? data : (data as { items?: unknown[] })?.items ?? [];
      const opts = list.map((row) => {
        const r = row as Record<string, unknown>;
        return { id: String(r.id), label: String(r.branch_name ?? r.name ?? r.id) };
      });
      setBranches(opts);
      if (opts[0] && !branchId) setBranchId(opts[0].id);
    }
  }, [branchId]);

  const loadInvoices = useCallback(async (custId: string) => {
    if (!custId) {
      setInvoices([]);
      return;
    }
    try {
      const data = await listArEntries({
        customer_id: custId,
        document_type: "invoice",
        status: "open",
        paged: true,
        page_size: 500,
      });
      const openItems = data.items.filter(
        (i) => (i.status === "open" || i.status === "partial") && i.balance_amount > 0,
      );
      setInvoices(
        openItems.map((i) => ({
          id: i.id,
          label: `${i.document_number} · ${i.balance_amount}`,
        })),
      );
    } catch {
      setInvoices([]);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    void loadLookups();
    setCustomerId(defaultCustomerId ?? "");
    setAllocateToInvoiceId(defaultInvoiceId ?? "");
    setDocumentDate(new Date().toISOString().slice(0, 10));
    setAmount("");
    setCurrencyCode("INR");
    setNotes("");
    setError(null);
  }, [open, defaultCustomerId, defaultInvoiceId, loadLookups]);

  useEffect(() => {
    if (customerId) void loadInvoices(customerId);
  }, [customerId, loadInvoices]);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const amt = Number(amount);
      if (!branchId || !customerId || !amt || amt <= 0) {
        setError("Branch, customer, and a positive amount are required.");
        return;
      }
      await createReceipt({
        branch_id: branchId,
        customer_id: customerId,
        document_date: documentDate,
        amount: amt,
        currency_code: currencyCode,
        allocate_to_invoice_id: allocateToInvoiceId || null,
        notes: notes || null,
      });
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to create receipt");
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
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border/80 bg-card p-4 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-sm font-medium tracking-tight">Record receipt</h2>
        <p className="mt-1 text-xs text-muted-foreground">Customer payment receipt with optional invoice allocation.</p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <FinanceField label="Branch">
            <FinanceSelect value={branchId} onChange={(e) => setBranchId(e.target.value)}>
              <option value="">Select branch</option>
              {branches.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </FinanceSelect>
          </FinanceField>
          <FinanceField label="Customer">
            <FinanceSelect value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
              <option value="">Select customer</option>
              {customers.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </FinanceSelect>
          </FinanceField>
          <FinanceField label="Receipt date">
            <Input type="date" className="h-8 font-mono" value={documentDate} onChange={(e) => setDocumentDate(e.target.value)} />
          </FinanceField>
          <FinanceField label="Currency">
            <Input className="h-8 font-mono uppercase" maxLength={3} value={currencyCode} onChange={(e) => setCurrencyCode(e.target.value.toUpperCase())} />
          </FinanceField>
          <FinanceField label="Amount" className="sm:col-span-2">
            <Input type="number" min={0} step="0.01" className="h-8 font-mono" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </FinanceField>
          <FinanceField label="Allocate to invoice (optional)" className="sm:col-span-2">
            <FinanceSelect value={allocateToInvoiceId} onChange={(e) => setAllocateToInvoiceId(e.target.value)}>
              <option value="">No immediate allocation</option>
              {invoices.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </FinanceSelect>
          </FinanceField>
          <FinanceField label="Notes" className="sm:col-span-2">
            <Input className="h-8" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional reference" />
          </FinanceField>
        </div>

        {error ? <p className="mt-3 text-xs text-destructive">{error}</p> : null}

        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="outline" className="cursor-pointer" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button type="button" className="cursor-pointer" onClick={() => void submit()} disabled={busy}>
            {busy ? "Saving…" : "Create receipt"}
          </Button>
        </div>
      </div>
    </div>
  );
}

type ReverseReceiptProps = {
  open: boolean;
  receipt: ArEntry | null;
  onClose: () => void;
  onDone: () => void;
};

export function ArReverseReceiptDialog({ open, receipt, onClose, onDone }: ReverseReceiptProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    if (!receipt) return;
    setBusy(true);
    setError(null);
    try {
      await runArAction(receipt.id, "reverse");
      onDone();
      onClose();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to reverse receipt");
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4" role="presentation" onClick={onClose}>
      <div role="dialog" aria-modal="true" className="w-full max-w-md rounded-xl border border-border/80 bg-card p-4 shadow-lg" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-sm font-medium tracking-tight">Reverse receipt?</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {receipt ? `Reverses receipt ${receipt.document_number}.` : ""}
        </p>
        {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="outline" className="cursor-pointer" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button type="button" variant="destructive" className="cursor-pointer" onClick={() => void confirm()} disabled={busy}>
            {busy ? "Working…" : "Reverse"}
          </Button>
        </div>
      </div>
    </div>
  );
}
