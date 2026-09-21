"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Handshake, TriangleAlert, X } from "lucide-react";

import { FinanceTextarea } from "@/components/finance/journals/finance-form-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ApiClientError } from "@/services/api-client";
import {
  decideScmNegotiation,
  getScmNegotiation,
  submitScmNegotiation,
  type ScmNegotiation,
} from "@/services/procurement-service";

const STATUS_LABEL: Record<ScmNegotiation["negotiation_status"], string> = {
  not_required: "Not sent for approval",
  pending: "Awaiting Management approval",
  approved: "Approved - PO can be issued",
  rejected: "Sent back by Management",
};

const STATUS_CLASS: Record<ScmNegotiation["negotiation_status"], string> = {
  not_required: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
  pending: "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200",
  approved: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200",
  rejected: "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200",
};

function inr(value: number): string {
  return `₹${value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

type Props = {
  orderId: string;
  /** Only CRM OVF and inventory-initiated draft POs go through this gate. */
  enabled: boolean;
  isAdmin: boolean;
  onDecided?: () => void;
};

/**
 * Management sign-off on the post-negotiation vendor price. Nothing reaches the
 * distributor before this is approved, and the saving is credited to supply
 * chain rather than to the sales incentive.
 */
export function NegotiationApprovalCard({ orderId, enabled, isAdmin, onDecided }: Props) {
  const [row, setRow] = useState<ScmNegotiation | null>(null);
  const [remark, setRemark] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setRow(await getScmNegotiation(orderId));
    } catch {
      setRow(null);
    }
  }, [orderId]);

  useEffect(() => {
    if (!enabled) return;
    void load();
  }, [enabled, load]);

  if (!enabled || !row) return null;

  async function run(work: () => Promise<ScmNegotiation>) {
    setBusy(true);
    setError(null);
    try {
      setRow(await work());
      setRemark("");
      onDecided?.();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  const status = row.negotiation_status;
  const isDraft = (row.status || "").toLowerCase() === "draft";

  return (
    <section className="rounded-xl border border-border/70 bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
            <Handshake className="size-4" aria-hidden />
          </span>
          <h2 className="text-base font-extrabold tracking-tight">Negotiation &amp; Approval</h2>
        </div>
        <Badge
          className={`rounded-full border-transparent px-2.5 py-0.5 text-[11px] font-semibold ${STATUS_CLASS[status]}`}
        >
          {STATUS_LABEL[status]}
        </Badge>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 text-xs lg:grid-cols-4">
        <div>
          <dt className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            OVF Price
          </dt>
          <dd className="mt-0.5 font-semibold tabular-nums">{inr(row.baseline_amount)}</dd>
        </div>
        <div>
          <dt className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            Negotiated Price
          </dt>
          <dd className="mt-0.5 font-semibold tabular-nums">{inr(row.negotiated_amount)}</dd>
        </div>
        <div>
          <dt className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            Supply Chain Saving
          </dt>
          <dd className="mt-0.5 font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
            {inr(row.savings_amount)}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            Saving %
          </dt>
          <dd className="mt-0.5 font-semibold tabular-nums">{row.savings_pct.toFixed(2)}%</dd>
        </div>
      </dl>

      {row.negotiation_remark ? (
        <p className="mt-3 text-xs text-muted-foreground">{row.negotiation_remark}</p>
      ) : null}
      {row.negotiation_decided_by_name ? (
        <p className="mt-1 text-xs text-muted-foreground">
          Decided by {row.negotiation_decided_by_name}
        </p>
      ) : null}

      {error ? (
        <p className="mt-3 flex items-center gap-1.5 text-xs font-medium text-red-600">
          <TriangleAlert className="size-3.5" /> {error}
        </p>
      ) : null}

      {isDraft && status !== "approved" ? (
        <div className="mt-4 space-y-3">
          <FinanceTextarea
            value={remark}
            onChange={(e) => setRemark(e.target.value)}
            placeholder={
              isAdmin && status === "pending"
                ? "Decision remark (optional)"
                : "What was negotiated, and with whom?"
            }
            className="min-h-[64px] text-[13px]"
          />
          <div className="flex flex-wrap gap-2">
            {isAdmin && status === "pending" ? (
              <>
                <Button
                  type="button"
                  size="sm"
                  disabled={busy}
                  className="cursor-pointer transition-colors duration-200"
                  onClick={() => void run(() => decideScmNegotiation(orderId, "approved", remark))}
                >
                  <Check className="mr-1.5 size-3.5" />
                  Approve negotiated price
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  className="cursor-pointer transition-colors duration-200"
                  onClick={() => void run(() => decideScmNegotiation(orderId, "rejected", remark))}
                >
                  <X className="mr-1.5 size-3.5" />
                  Send back
                </Button>
              </>
            ) : status !== "pending" ? (
              <Button
                type="button"
                size="sm"
                disabled={busy}
                className="cursor-pointer transition-colors duration-200"
                onClick={() => void run(() => submitScmNegotiation(orderId, remark))}
              >
                Send negotiated price for approval
              </Button>
            ) : (
              <p className="text-xs text-muted-foreground">
                Management has this price in their queue. The PO cannot be issued to the
                distributor until it is approved.
              </p>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}
