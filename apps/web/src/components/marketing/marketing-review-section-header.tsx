"use client";

import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

type MarketingReviewSectionHeaderProps = {
  title: string;
  description?: string;
  icon?: LucideIcon;
  tone?: "preview" | "workflow" | "activity" | "pipeline";
  count?: number;
  className?: string;
};

export function MarketingReviewSectionHeader({
  title,
  description,
  icon: Icon,
  tone = "preview",
  count,
  className,
}: MarketingReviewSectionHeaderProps) {
  if (tone === "pipeline") {
    return (
      <div
        className={cn(
          "flex items-center justify-between gap-3 border-b border-border/60 bg-gradient-to-r from-muted/40 via-background/50 to-transparent px-4 py-3.5 sm:px-5",
          className,
        )}
      >
        <div className="min-w-0">
          <h3 className="text-sm font-semibold tracking-tight text-foreground">{title}</h3>
          {description ? <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{description}</p> : null}
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold tabular-nums shadow-sm",
            (count ?? 0) > 0
              ? "bg-primary/12 text-primary ring-1 ring-primary/20"
              : "bg-muted text-muted-foreground",
          )}
        >
          {count ?? 0}
        </span>
      </div>
    );
  }

  if (tone === "workflow") {
    return (
      <div
        className={cn(
          "flex items-center gap-3 border-b border-border/60 bg-gradient-to-r from-primary/[0.08] via-primary/[0.03] to-transparent px-4 py-3.5 sm:px-5",
          className,
        )}
      >
        <div className="h-9 w-1 shrink-0 rounded-full bg-gradient-to-b from-primary to-primary/40 shadow-sm" aria-hidden />
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-primary">{title}</p>
          {description ? <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{description}</p> : null}
        </div>
      </div>
    );
  }

  if (tone === "activity") {
    return (
      <div className={cn("border-b border-border/60 bg-muted/15 px-4 py-3.5 sm:px-5", className)}>
        <div className="flex items-center gap-3">
          {Icon ? (
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full border border-border/70 bg-background shadow-sm ring-1 ring-black/[0.03] dark:ring-white/[0.05]">
              <Icon className="size-3.5 text-muted-foreground" />
            </div>
          ) : null}
          <div className="min-w-0">
            <h3 className="text-sm font-semibold tracking-tight text-foreground">{title}</h3>
            {description ? <p className="text-[11px] text-muted-foreground">{description}</p> : null}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "border-b border-border/60 bg-gradient-to-r from-muted/45 via-muted/15 to-transparent px-4 py-3.5 sm:px-5",
        className,
      )}
    >
      <div className="flex items-center gap-3">
        {Icon ? (
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-background shadow-sm ring-1 ring-primary/10">
            <Icon className="size-4 text-primary/85" />
          </div>
        ) : null}
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold tracking-tight text-foreground">{title}</h3>
          {description ? (
            <p className="mt-0.5 text-xs font-medium leading-relaxed text-muted-foreground">{description}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
