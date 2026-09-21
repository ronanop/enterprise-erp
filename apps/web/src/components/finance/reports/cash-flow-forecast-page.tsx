"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowDownCircle,
  ArrowUpCircle,
  PackageX,
  RefreshCw,
  Wallet,
} from "lucide-react";

import { FinanceKpiCard } from "@/components/finance/finance-kpi-card";
import { FinanceSelect } from "@/components/finance/journals/finance-form-field";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ApiClientError } from "@/services/api-client";
import { formatInr } from "@/services/finance-service";
import { getCashFlowForecast, type CashFlowForecast } from "@/services/report-service";

const HORIZON_OPTIONS = [4, 8, 13, 26, 52];

function formatWeekLabel(week: { week_start: string; week_end: string }): string {
  const start = new Date(week.week_start);
  const end = new Date(week.week_end);
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
  return `${fmt(start)} – ${fmt(end)}`;
}

export function CashFlowForecastPage() {
  const [data, setData] = useState<CashFlowForecast | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [horizon, setHorizon] = useState(13);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await getCashFlowForecast({ horizon_weeks: horizon }));
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Unable to load forecast");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [horizon]);

  useEffect(() => {
    void load();
  }, [load]);

  const stock = data?.stuck_stock;
  const peakOutflow = data
    ? Math.max(1, ...data.weeks.map((w) => Math.max(w.inflow, w.outflow)))
    : 1;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cash Flow Forecast"
        description="Where cash actually lands, week by week, from open receivables, payables and committed purchase orders."
        backHref="/finance/reports"
        backLabel="Reports"
        actions={
          <div className="flex items-center gap-2">
            <FinanceSelect
              value={String(horizon)}
              onChange={(e) => setHorizon(Number(e.target.value))}
              className="h-8 w-auto"
              aria-label="Forecast horizon"
            >
              {HORIZON_OPTIONS.map((weeks) => (
                <option key={weeks} value={weeks}>
                  {weeks} weeks
                </option>
              ))}
            </FinanceSelect>
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

      {loading && !data ? (
        <p className="px-1 py-12 text-center text-sm text-muted-foreground">
          Building forecast…
        </p>
      ) : null}

      {data ? (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <FinanceKpiCard
              label="Cash today"
              value={formatInr(data.opening_balance)}
              icon={Wallet}
            />
            <FinanceKpiCard
              label={`Expected in (${data.horizon_weeks}w)`}
              value={formatInr(data.total_inflow)}
              hint={
                data.overdue_inflow > 0
                  ? `${formatInr(data.overdue_inflow)} already overdue`
                  : undefined
              }
              icon={ArrowUpCircle}
              tone="success"
            />
            <FinanceKpiCard
              label={`Expected out (${data.horizon_weeks}w)`}
              value={formatInr(data.total_outflow)}
              hint={
                data.overdue_outflow > 0
                  ? `${formatInr(data.overdue_outflow)} already overdue`
                  : undefined
              }
              icon={ArrowDownCircle}
              tone="warning"
            />
            <FinanceKpiCard
              label="Lowest point"
              value={formatInr(data.lowest_balance)}
              hint={
                data.lowest_balance_week
                  ? `Week ${data.lowest_balance_week}`
                  : "No dip in this window"
              }
              icon={AlertTriangle}
              tone={data.lowest_balance < 0 ? "danger" : "default"}
            />
          </div>

          {data.shortfall_weeks.length > 0 ? (
            <p className="flex items-start gap-2 rounded-lg border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>
                Cash goes negative in{" "}
                {data.shortfall_weeks.length === 1 ? "week" : "weeks"}{" "}
                {data.shortfall_weeks.join(", ")}. Either collections have to be pulled
                forward or payments pushed out.
              </span>
            </p>
          ) : null}

          {data.leverage ? (
            <section className="rounded-xl border border-border/80 bg-card px-5 py-4 shadow-sm">
              <h2 className="text-base font-semibold tracking-tight">
                Working capital position
              </h2>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                {data.leverage.narrative}
              </p>
            </section>
          ) : null}

          <section className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm">
            <header className="border-b border-border/70 px-5 py-3.5">
              <h2 className="text-base font-semibold tracking-tight">Weekly position</h2>
            </header>
            <div className="erp-scroll overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border/70 bg-muted/40 text-[11px] tracking-wide text-muted-foreground uppercase">
                    <th className="px-5 py-3 font-medium">Week</th>
                    <th className="px-5 py-3 font-medium">Dates</th>
                    <th className="px-5 py-3 font-medium text-right">In</th>
                    <th className="px-5 py-3 font-medium text-right">Out</th>
                    <th className="px-5 py-3 font-medium text-right">Net</th>
                    <th className="px-5 py-3 font-medium text-right">Closing</th>
                    <th className="w-40 px-5 py-3 font-medium">Flow</th>
                  </tr>
                </thead>
                <tbody>
                  {data.weeks.map((week) => (
                    <tr
                      key={week.week_number}
                      className={cn(
                        "border-b border-border/50 transition-colors duration-150 hover:bg-muted/30",
                        week.closing_balance < 0 && "bg-destructive/5",
                      )}
                    >
                      <td className="px-5 py-2.5 font-mono text-xs">{week.week_number}</td>
                      <td className="px-5 py-2.5 text-xs text-muted-foreground">
                        {formatWeekLabel(week)}
                      </td>
                      <td className="px-5 py-2.5 text-right font-mono text-xs tabular-nums text-emerald-700">
                        {week.inflow ? formatInr(week.inflow) : "—"}
                      </td>
                      <td className="px-5 py-2.5 text-right font-mono text-xs tabular-nums text-amber-700">
                        {week.outflow ? formatInr(week.outflow) : "—"}
                      </td>
                      <td className="px-5 py-2.5 text-right font-mono text-xs tabular-nums">
                        {week.net ? formatInr(week.net) : "—"}
                      </td>
                      <td
                        className={cn(
                          "px-5 py-2.5 text-right font-mono text-xs font-semibold tabular-nums",
                          week.closing_balance < 0 && "text-destructive",
                        )}
                      >
                        {formatInr(week.closing_balance)}
                      </td>
                      <td className="px-5 py-2.5">
                        <div
                          className="flex h-2 w-full items-center gap-0.5"
                          role="img"
                          aria-label={`In ${week.inflow}, out ${week.outflow}`}
                        >
                          <span
                            className="h-full rounded-sm bg-emerald-500/70 transition-all duration-200"
                            style={{ width: `${(week.inflow / peakOutflow) * 50}%` }}
                          />
                          <span
                            className="h-full rounded-sm bg-amber-500/70 transition-all duration-200"
                            style={{ width: `${(week.outflow / peakOutflow) * 50}%` }}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {stock ? (
            <section className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm">
              <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 px-5 py-3.5">
                <div className="flex items-center gap-2">
                  <PackageX className="size-4 text-muted-foreground" aria-hidden />
                  <h2 className="text-base font-semibold tracking-tight">
                    Stock bought but not delivered
                  </h2>
                </div>
                <span className="text-sm text-muted-foreground">
                  {stock.unit_count} lot{stock.unit_count === 1 ? "" : "s"} ·{" "}
                  {formatInr(stock.total_value)} tied up
                </span>
              </header>

              {stock.unit_count === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-muted-foreground">
                  Nothing is sitting in the warehouse waiting on a customer.
                </p>
              ) : (
                <>
                  <p className="border-b border-border/70 bg-muted/20 px-5 py-3 text-sm leading-relaxed text-muted-foreground">
                    {formatInr(stock.total_value)} is parked in goods that have been paid
                    for but not delivered. At 1% a month that costs about{" "}
                    <span className="font-medium text-foreground">
                      {formatInr(stock.monthly_carry_cost)}
                    </span>{" "}
                    every month, and {formatInr(stock.carry_cost_to_date)} has already gone.
                    The oldest lot has been held {stock.oldest_days_held} days.
                  </p>
                  <div className="erp-scroll overflow-x-auto">
                    <table className="w-full min-w-[620px] text-left text-sm">
                      <thead>
                        <tr className="border-b border-border/70 bg-muted/40 text-[11px] tracking-wide text-muted-foreground uppercase">
                          <th className="px-5 py-3 font-medium">PO</th>
                          <th className="px-5 py-3 font-medium">Product</th>
                          <th className="px-5 py-3 font-medium text-right">Qty</th>
                          <th className="px-5 py-3 font-medium text-right">Value</th>
                          <th className="px-5 py-3 font-medium text-right">Days held</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stock.items.slice(0, 25).map((item, index) => (
                          <tr
                            key={`${item.reference}-${item.product_name}-${index}`}
                            className="border-b border-border/50 transition-colors duration-150 hover:bg-muted/30"
                          >
                            <td className="px-5 py-2.5 font-mono text-xs">{item.reference}</td>
                            <td className="px-5 py-2.5">{item.product_name}</td>
                            <td className="px-5 py-2.5 text-right font-mono text-xs tabular-nums">
                              {item.quantity}
                            </td>
                            <td className="px-5 py-2.5 text-right font-mono text-xs tabular-nums">
                              {formatInr(item.value)}
                            </td>
                            <td
                              className={cn(
                                "px-5 py-2.5 text-right font-mono text-xs tabular-nums",
                                item.days_held > 90 && "font-semibold text-destructive",
                              )}
                            >
                              {item.days_held}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
