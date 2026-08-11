import Link from "next/link";

import { procurementPipelineStages } from "@/config/procurement";
import { cn } from "@/lib/utils";

type StageCount = Record<string, number>;

interface ProcurementPipelineFunnelProps {
  counts: StageCount;
  loading?: boolean;
}

export function ProcurementPipelineFunnel({ counts, loading }: ProcurementPipelineFunnelProps) {
  const values = procurementPipelineStages.map((stage) => ({
    ...stage,
    count: counts[stage.resource] ?? 0,
  }));

  const max = Math.max(...values.map((v) => v.count), 1);

  return (
    <div className="rounded-xl border border-border/80 bg-card p-4 shadow-sm">
      <div className="mb-3">
        <h2 className="text-sm font-medium tracking-tight">Analytics</h2>
      </div>
      <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {values.map((stage, index) => {
          const width =
            stage.count > 0 ? Math.round((stage.count / max) * 100) : 0;
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
                {!loading ? (
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                    {stage.count > 0 ? (
                      <div
                        className={cn(
                          "h-full rounded-full bg-sky-600 transition-[width] duration-300",
                          index === 1 && "bg-teal-600",
                          index === 2 && "bg-emerald-600",
                          index === 3 && "bg-violet-600",
                          index === 4 && "bg-slate-600",
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
