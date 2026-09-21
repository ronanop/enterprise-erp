"use client";

import { useState } from "react";
import { CalendarClock, MailCheck, Send, TriangleAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiClientError } from "@/services/api-client";
import {
  runScmDeliveryNotifications,
  updateScmExpectedDeliveryDate,
  type ProcOrder,
} from "@/services/procurement-service";

function dateOnly(value: string | null | undefined): string {
  return value ? value.slice(0, 10) : "";
}

type Props = {
  order: ProcOrder;
  /** Admins can trigger the scheduled correspondence pass by hand. */
  isAdmin: boolean;
  onSaved: () => void;
};

/**
 * Expected delivery date and the automated correspondence around it: the
 * customer is acknowledged once, the distributor is chased every 10 days until
 * an ETD exists, and the customer is updated whenever that date changes.
 */
export function DeliveryTrackingCard({ order, isAdmin, onSaved }: Props) {
  const [etd, setEtd] = useState(dateOnly(order.expected_delivery_date));
  const [notifyCustomer, setNotifyCustomer] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function saveEtd() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const row = await updateScmExpectedDeliveryDate(order.id, {
        expected_delivery_date: etd || null,
        notify_customer: notifyCustomer,
      });
      setNotice(
        row.customer_notified
          ? "Delivery date saved and shared with the customer."
          : "Delivery date saved.",
      );
      onSaved();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to save delivery date");
    } finally {
      setBusy(false);
    }
  }

  async function runNow() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const counts = await runScmDeliveryNotifications();
      setNotice(
        `Sent ${counts.acknowledged} order acknowledgement(s), ${counts.etd_chased} ETD ` +
        `reminder(s), ${counts.delivery_dates_shared} delivery update(s).`,
      );
      onSaved();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to run notifications");
    } finally {
      setBusy(false);
    }
  }

  const awaitingEtd = !order.expected_delivery_date;

  return (
    <section className="rounded-xl border border-border/70 bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
            <CalendarClock className="size-4" aria-hidden />
          </span>
          <div>
            <h2 className="text-base font-extrabold tracking-tight">Delivery Tracking</h2>
            <p className="text-xs text-muted-foreground">
              Order acknowledgement, distributor ETD chase, and customer updates run
              automatically.
            </p>
          </div>
        </div>
        {awaitingEtd ? (
          <Badge className="rounded-full border-transparent bg-amber-100 px-2.5 py-0.5 text-[11px] font-semibold text-amber-900 dark:bg-amber-900/50 dark:text-amber-100">
            Awaiting ETD from distributor
          </Badge>
        ) : (
          <Badge className="rounded-full border-transparent bg-emerald-100 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200">
            ETD confirmed
          </Badge>
        )}
      </div>

      {error ? (
        <p className="mt-3 flex items-center gap-1.5 text-xs font-medium text-red-600">
          <TriangleAlert className="size-3.5" /> {error}
        </p>
      ) : null}
      {notice ? (
        <p className="mt-3 flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
          <MailCheck className="size-3.5" /> {notice}
        </p>
      ) : null}

      <dl className="mt-4 grid grid-cols-2 gap-3 text-xs lg:grid-cols-3">
        <div>
          <dt className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            Customer Acknowledged
          </dt>
          <dd className="mt-0.5 font-semibold">{dateOnly(order.customer_ack_sent_at) || "-"}</dd>
        </div>
        <div>
          <dt className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            Last ETD Reminder
          </dt>
          <dd className="mt-0.5 font-semibold">
            {dateOnly(order.etd_reminder_last_sent_at) || "-"}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            ETD Confirmed On
          </dt>
          <dd className="mt-0.5 font-semibold">{dateOnly(order.etd_confirmed_at) || "-"}</dd>
        </div>
      </dl>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="space-y-1.5">
          <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            Expected delivery date
          </span>
          <Input
            type="date"
            value={etd}
            onChange={(e) => setEtd(e.target.value)}
            className="h-9 w-44 cursor-pointer text-[13px]"
          />
        </label>
        <label className="flex cursor-pointer items-center gap-2 pb-2 text-xs">
          <input
            type="checkbox"
            checked={notifyCustomer}
            onChange={(e) => setNotifyCustomer(e.target.checked)}
            className="size-3.5 cursor-pointer"
          />
          Email the customer this date
        </label>
        <Button
          type="button"
          size="sm"
          disabled={busy}
          className="mb-1 cursor-pointer transition-colors duration-200"
          onClick={() => void saveEtd()}
        >
          Save delivery date
        </Button>
        {isAdmin ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy}
            className="mb-1 cursor-pointer transition-colors duration-200"
            onClick={() => void runNow()}
          >
            <Send className="mr-1.5 size-3.5" />
            Run correspondence now
          </Button>
        ) : null}
      </div>
    </section>
  );
}
