"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Banknote, Landmark, PiggyBank, RefreshCw, ShieldCheck } from "lucide-react";

import { FinanceKpiCard } from "@/components/finance/finance-kpi-card";
import { FinanceField } from "@/components/finance/journals/finance-form-field";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ApiClientError } from "@/services/api-client";
import { formatInr } from "@/services/finance-service";
import { getTreasurySuggestions, type TreasuryPlan } from "@/services/report-service";

const LIQUIDITY_LABELS: Record<string, string> = {
  same_day: "Same day",
  next_day: "Next day",
  on_maturity: "On maturity",
  committed: "Committed",
};

export function TreasurySuggestionsPage() {
  const [plan, setPlan] = useState<TreasuryPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [buffer, setBuffer] = useState("1000000");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setPlan(
        await getTreasurySuggestions({
          operating_buffer: Number(buffer) || 0,
        }),
      );
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Unable to load suggestions");
      setPlan(null);
    } finally {
      setLoading(false);
    }
  }, [buffer]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Surplus Cash Suggestions"
        description="What to do with cash the forecast shows is genuinely spare, ranked by return. Worked out inside the system - nothing is sent out."
        backHref="/finance/reports"
        backLabel="Reports"
        actions={
          <div className="flex items-end gap-2">
            <FinanceField label="Operating buffer">
              <Input
                value={buffer}
                inputMode="decimal"
                onChange={(e) => setBuffer(e.target.value)}
                className="h-8 w-36 font-mono"
              />
            </FinanceField>
            <Button
              variant="outline"
              size="sm"
              className="cursor-pointer shadow-none transition-colors duration-200"
              onClick={() => void load()}
              disabled={loading}
            >
              <RefreshCw className={cn("size-3.5", loading && "animate-spin")} aria-hidden />
              Refresh
            </Button>
          </div>
        }
      />

      {error ? (
        <p className="rounded-lg border border-destructive/25 bg-destructive/5 px-4 py-2.5 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {loading && !plan ? (
        <p className="px-1 py-12 text-center text-sm text-muted-foreground">
          Working out the position…
        </p>
      ) : null}

      {plan ? (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <FinanceKpiCard
              label="Spare to deploy"
              value={formatInr(plan.deployable_amount)}
              hint={`Free for ${plan.deployable_days} days`}
              icon={PiggyBank}
              tone={plan.deployable_amount > 0 ? "success" : "default"}
            />
            <FinanceKpiCard
              label="Buffer held back"
              value={formatInr(plan.operating_buffer)}
              hint="Never deployed"
              icon={ShieldCheck}
            />
            <FinanceKpiCard
              label="Lowest forecast balance"
              value={formatInr(plan.lowest_forecast_balance)}
              icon={Landmark}
              tone={plan.lowest_forecast_balance < 0 ? "danger" : "default"}
            />
            <FinanceKpiCard
              label="Best option earns"
              value={formatInr(plan.total_opportunity)}
              hint={plan.suggestions[0]?.title}
              icon={Banknote}
              tone="success"
            />
          </div>

          {plan.warnings.map((warning) => (
            <p
              key={warning}
              className="flex items-start gap-2 rounded-lg border border-amber-200/80 bg-amber-50/90 px-4 py-3 text-sm text-amber-900"
            >
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>{warning}</span>
            </p>
          ))}

          {plan.suggestions.length > 0 ? (
            <section className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm">
              <header className="border-b border-border/70 px-5 py-3.5">
                <h2 className="text-base font-semibold tracking-tight">
                  Options, best return first
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  These are not mutually exclusive. Taking a discount on one bill still
                  leaves the rest of the surplus to park.
                </p>
              </header>
              <ul className="divide-y divide-border/50">
                {plan.suggestions.map((s) => (
                  <li
                    key={s.rank}
                    className="flex flex-wrap items-start gap-3 px-5 py-3.5 transition-colors duration-150 hover:bg-muted/20"
                  >
                    <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-muted font-mono text-xs font-medium">
                      {s.rank}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium">{s.title}</p>
                        <Badge variant="secondary">
                          {LIQUIDITY_LABELS[s.liquidity] ?? s.liquidity}
                        </Badge>
                      </div>
                      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                        {s.rationale}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-mono text-sm font-semibold tabular-nums text-emerald-700">
                        {formatInr(s.expected_return)}
                      </p>
                      <p className="font-mono text-[11px] text-muted-foreground tabular-nums">
                        {s.annual_rate_pct}% · {s.days}d
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
              <p className="border-t border-border/70 bg-muted/20 px-5 py-3 text-xs leading-relaxed text-muted-foreground">
                Rates shown are indicative. Confirm the actual quote with your bank before
                committing, and treat this as a shortlist rather than advice.
              </p>
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
