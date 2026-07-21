import Link from "next/link";

import { hrPipelineStages } from "@/config/hr";
import { cn } from "@/lib/utils";

type StageCount = Record<string, number>;

interface HrPipelineFunnelProps {
  counts: StageCount;
  loading?: boolean;
}

export function HrPipelineFunnel({ counts, loading }: HrPipelineFunnelProps) {
  const values = hrPipelineStages.map((stage) => ({
    ...stage,
    count: counts[stage.resource] ?? 0,
  }));
  const max = Math.max(...values.map((v) => v.count), 1);

  return (
    <div className="rounded-xl border border-border/80 bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-medium tracking-tight">HRMS pipeline</h2>
        <p className="text-[11px] text-muted-foreground">Profiles → Training (FRD-09)</p>
      </div>
      <ol className="grid gap-2 sm:grid-cols-5">
        {values.map((stage, index) => {
          const prev = index > 0 ? values[index - 1].count : null;
          const conversion =
            prev != null && prev > 0 ? Math.round((stage.count / prev) * 100) : null;
          const width = Math.max(12, Math.round((stage.count / max) * 100));
          return (
            <li key={stage.key} className="min-w-0">
              <Link
                href={stage.href}
                className="group block cursor-pointer rounded-lg border border-border/60 bg-background/60 p-2.5 transition-[border-color,box-shadow] duration-200 hover:border-primary/25 hover:shadow-sm"
              >
                <p className="text-[10px] font-medium tracking-[0.12em] text-muted-foreground uppercase">
                  {String(index + 1).padStart(2, "0")} · {stage.title}
                </p>
                <p className="mt-1 font-mono text-lg font-medium tabular-nums text-foreground">
                  {loading ? "—" : stage.count}
                </p>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn(
                      "h-full rounded-full bg-sky-600 transition-[width] duration-300",
                      index === 1 && "bg-sky-700",
                      index === 2 && "bg-teal-600",
                      index === 3 && "bg-emerald-600",
                      index === 4 && "bg-slate-500",
                    )}
                    style={{ width: `${width}%` }}
                    role="presentation"
                  />
                </div>
                {conversion != null ? (
                  <p className="mt-1.5 text-[10px] text-muted-foreground">
                    {conversion}% of prior stage
                  </p>
                ) : (
                  <p className="mt-1.5 text-[10px] text-muted-foreground group-hover:text-foreground/70">
                    Open list
                  </p>
                )}
              </Link>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
