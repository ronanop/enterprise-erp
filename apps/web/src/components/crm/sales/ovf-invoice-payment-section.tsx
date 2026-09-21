"use client";

import { useCallback, useEffect, useState } from "react";
import { CircleCheck, FileText, TriangleAlert, Wallet } from "lucide-react";

import { CrmDetailGrid, CrmDetailItem, CrmSection } from "@/components/crm/crm-ui";
import { FinanceField, FinanceTextarea } from "@/components/finance/journals/finance-form-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiClientError } from "@/services/api-client";
import {
  getOvfInvoiceStatus,
  recordOvfInvoiceSubmission,
  updateOvfPayment,
  type OvfInvoiceStatus,
} from "@/services/sales-crm-service";

const PAYMENT_STATUS_LABEL: Record<OvfInvoiceStatus["payment_status"], string> = {
  not_invoiced: "Not invoiced",
  awaiting_payment: "Awaiting payment",
  overdue: "Overdue",
  received: "Received on time",
  delayed: "Received late",
};

const PAYMENT_STATUS_CLASS: Record<OvfInvoiceStatus["payment_status"], string> = {
  not_invoiced: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
  awaiting_payment: "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200",
  overdue: "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200",
  received: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200",
  delayed: "bg-amber-100 text-amber-900 dark:bg-amber-900/50 dark:text-amber-100",
};

const CHANNEL_HINT: Record<string, string> = {
  portal: "SAC lines only - the invoice is submitted on the customer portal.",
  physical: "HSN lines only - the invoice travels with the material from the warehouse.",
  mixed: "HSN and SAC lines - material invoice ships, service invoice goes on the portal.",
};

function dateOrDash(value: string | null): string {
  if (!value) return "-";
  return value.slice(0, 10);
}

type Props = {
  ovfId: string;
  /** Invoicing only starts once the order is with supply chain. */
  enabled: boolean;
};

