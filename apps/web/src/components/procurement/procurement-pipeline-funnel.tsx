import Link from "next/link";

import { procurementPipelineStages } from "@/config/procurement";
import { cn } from "@/lib/utils";

type StageCount = Record<string, number>;

interface ProcurementPipelineFunnelProps {
  counts: StageCount;
  loading?: boolean;
}

const BAR_COLORS = [
  "bg-sky-600",
  "bg-teal-600",
  "bg-emerald-600",
  "bg-amber-600",
  "bg-slate-600",
] as const;

export function ProcurementPipelineFunnel({ counts, loading }: ProcurementPipelineFunnelProps) {
  const values = procurementPipelineStages.map((stage) => ({
    ...stage,
    count: counts[stage.resource] ?? 0,
  }));

  const max = Math.max(...values.map((v) => v.count), 1);

  return (
    <div className="h-full rounded-2xl border border-border/70 bg-card p-4 shadow-sm sm:p-5">
      <div className="mb-4">
        <h2 className="text-base font-semibold tracking-tight text-foreground">
          Analytics
        </h2>
        <p className="mt-0.5 text-xs font-normal text-muted-foreground">
          Pipeline volume by stage
        </p>
      </div>
      <ol className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-5">
        {values.map((stage, index) => {
          const width =
            stage.count > 0 ? Math.round((stage.count / max) * 100) : 0;
          return (
            <li key={stage.key} className="min-w-0">
              <Link
                href={stage.href}
                className="group block cursor-pointer rounded-xl border border-border/50 bg-muted/30 p-3 transition-[border-color,box-shadow,background-color] duration-200 hover:border-primary/20 hover:bg-card hover:shadow-sm"
              >
                <p className="text-[10px] font-semibold tracking-[0.1em] text-muted-foreground uppercase">
                  {stage.title}
                </p>
                <p className="mt-1.5 font-mono text-xl font-semibold tabular-nums text-foreground">
                  {loading ? "—" : stage.count}
                </p>
                {!loading ? (
                  <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-muted">
                    {stage.count > 0 ? (
                      <div
                        className={cn(
                          "h-full rounded-full transition-[width] duration-300",
                          BAR_COLORS[index % BAR_COLORS.length],
                        )}
                        style={{ width: `${width}%` }}
                        role="presentation"
                      />
                    ) : null}
                  </div>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
