import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

interface FinanceKpiCardProps {
  label: string;
  value: string;
  hint?: string;
  icon: LucideIcon;
  tone?: "default" | "success" | "warning" | "danger";
}

const toneStyles = {
  default: "bg-primary/10 text-primary",
  success: "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300",
  warning: "bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300",
  danger: "bg-red-50 text-red-800 dark:bg-red-950/60 dark:text-red-300",
} as const;

export function FinanceKpiCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
}: FinanceKpiCardProps) {
  return (
    <div className="group rounded-2xl border border-border/70 bg-card/95 p-4 shadow-[0_1px_3px_0_rgba(0,0,0,0.03)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md backdrop-blur-xs cursor-default">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
        <span className={cn("flex size-8 items-center justify-center rounded-xl shadow-xs transition-transform duration-200 group-hover:scale-105", toneStyles[tone])}>
          <Icon className="size-3.5" aria-hidden />
        </span>
      </div>
      <p className="mt-2 font-mono text-2xl font-semibold tracking-tight text-foreground tabular-nums">
        {value}
      </p>
      {hint ? <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
