import { MARKETING_CONTENT_PIPELINE } from "@/config/marketing";
import { cn } from "@/lib/utils";

type StageCount = Record<string, number>;

interface MarketingPipelineFunnelProps {
  counts: StageCount;
  loading?: boolean;
  onStageClick?: (key: string) => void;
}

export function MarketingPipelineFunnel({ counts, loading, onStageClick }: MarketingPipelineFunnelProps) {
  const values = MARKETING_CONTENT_PIPELINE.map((stage) => ({
    ...stage,
    count: counts[stage.key] ?? 0,
  }));
  const max = Math.max(...values.map((v) => v.count), 1);

  return (
    <div className="rounded-xl border border-border/80 bg-card p-4 shadow-sm">
      <div className="mb-3">
        <h2 className="text-sm font-medium tracking-tight">Content pipeline</h2>
      </div>
      <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
        {values.map((stage, index) => {
          const width = Math.max(12, Math.round((stage.count / max) * 100));
          const Tag = onStageClick ? "button" : "div";
          return (
            <li key={stage.key} className="min-w-0">
              <Tag
                type={onStageClick ? "button" : undefined}
                onClick={onStageClick ? () => onStageClick(stage.key) : undefined}
                className={cn(
                  "block w-full rounded-lg border border-border/60 bg-background/60 p-2.5 text-left transition-[border-color,box-shadow] duration-200",
                  onStageClick && "cursor-pointer hover:border-primary/25 hover:shadow-sm",
                )}
              >
                <p className="text-[10px] font-medium tracking-[0.12em] text-muted-foreground uppercase">
                  {String(index + 1).padStart(2, "0")} · {stage.label}
                </p>
                <p className="mt-1 font-mono text-lg font-medium tabular-nums text-foreground">
                  {loading ? "—" : stage.count}
                </p>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-violet-600 transition-[width] duration-300"
                    style={{ width: `${width}%` }}
                    role="presentation"
                  />
                </div>
              </Tag>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
