"use client";

import { useEffect, useState } from "react";
import {
  CalendarClock,
  Mail,
  MailCheck,
  Send,
  TriangleAlert,
} from "lucide-react";

import { DeliveryCorrespondencePanel } from "@/components/procurement/delivery-correspondence-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiClientError } from "@/services/api-client";
import {
  getScmDeliveryContact,
  sendScmDeliveryAcknowledgement,
  type ProcOrder,
} from "@/services/procurement-service";

function dateOnly(value: string | null | undefined): string {
  return value ? value.slice(0, 10) : "";
}

function displayDate(value: string | null | undefined): string {
  const raw = dateOnly(value);
  if (!raw) return "—";
  return raw;
}

type Props = {
  order: ProcOrder;
  /** Admins can trigger the scheduled correspondence pass by hand. */
  isAdmin: boolean;
  /** True once any receipt/GRN qty has been recorded on this PO. */
  grnStarted?: boolean;
  /** When true, Record GRN stays locked until acknowledgement is sent. */
  lockGrnUntilAck?: boolean;
  onSaved: () => void;
};

/**
 * Expected delivery date and customer acknowledgement.
 * Send emails the acknowledgement (with ETD) over SMTP and unlocks Record GRN once.
 */
export function DeliveryTrackingCard({
  order,
  isAdmin,
  grnStarted = false,
  lockGrnUntilAck = false,
  onSaved,
}: Props) {
  const [etd, setEtd] = useState(dateOnly(order.expected_delivery_date));
  const [email, setEmail] = useState("");
  const [crmEmail, setCrmEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [correspondenceKey, setCorrespondenceKey] = useState(0);

  const ackSent = Boolean(order.customer_ack_sent_at);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const contact = await getScmDeliveryContact(order.id);
        if (cancelled) return;
        const fromCrm = (contact.crm_email || contact.email || "").trim();
        setCrmEmail(fromCrm || null);
        setEmail(fromCrm);
      } catch {
        if (!cancelled) {
          setCrmEmail(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [order.id]);

  useEffect(() => {
    setEtd(dateOnly(order.expected_delivery_date));
  }, [order.expected_delivery_date]);

  async function sendDummyAck() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      // One click: persist ETD (when set) and email acknowledgement together.
      const row = await sendScmDeliveryAcknowledgement(order.id, {
        email: email.trim() || null,
        expected_delivery_date: etd || null,
      });
      setNotice(row.message);
      setCorrespondenceKey((k) => k + 1);
      onSaved();
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : "Failed to send acknowledgement",
      );
    } finally {
      setBusy(false);
    }
  }

  const awaitingEtd = !order.expected_delivery_date;

  const statusBadge = ackSent ? (
    <Badge className="rounded-full border-transparent bg-emerald-100 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200">
      Acknowledgement sent
    </Badge>
  ) : grnStarted ? (
    <Badge className="rounded-full border-transparent bg-emerald-100 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200">
      GRN started — ack not required again
    </Badge>
  ) : awaitingEtd ? (
    <Badge className="rounded-full border-transparent bg-amber-100 px-2.5 py-0.5 text-[11px] font-semibold text-amber-900 dark:bg-amber-900/50 dark:text-amber-100">
      Awaiting ETD from distributor
    </Badge>
  ) : (
    <Badge className="rounded-full border-transparent bg-emerald-100 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200">
      ETD confirmed
    </Badge>
  );

  return (
    <section className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-[0_1px_3px_0_rgba(0,0,0,0.03)]">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border/70 bg-muted/30 px-4 py-3.5 sm:px-5">
        <div className="flex min-w-0 items-start gap-2.5">
          <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <CalendarClock className="size-4" strokeWidth={1.75} aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold tracking-tight text-foreground sm:text-base">
              Delivery Tracking
            </h2>
            <p className="mt-0.5 max-w-xl text-xs leading-relaxed text-muted-foreground">
              {lockGrnUntilAck
                ? "Send acknowledgement once (SMTP) to unlock Record GRN. The mail includes the expected delivery date."
                : ackSent || grnStarted
                  ? "Acknowledgement is only required once before the first GRN. Further receipts stay unlocked."
                  : "Expected delivery date and customer correspondence."}
            </p>
          </div>
        </div>
        {statusBadge}
      </header>

      <div className="space-y-4 p-4 sm:p-5">
        {error ? (
          <p
            role="alert"
            className="flex items-center gap-1.5 rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-2 text-xs font-medium text-destructive"
          >
            <TriangleAlert className="size-3.5 shrink-0" aria-hidden /> {error}
          </p>
        ) : null}
        {notice ? (
          <p
            role="status"
            className="flex items-center gap-1.5 rounded-lg border border-emerald-200/80 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300"
          >
            <MailCheck className="size-3.5 shrink-0" aria-hidden /> {notice}
          </p>
        ) : null}

        <dl className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {[
            {
              label: "Customer acknowledged",
              value: displayDate(order.customer_ack_sent_at),
            },
            {
              label: "Last ETD reminder",
              value: displayDate(order.etd_reminder_last_sent_at),
            },
            {
              label: "ETD confirmed on",
              value: displayDate(order.etd_confirmed_at),
            },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5"
            >
              <dt className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                {item.label}
              </dt>
              <dd className="mt-1 text-sm font-semibold tabular-nums text-foreground">
                {item.value}
              </dd>
            </div>
          ))}
        </dl>

        <div className="flex flex-col gap-3 rounded-xl border border-border/70 bg-background p-3.5 sm:p-4">
          <div className="flex items-center gap-2">
            <span className="inline-flex size-7 items-center justify-center rounded-md bg-muted text-foreground">
              <Mail className="size-3.5" aria-hidden />
            </span>
            <div>
              <h3 className="text-xs font-semibold tracking-tight text-foreground">
                Customer acknowledgement
              </h3>
              <p className="text-[11px] text-muted-foreground">
                Set ETD and email, then Send once — saves the date and emails the customer together.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            <label className="min-w-0 space-y-1.5">
              <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                Customer email
              </span>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="customer@company.com"
                disabled={busy || ackSent}
                className="h-9 cursor-text text-[13px] transition-colors duration-200"
                aria-label="Customer email for acknowledgement"
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                Expected delivery date
              </span>
              <Input
                type="date"
                value={etd}
                onChange={(e) => setEtd(e.target.value)}
                disabled={busy || ackSent}
                className="h-9 w-full max-w-[11.5rem] cursor-pointer text-[13px] transition-colors duration-200"
              />
            </label>
          </div>

          <p className="text-[11px] leading-snug text-muted-foreground">
            {crmEmail
              ? `CRM company email: ${crmEmail}. You can change it before sending.`
              : "No email on the CRM company — enter one to send."}
          </p>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button
              type="button"
              size="sm"
              disabled={busy || ackSent || !email.trim()}
              className="h-9 cursor-pointer transition-colors duration-200"
              onClick={() => void sendDummyAck()}
            >
              <Send className="mr-1.5 size-3.5" aria-hidden />
              {ackSent ? "Acknowledgement sent" : "Send acknowledgement"}
            </Button>
            {lockGrnUntilAck ? (
              <p className="text-[11px] text-amber-800 dark:text-amber-200">
                Record GRN locked until send.
              </p>
            ) : null}
          </div>
        </div>

        <DeliveryCorrespondencePanel
          orderId={order.id}
          customerName={order.customer_name}
          refreshKey={correspondenceKey}
          canEditTemplates={isAdmin}
        />
      </div>
    </section>
  );
}
