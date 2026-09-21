"use client";

import { useState } from "react";
import { Check, Circle, PackageSearch, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { env } from "@/utils/env";

type Milestone = {
  stage: string;
  label: string;
  done: boolean;
  on: string | null;
};

type OrderStatus = {
  order_number: string | null;
  customer_name: string | null;
  order_date: string | null;
  current_stage: string;
  current_stage_label: string;
  expected_delivery_date: string | null;
  milestones: Milestone[];
};

function dateOrDash(value: string | null): string {
  return value ? value.slice(0, 10) : "-";
}

/**
 * Public order tracking. A customer enters the PO number they raised plus the
 * email registered against their account; we return milestones only, never
 * prices, vendors, or internal document numbers.
 */
export function OrderTrackingPortal() {
  const [orderNumber, setOrderNumber] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<OrderStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function lookup() {
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      const res = await fetch(`${env.apiUrl}/public/order-tracking`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_number: orderNumber.trim(), email: email.trim() }),
      });
      if (!res.ok) {
        setError("We could not find an order for that PO number and email.");
        return;
      }
      const payload = (await res.json()) as { data: OrderStatus };
      setStatus(payload.data);
    } catch {
      setError("Something went wrong. Please try again in a moment.");
    } finally {
      setBusy(false);
    }
  }

  const canSubmit = orderNumber.trim().length > 0 && email.trim().length > 0 && !busy;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-6 px-6 py-16">
      <header className="space-y-2">
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-lg bg-slate-900 text-white">
            <PackageSearch className="size-4.5" aria-hidden />
          </span>
          <h1 className="text-xl font-extrabold tracking-tight">Track your order</h1>
        </div>
        <p className="text-sm text-slate-600">
          Enter the purchase order number you raised with us and the email registered on your
          account.
        </p>
      </header>

      <form
        className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]"
        onSubmit={(e) => {
          e.preventDefault();
          if (canSubmit) void lookup();
        }}
      >
        <label className="space-y-1.5">
          <span className="text-[11px] font-medium tracking-wide text-slate-500 uppercase">
            Your PO number
          </span>
          <Input
            value={orderNumber}
            onChange={(e) => setOrderNumber(e.target.value)}
            placeholder="e.g. 4500012345"
            className="h-10 text-sm"
          />
        </label>
        <label className="space-y-1.5">
          <span className="text-[11px] font-medium tracking-wide text-slate-500 uppercase">
            Registered email
          </span>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            className="h-10 text-sm"
          />
        </label>
        <Button
          type="submit"
          disabled={!canSubmit}
          className="h-10 cursor-pointer self-end transition-colors duration-200"
        >
          {busy ? "Checking…" : "Check status"}
        </Button>
      </form>

      {error ? (
        <p className="flex items-center gap-1.5 text-sm font-medium text-red-600">
          <TriangleAlert className="size-4" /> {error}
        </p>
      ) : null}

      {status ? (
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-base font-bold tracking-tight">
              PO {status.order_number ?? "-"}
            </h2>
            <span className="text-sm font-semibold text-slate-700">
              {status.current_stage_label}
            </span>
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-xs sm:grid-cols-3">
            <div>
              <dt className="text-[11px] font-medium tracking-wide text-slate-500 uppercase">
                Account
              </dt>
              <dd className="mt-0.5 font-semibold">{status.customer_name ?? "-"}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-medium tracking-wide text-slate-500 uppercase">
                Order date
              </dt>
              <dd className="mt-0.5 font-semibold">{dateOrDash(status.order_date)}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-medium tracking-wide text-slate-500 uppercase">
                Expected delivery
              </dt>
              <dd className="mt-0.5 font-semibold">
                {dateOrDash(status.expected_delivery_date)}
              </dd>
            </div>
          </dl>

          <ol className="mt-6 space-y-3">
            {status.milestones.map((milestone) => (
              <li key={milestone.stage} className="flex items-start gap-3">
                <span
                  className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full ${
                    milestone.done ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-400"
                  }`}
                >
                  {milestone.done ? (
                    <Check className="size-3" aria-hidden />
                  ) : (
                    <Circle className="size-2" aria-hidden />
                  )}
                </span>
                <div className="min-w-0">
                  <p
                    className={`text-sm ${milestone.done ? "font-semibold text-slate-900" : "text-slate-500"}`}
                  >
                    {milestone.label}
                  </p>
                  {milestone.on ? (
                    <p className="text-xs text-slate-500">{milestone.on.slice(0, 10)}</p>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </main>
  );
}
