import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import { StatCardSkeleton } from "./loading-skeleton";

export type StatCardTrend = {
  label: string;
  direction?: "up" | "down" | "neutral";
};

export type StatCardTone = "default" | "sky" | "emerald" | "amber" | "slate" | "rose";

export type StatCardProps = {
  title: string;
  value?: ReactNode;
  icon?: LucideIcon;
  trend?: StatCardTrend;
  loading?: boolean;
  empty?: boolean;
  emptyLabel?: string;
  className?: string;
  onClick?: () => void;
  /** When true, card shows as the active filter / selection. */
  selected?: boolean;
  /** Accessible name when interactive (defaults to title). */
  "aria-label"?: string;
  /** Optional accent chip around the icon (premium dashboard look). */
  tone?: StatCardTone;
};

const TONE_CHIP: Record<StatCardTone, string> = {
  default: "bg-[rgba(3,105,161,0.1)] text-[#0369A1]",
  sky: "bg-sky-50 text-sky-700",
  emerald: "bg-emerald-50 text-emerald-700",
  amber: "bg-amber-50 text-amber-800",
  slate: "bg-slate-100 text-slate-600",
  rose: "bg-rose-50 text-rose-700",
};

const TONE_RING: Record<StatCardTone, string> = {
  default: "hover:border-[#0369A1]/45 hover:shadow-[0_8px_24px_-12px_rgba(3,105,161,0.35)]",
  sky: "hover:border-sky-400/60 hover:shadow-[0_8px_24px_-12px_rgba(14,165,233,0.35)]",
  emerald: "hover:border-emerald-400/60 hover:shadow-[0_8px_24px_-12px_rgba(16,185,129,0.35)]",
  amber: "hover:border-amber-400/60 hover:shadow-[0_8px_24px_-12px_rgba(245,158,11,0.35)]",
  slate: "hover:border-slate-400/60 hover:shadow-[0_8px_24px_-12px_rgba(71,85,105,0.3)]",
  rose: "hover:border-rose-400/60 hover:shadow-[0_8px_24px_-12px_rgba(244,63,94,0.3)]",
};

export function StatCard({
  title,
  value,
  icon: Icon,
  trend,
  loading,
  empty,
  emptyLabel = "—",
  className,
  onClick,
  selected = false,
  "aria-label": ariaLabel,
  tone = "default",
}: StatCardProps) {
  const interactive = Boolean(onClick);
  const displayValue = empty ? emptyLabel : value;

  if (loading) {
    return <StatCardSkeleton className={className} />;
  }

  return (
    <Card
      className={cn(
        "border-border/70 bg-background/95 shadow-sm transition-[border-color,box-shadow,transform] duration-200",
        "motion-reduce:transition-none",
        interactive &&
          cn(
            "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            "active:translate-y-px motion-reduce:active:translate-y-0",
            TONE_RING[tone],
          ),
        selected &&
          "border-[#0369A1] shadow-[0_8px_24px_-12px_rgba(3,105,161,0.35)] ring-1 ring-[#0369A1]/35",
        className,
      )}
      onClick={onClick}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-label={interactive ? ariaLabel ?? title : undefined}
      aria-pressed={interactive ? selected : undefined}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
    >
      <CardHeader className="flex flex-row items-start justify-between space-y-0 px-4 pb-1.5 pt-3">
        <CardTitle
          className={cn(
            "text-[11px] font-semibold tracking-wide uppercase",
            selected ? "text-[#0369A1]" : "text-muted-foreground",
          )}
        >
          {title}
        </CardTitle>
        {Icon ? (
          <span
            className={cn(
              "flex size-7 shrink-0 items-center justify-center rounded-lg",
              TONE_CHIP[tone],
            )}
          >
            <Icon className="size-3.5" aria-hidden />
          </span>
        ) : null}
      </CardHeader>
      <CardContent className="px-4 pb-3.5 pt-0">
        <p className="text-xl font-semibold tabular-nums tracking-tight text-foreground sm:text-2xl">
          {displayValue}
        </p>
        {trend ? (
          <p
            className={cn(
              "mt-1 text-[11px] text-muted-foreground",
              trend.direction === "up" && "text-emerald-700 dark:text-emerald-400",
              trend.direction === "down" && "text-destructive",
            )}
          >
            {trend.label}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
