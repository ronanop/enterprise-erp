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
  default: "bg-accent text-accent-foreground",
  success: "bg-emerald-100 text-emerald-800",
  warning: "bg-amber-100 text-amber-900",
  danger: "bg-red-100 text-red-800",
} as const;

export function FinanceKpiCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
}: FinanceKpiCardProps) {
  return (
    <div className="rounded-xl border border-border/80 bg-card p-3.5 shadow-sm transition-[box-shadow,border-color] duration-200 hover:border-border hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
        <span className={cn("flex size-8 items-center justify-center rounded-lg", toneStyles[tone])}>
          <Icon className="size-3.5" aria-hidden />
        </span>
      </div>
      <p className="mt-2 font-mono text-xl font-medium tracking-tight text-foreground tabular-nums">
        {value}
      </p>
      {hint ? <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
