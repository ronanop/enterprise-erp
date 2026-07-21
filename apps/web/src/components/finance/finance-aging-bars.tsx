import { AGING_BUCKETS } from "@/config/finance";
import type { AgingSummary } from "@/services/finance-service";
import { formatInr } from "@/services/finance-service";

const barColors: Record<(typeof AGING_BUCKETS)[number], string> = {
  "0-30": "bg-sky-600",
  "31-60": "bg-amber-500",
  "61-90": "bg-orange-500",
  "90+": "bg-red-600",
};

interface FinanceAgingBarsProps {
  title: string;
  summary: AgingSummary;
}

export function FinanceAgingBars({ title, summary }: FinanceAgingBarsProps) {
  const total = AGING_BUCKETS.reduce((sum, key) => sum + summary[key].amount, 0);
  const max = Math.max(...AGING_BUCKETS.map((key) => summary[key].amount), 1);

  return (
    <div className="rounded-xl border border-border/80 bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-medium tracking-tight">{title}</h3>
        <p className="font-mono text-xs text-muted-foreground tabular-nums">{formatInr(total)}</p>
      </div>
      <ul className="space-y-2.5">
        {AGING_BUCKETS.map((bucket) => {
          const item = summary[bucket];
          const width = Math.max(4, Math.round((item.amount / max) * 100));
          return (
            <li key={bucket}>
              <div className="mb-1 flex items-center justify-between gap-2 text-[11px]">
                <span className="font-medium text-foreground">{bucket} days</span>
                <span className="text-muted-foreground">
                  {item.count} · <span className="font-mono tabular-nums">{formatInr(item.amount)}</span>
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full rounded-full transition-[width] duration-300 ${barColors[bucket]}`}
                  style={{ width: `${width}%` }}
                  role="presentation"
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
