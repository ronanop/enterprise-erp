"use client";

import { AlertTriangle, TrendingUp } from "lucide-react";

import { RiskBandBadge } from "@/components/master-data/risk-band-badge";
import {
  formatAmountShort,
  formatPercent,
} from "@/lib/master-data/party-registration-format";
import type { CreditEvaluation } from "@/services/party-registration-service";

function Metric({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div className="min-w-0 space-y-1">
      <span className="block text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </span>
      <span
        className={
          emphasis
            ? "block font-mono text-sm font-semibold text-foreground"
            : "block font-mono text-sm text-foreground"
        }
      >
        {value}
      </span>
    </div>
  );
}

export function CreditEvaluationCard({
  evaluation,
  riskBand,
}: {
  evaluation: CreditEvaluation | null | undefined;
  riskBand: string | null | undefined;
}) {
  if (!evaluation) {
    return (
      <section className="rounded-xl border border-dashed border-border/80 bg-muted/20 px-5 py-8 text-center">
        <p className="text-sm font-medium text-foreground">No credit assessment yet</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Run the assessment to see what the declared turnover actually supports.
        </p>
      </section>
    );
  }

  const isCustomer = evaluation.kind === "customer_credit";
  const blocked = riskBand === "unacceptable";

  return (
    <section className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 px-5 py-3.5">
        <div className="flex items-center gap-2">
          <TrendingUp className="size-4 text-muted-foreground" aria-hidden />
          <h2 className="text-base font-semibold tracking-tight">
            {isCustomer ? "Credit assessment" : "Payment terms assessment"}
          </h2>
        </div>
        {isCustomer ? <RiskBandBadge band={riskBand} /> : null}
      </header>

      <div className="grid grid-cols-2 gap-5 px-5 py-4 sm:grid-cols-3 lg:grid-cols-4">
        {isCustomer ? (
          <>
            <Metric
              label="Declared turnover"
              value={formatAmountShort(evaluation.declared_annual_turnover)}
            />
            <Metric
              label="Requested limit"
              value={formatAmountShort(evaluation.requested_credit_limit)}
            />
            <Metric
              label="Turnover supports"
              value={formatAmountShort(evaluation.turnover_based_ceiling)}
            />
            <Metric
              label="Exposure vs turnover"
              value={formatPercent(evaluation.exposure_ratio_pct)}
            />
            <Metric
              label="Recommended limit"
              value={formatAmountShort(evaluation.recommended_credit_limit)}
              emphasis
            />
            <Metric
              label="Recommended days"
              value={`${evaluation.recommended_credit_days ?? 0}`}
              emphasis
            />
            <Metric
              label="Funding gap"
              value={`${evaluation.funding_gap_days ?? 0} days`}
            />
            <Metric
              label="Cost of that gap"
              value={formatAmountShort(evaluation.funding_carry_cost)}
            />
          </>
        ) : (
          <>
            <Metric
              label="Vendor gives us"
              value={`${evaluation.offered_credit_days ?? 0} days`}
            />
            <Metric
              label="We collect in"
              value={`${evaluation.customer_credit_days ?? 0} days`}
            />
            <Metric
              label="Monthly spend"
              value={formatAmountShort(evaluation.expected_monthly_spend)}
            />
            <Metric
              label="Float"
              value={`${evaluation.leverage_days ?? 0} days`}
              emphasis
            />
            <Metric
              label="Float is worth"
              value={formatAmountShort(evaluation.leverage_value)}
              emphasis
            />
            <Metric
              label="Early-pay discount"
              value={formatPercent(evaluation.early_payment_discount_pct)}
            />
            <Metric
              label="Discount is worth"
              value={formatAmountShort(evaluation.early_payment_discount_value)}
            />
            <Metric
              label="Recommendation"
              value={(evaluation.recommended_action ?? "—").replaceAll("_", " ")}
              emphasis
            />
          </>
        )}
      </div>

      {evaluation.reasons.length > 0 ? (
        <div
          className={
            blocked
              ? "border-t border-destructive/20 bg-destructive/5 px-5 py-4"
              : "border-t border-border/70 bg-muted/20 px-5 py-4"
          }
        >
          <div className="flex items-start gap-2">
            {blocked ? (
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
            ) : null}
            <ul className="min-w-0 space-y-1.5">
              {evaluation.reasons.map((reason) => (
                <li
                  key={reason}
                  className={
                    blocked
                      ? "text-sm leading-relaxed text-destructive"
                      : "text-sm leading-relaxed text-muted-foreground"
                  }
                >
                  {reason}
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </section>
  );
}
