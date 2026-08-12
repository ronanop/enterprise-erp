import { MARKETING_CONTENT_PIPELINE } from "@/config/marketing";
import { marketingCard } from "@/lib/marketing-ui";
import { cn } from "@/lib/utils";
import { BarChart3 } from "lucide-react";

type StageCount = Record<string, number>;

interface MarketingPipelineFunnelProps {
  counts: StageCount;
  loading?: boolean;
  onStageClick?: (key: string) => void;
}

const STAGE_ACCENTS: Record<
  string,
  { ring: string; badge: string; bar: string; active: string }
> = {
  draft: {
    ring: "border-slate-500/25",
    badge: "bg-slate-500/10 text-slate-700 dark:text-slate-300",
    bar: "bg-slate-500/70",
    active: "border-slate-500/30 bg-slate-500/[0.04]",
  },
  in_review: {
    ring: "border-primary/30",
    badge: "bg-primary/10 text-primary",
    bar: "bg-primary",
    active: "border-primary/25 bg-primary/[0.04]",
  },
  changes_required: {
    ring: "border-amber-500/35",
    badge: "bg-amber-500/15 text-amber-800 dark:text-amber-200",
    bar: "bg-amber-500",
    active: "border-amber-500/30 bg-amber-500/[0.05]",
  },
  media_approved: {
    ring: "border-violet-500/30",
    badge: "bg-violet-500/10 text-violet-700 dark:text-violet-300",
    bar: "bg-violet-600",
    active: "border-violet-500/25 bg-violet-500/[0.04]",
  },
  approved: {
    ring: "border-emerald-500/30",
    badge: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    bar: "bg-emerald-600",
    active: "border-emerald-500/25 bg-emerald-500/[0.04]",
  },
  scheduled: {
    ring: "border-sky-500/30",
    badge: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
    bar: "bg-sky-600",
    active: "border-sky-500/25 bg-sky-500/[0.04]",
  },
  published: {
    ring: "border-emerald-500/35",
    badge: "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200",
    bar: "bg-emerald-500",
    active: "border-emerald-500/30 bg-emerald-500/[0.05]",
  },
  archived: {
    ring: "border-border",
    badge: "bg-muted text-muted-foreground",
    bar: "bg-muted-foreground/50",
    active: "border-border bg-muted/30",
  },
};

const defaultAccent = STAGE_ACCENTS.draft;

export function MarketingPipelineFunnel({ counts, loading, onStageClick }: MarketingPipelineFunnelProps) {
  const values = MARKETING_CONTENT_PIPELINE.map((stage, index) => ({
    ...stage,
    index,
    count: counts[stage.key] ?? 0,
  }));
  const max = Math.max(...values.map((v) => v.count), 1);

  return (
    <section className={cn(marketingCard, "shadow-md")}>
      <div className="flex items-center gap-3 border-b border-border/60 bg-gradient-to-r from-muted/35 to-transparent px-4 py-3.5 sm:px-5">
        <div className="flex size-8 items-center justify-center rounded-lg border border-border/60 bg-background shadow-sm">
          <BarChart3 className="size-4 text-primary/80" aria-hidden />
        </div>
        <div>
          <h2 className="text-sm font-semibold tracking-tight">Content pipeline</h2>
          <p className="text-[11px] text-muted-foreground">Live counts across every stage</p>
        </div>
      </div>
      <div className="erp-scroll overflow-x-auto px-4 py-4 sm:px-5">
        <ol className="flex min-w-max gap-3 pb-1 sm:min-w-0 sm:grid sm:grid-cols-2 sm:pb-0 lg:grid-cols-4 xl:grid-cols-8">
          {values.map((stage) => {
            const accent = STAGE_ACCENTS[stage.key] ?? defaultAccent;
            const width = Math.max(8, Math.round((stage.count / max) * 100));
            const hasItems = stage.count > 0;
            const Tag = onStageClick ? "button" : "div";

            return (
              <li key={stage.key} className="w-[148px] shrink-0 sm:w-auto sm:shrink">
                <Tag
                  type={onStageClick ? "button" : undefined}
                  onClick={onStageClick ? () => onStageClick(stage.key) : undefined}
                  className={cn(
                    "flex h-full min-h-[118px] w-full flex-col rounded-xl border p-3.5 text-left transition-all duration-300",
                    hasItems ? accent.active : "border-border/60 bg-background/60",
                    hasItems && accent.ring,
                    onStageClick &&
                      "cursor-pointer hover:-translate-y-1 hover:shadow-lg hover:ring-2 hover:ring-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span
                      className={cn(
                        "inline-flex size-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold tabular-nums",
                        accent.badge,
                      )}
                    >
                      {String(stage.index + 1).padStart(2, "0")}
                    </span>
                    {!loading && hasItems ? (
                      <span className="rounded-full bg-foreground/5 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                        Active
                      </span>
                    ) : null}
                  </div>

                  <p className="mt-3 text-sm font-bold leading-tight text-foreground">{stage.label}</p>

                  <p className="mt-2 font-mono text-2xl font-semibold tabular-nums tracking-tight text-foreground">
                    {loading ? "—" : stage.count}
                  </p>

                  <div className="mt-auto pt-3">
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted/80">
                      <div
                        className={cn("h-full rounded-full transition-[width] duration-500 ease-out", accent.bar)}
                        style={{ width: `${width}%` }}
                        role="presentation"
                      />
                    </div>
                  </div>
                </Tag>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
