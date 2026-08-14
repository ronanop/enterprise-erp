import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import { StatCardSkeleton } from "./loading-skeleton";

export type StatCardTrend = {
  label: string;
  direction?: "up" | "down" | "neutral";
};

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
}: StatCardProps) {
  const interactive = Boolean(onClick);
  const displayValue = empty ? emptyLabel : value;

  if (loading) {
    return <StatCardSkeleton className={className} />;
  }

  return (
    <Card
      className={cn(
        "border-border/80 shadow-sm transition-[border-color,box-shadow] duration-200",
        interactive && "cursor-pointer hover:border-primary/25 hover:shadow-md",
        className,
      )}
      onClick={onClick}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
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
        <CardTitle className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
          {title}
        </CardTitle>
        {Icon ? (
          <Icon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
        ) : null}
      </CardHeader>
      <CardContent className="px-4 pb-3 pt-0">
        <p className="font-mono text-xl font-semibold tabular-nums tracking-tight text-foreground sm:text-2xl">
          {displayValue}
        </p>
        {trend ? (
          <p
            className={cn(
              "mt-0.5 text-[11px] text-muted-foreground",
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
