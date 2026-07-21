"use client";

import { useMemo } from "react";

import { FinanceStatusBadge } from "@/components/finance/finance-status-badge";
import { cn } from "@/lib/utils";
import { isPeriodCurrent, quarterLabel } from "@/lib/finance/period-utils";
import type { AccountingPeriod } from "@/services/fiscal-service";

type Props = {
  periods: AccountingPeriod[];
  loading?: boolean;
  onPeriodAction?: (periodId: string, action: string) => void;
};

const STATUS_STYLE: Record<string, string> = {
  open: "border-emerald-300 bg-emerald-50 text-emerald-950",
  soft_closed: "border-amber-300 bg-amber-50 text-amber-950",
  hard_closed: "border-slate-400 bg-slate-100 text-slate-900",
};

export function PeriodCalendarView({ periods, loading, onPeriodAction }: Props) {
  const byQuarter = useMemo(() => {
    const map = new Map<number, AccountingPeriod[]>();
    for (const p of periods) {
      const q = p.quarter ?? Math.ceil(p.period_number / 3);
      if (!map.has(q)) map.set(q, []);
      map.get(q)!.push(p);
    }
    for (const [, list] of map) list.sort((a, b) => a.period_number - b.period_number);
    return Array.from(map.entries()).sort(([a], [b]) => a - b);
  }, [periods]);

  if (loading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl bg-muted/70" />
        ))}
      </div>
    );
  }

  if (periods.length === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">Select a fiscal year to view the period calendar.</p>;
  }

  return (
    <div className="space-y-4">
      {byQuarter.map(([quarter, list]) => (
        <div key={quarter}>
          <h4 className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">{quarterLabel(quarter)}</h4>
          <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {list.map((p) => {
              const current = isPeriodCurrent(p);
              const locked = p.gl_closed || p.status === "hard_closed";
              return (
                <div
                  key={p.id}
                  title={`${p.start_date} → ${p.end_date} · Journals: ${p.journal_count ?? 0}`}
                  className={cn(
                    "group rounded-xl border p-3 shadow-sm transition-shadow duration-200 hover:shadow-md",
                    STATUS_STYLE[p.status] ?? "border-border/80 bg-card",
                    current && "ring-2 ring-primary/40",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">{p.period_name}</p>
                      <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">{p.start_date} – {p.end_date}</p>
                    </div>
                    {current ? <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">Current</span> : null}
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <FinanceStatusBadge status={p.status} />
                    {locked ? <span className="text-[10px] font-medium text-muted-foreground">Locked</span> : null}
                  </div>
                  {onPeriodAction ? (
                    <div className="mt-2 flex flex-wrap gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      {p.status === "open" ? (
                        <>
                          <button type="button" className="cursor-pointer rounded px-1.5 py-0.5 text-[10px] hover:bg-background/80" onClick={() => onPeriodAction(p.id, "close")}>Close</button>
                          <button type="button" className="cursor-pointer rounded px-1.5 py-0.5 text-[10px] hover:bg-background/80" onClick={() => onPeriodAction(p.id, "lock")}>Lock</button>
                        </>
                      ) : (
                        <button type="button" className="cursor-pointer rounded px-1.5 py-0.5 text-[10px] hover:bg-background/80" onClick={() => onPeriodAction(p.id, "reopen")}>Reopen</button>
                      )}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