export function OvfInvoicePaymentSection({ ovfId, enabled }: Props) {
  const [status, setStatus] = useState<OvfInvoiceStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [invoiceReference, setInvoiceReference] = useState("");
  const [paymentDueDate, setPaymentDueDate] = useState("");
  const [paymentReceivedDate, setPaymentReceivedDate] = useState("");
  const [delayReason, setDelayReason] = useState("");

  const load = useCallback(async () => {
    try {
      const row = await getOvfInvoiceStatus(ovfId);
      setStatus(row);
      setInvoiceReference(row.invoice_reference ?? "");
      setPaymentDueDate(row.payment_due_date?.slice(0, 10) ?? "");
      setPaymentReceivedDate(row.payment_received_date?.slice(0, 10) ?? "");
      setDelayReason(row.payment_delay_reason ?? "");
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to load invoice status");
    }
  }, [ovfId]);

  useEffect(() => {
    if (!enabled) return;
    void load();
  }, [enabled, load]);

  if (!enabled || !status) return null;

  async function run(work: () => Promise<OvfInvoiceStatus>) {
    setBusy(true);
    setError(null);
    try {
      const row = await work();
      setStatus(row);
      setDelayReason(row.payment_delay_reason ?? "");
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  const channel = status.invoice_channel;
  const lateWithoutReason =
    Boolean(paymentReceivedDate) &&
    Boolean(paymentDueDate) &&
    paymentReceivedDate > paymentDueDate &&
    !delayReason.trim();

  return (
    <CrmSection title="Invoice & Payment" icon={Wallet}>
      {error ? (
        <p className="mb-3 flex items-center gap-1.5 text-xs font-medium text-red-600">
          <TriangleAlert className="size-3.5" /> {error}
        </p>
      ) : null}

      <CrmDetailGrid>
        <CrmDetailItem label="Invoice Route">
          <span className="inline-flex items-center gap-1.5">
            <FileText className="size-3.5 text-muted-foreground" />
            {channel ? channel.charAt(0).toUpperCase() + channel.slice(1) : "-"}
          </span>
        </CrmDetailItem>
        <CrmDetailItem label="HSN / SAC Lines">
          {status.hsn_line_count} HSN · {status.sac_line_count} SAC
        </CrmDetailItem>
        <CrmDetailItem label="Submitted On Portal">
          {status.invoice_submitted_portal ? "Yes" : "No"}
        </CrmDetailItem>
        <CrmDetailItem label="Submitted On">{dateOrDash(status.invoice_submitted_at)}</CrmDetailItem>
        <CrmDetailItem label="Invoice Reference">{status.invoice_reference || "-"}</CrmDetailItem>
        <CrmDetailItem label="Payment Status">
          <Badge
            className={`rounded-full border-transparent px-2.5 py-0.5 text-[11px] font-semibold ${PAYMENT_STATUS_CLASS[status.payment_status]}`}
          >
            {PAYMENT_STATUS_LABEL[status.payment_status]}
          </Badge>
        </CrmDetailItem>
        <CrmDetailItem label="Payment Due">{dateOrDash(status.payment_due_date)}</CrmDetailItem>
        <CrmDetailItem label="Payment Received">
          {dateOrDash(status.payment_received_date)}
        </CrmDetailItem>
        <CrmDetailItem label="Delay (days)">{status.payment_delay_days}</CrmDetailItem>
      </CrmDetailGrid>

      {channel ? (
        <p className="mt-3 text-xs text-muted-foreground">{CHANNEL_HINT[channel]}</p>
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">
          No HSN or SAC code on the quote lines yet, so the invoice route cannot be decided
          automatically.
        </p>
      )}

      <h3 className="mt-4 border-t border-border/70 pt-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        Record Invoice Submission
      </h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <FinanceField label="Invoice reference">
          <Input
            value={invoiceReference}
            onChange={(e) => setInvoiceReference(e.target.value)}
            placeholder="INV-0001"
            className="h-9 text-[13px]"
          />
        </FinanceField>
        <FinanceField label="Payment due date">
          <Input
            type="date"
            value={paymentDueDate}
            onChange={(e) => setPaymentDueDate(e.target.value)}
            className="h-9 cursor-pointer text-[13px]"
          />
        </FinanceField>
        <div className="flex items-end gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy}
            className="cursor-pointer transition-colors duration-200"
            onClick={() =>
              void run(() =>
                recordOvfInvoiceSubmission(ovfId, {
                  invoice_reference: invoiceReference.trim() || null,
                  submitted_on_portal: status.portal_submission_required,
                  payment_due_date: paymentDueDate || null,
                }),
              )
            }
          >
            <CircleCheck className="size-3.5" />
            {status.portal_submission_required ? "Submitted on portal" : "Invoice raised"}
          </Button>
        </div>
      </div>

      <h3 className="mt-4 border-t border-border/70 pt-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        Payment Follow-up
      </h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <FinanceField label="Payment received on">
          <Input
            type="date"
            value={paymentReceivedDate}
            onChange={(e) => setPaymentReceivedDate(e.target.value)}
            className="h-9 cursor-pointer text-[13px]"
          />
        </FinanceField>
        <FinanceField
          label={lateWithoutReason ? "Reason for delay *" : "Reason for delay"}
          className="sm:col-span-2"
        >
          <FinanceTextarea
            value={delayReason}
            onChange={(e) => setDelayReason(e.target.value)}
            placeholder="Why did the payment land after the due date?"
            className="min-h-[64px] text-[13px]"
          />
        </FinanceField>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={busy || lateWithoutReason}
          className="cursor-pointer transition-colors duration-200"
          onClick={() =>
            void run(() =>
              updateOvfPayment(ovfId, {
                payment_received_date: paymentReceivedDate || null,
                payment_due_date: paymentDueDate || null,
                payment_delay_reason: delayReason.trim() || null,
              }),
            )
          }
        >
          Save payment update
        </Button>
        {lateWithoutReason ? (
          <span className="text-xs text-amber-700 dark:text-amber-400">
            A late payment needs a reason on record before it can be closed off.
          </span>
        ) : null}
      </div>
    </CrmSection>
  );
}
