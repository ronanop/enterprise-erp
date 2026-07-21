"use client";

import { useCallback, useEffect, useState } from "react";

import { ConfirmDialog } from "@/components/finance/journals/confirm-dialog";
import {
  FinanceField,
  FinanceSelect,
} from "@/components/finance/journals/finance-form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiClientError, resourceService } from "@/services/api-client";
import {
  createArEntry,
  runArAction,
  updateArEntry,
  type ArEntry,
} from "@/services/ar-service";

type Option = { id: string; label: string };

type Props = {
  open: boolean;
  entry?: ArEntry | null;
  onClose: () => void;
  onSaved: () => void;
};

export function ArInvoiceFormDialog({ open, entry, onClose, onSaved }: Props) {
  const isEdit = Boolean(entry?.id);
  const [customers, setCustomers] = useState<Option[]>([]);
  const [branches, setBranches] = useState<Option[]>([]);
  const [branchId, setBranchId] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [documentDate, setDocumentDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState(new Date().toISOString().slice(0, 10));
  const [documentType, setDocumentType] = useState("invoice");
  const [debitAmount, setDebitAmount] = useState("");
  const [currencyCode, setCurrencyCode] = useState("INR");
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
          return {
            id: String(r.id),
            label: String(r.customer_name ?? r.name ?? r.customer_code ?? r.id),
          };
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

  useEffect(() => {
    if (!open) return;
    void loadLookups();
    if (entry) {
      setBranchId(entry.branch_id ?? "");
      setCustomerId(entry.customer_id);
      setDocumentDate(entry.document_date);
      setDueDate(entry.due_date);
      setDocumentType(entry.document_type);
      setDebitAmount(String(entry.debit_amount ?? ""));
      setCurrencyCode(entry.currency_code ?? "INR");
    } else {
      setCustomerId("");
      setDocumentDate(new Date().toISOString().slice(0, 10));
      setDueDate(new Date().toISOString().slice(0, 10));
      setDocumentType("invoice");
      setDebitAmount("");
      setCurrencyCode("INR");
    }
    setError(null);
  }, [open, entry, loadLookups]);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const amount = Number(debitAmount);
      if (!branchId || !customerId || !amount || amount <= 0) {
        setError("Branch, customer, and a positive amount are required.");
        return;
      }
      if (isEdit && entry) {
        await updateArEntry(entry.id, {
          document_date: documentDate,
          due_date: dueDate,
          debit_amount: amount,
          currency_code: currencyCode,
        });
      } else {
        await createArEntry({
          branch_id: branchId,
          customer_id: customerId,
          document_date: documentDate,
          due_date: dueDate,
          document_type: documentType,
          debit_amount: amount,
          credit_amount: 0,
          currency_code: currencyCode,
        });
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to save invoice");
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
        <h2 className="text-sm font-medium tracking-tight">{isEdit ? "Edit invoice" : "Create invoice"}</h2>
        <p className="mt-1 text-xs text-muted-foreground">Customer ledger invoice / debit note entry.</p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <FinanceField label="Branch">
            <FinanceSelect value={branchId} onChange={(e) => setBranchId(e.target.value)} disabled={isEdit}>
              <option value="">Select branch</option>
              {branches.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </FinanceSelect>
          </FinanceField>
          <FinanceField label="Customer">
            <FinanceSelect value={customerId} onChange={(e) => setCustomerId(e.target.value)} disabled={isEdit}>
              <option value="">Select customer</option>
              {customers.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </FinanceSelect>
          </FinanceField>
          <FinanceField label="Document type">
            <FinanceSelect value={documentType} onChange={(e) => setDocumentType(e.target.value)} disabled={isEdit}>
              <option value="invoice">Invoice</option>
              <option value="debit_note">Debit note</option>
            </FinanceSelect>
          </FinanceField>
          <FinanceField label="Currency">
            <Input className="h-8 font-mono uppercase" maxLength={3} value={currencyCode} onChange={(e) => setCurrencyCode(e.target.value.toUpperCase())} />
          </FinanceField>
          <FinanceField label="Invoice date">
            <Input type="date" className="h-8 font-mono" value={documentDate} onChange={(e) => setDocumentDate(e.target.value)} />
          </FinanceField>
          <FinanceField label="Due date">
            <Input type="date" className="h-8 font-mono" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </FinanceField>
          <FinanceField label="Amount (debit)" className="sm:col-span-2">
            <Input type="number" min={0} step="0.01" className="h-8 font-mono" value={debitAmount} onChange={(e) => setDebitAmount(e.target.value)} />
          </FinanceField>
        </div>

        {error ? <p className="mt-3 text-xs text-destructive">{error}</p> : null}

        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="outline" className="cursor-pointer" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button type="button" className="cursor-pointer" onClick={() => void submit()} disabled={busy}>
            {busy ? "Saving…" : isEdit ? "Update" : "Create"}
          </Button>
        </div>
      </div>
    </div>
  );
}

type ReverseProps = {
  open: boolean;
  entry: ArEntry | null;
  onClose: () => void;
  onDone: () => void;
};

export function ArReverseConfirmDialog({ open, entry, onClose, onDone }: ReverseProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    if (!entry) return;
    setBusy(true);
    setError(null);
    try {
      await runArAction(entry.id, "reverse");
      onDone();
      onClose();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to reverse entry");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <ConfirmDialog
        open={open}
        title="Reverse this entry?"
        description={entry ? `Creates a reversal for ${entry.document_number}.` : undefined}
        confirmLabel="Reverse"
        tone="destructive"
        busy={busy}
        onCancel={onClose}
        onConfirm={() => void confirm()}
      />
      {error && open ? <p className="fixed bottom-4 left-1/2 z-[60] -translate-x-1/2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">{error}</p> : null}
    </>
  );
}
