import type { LucideIcon } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";

interface FinanceKpiCardProps {
  label: string;
  value: string;
  hint?: string;
  icon: LucideIcon;
  tone?: "default" | "success" | "warning" | "danger";
  /** When set, the card navigates on click. */
  href?: string;
  /** Client-side action (e.g. filter chips) — avoids slow same-route navigation. */
  onClick?: () => void;
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
  href,
  onClick,
}: FinanceKpiCardProps) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
        <span className={cn("flex size-8 items-center justify-center rounded-lg", toneStyles[tone])}>
          <Icon className="size-3.5" aria-hidden />
        </span>
      </div>
      <div className="mt-2 space-y-3">
        <p className="font-mono text-xl font-medium tracking-tight text-foreground tabular-nums">
          {value}
        </p>
        {hint ? (
          <p className="text-[11px] font-semibold leading-relaxed text-muted-foreground">{hint}</p>
        ) : null}
      </div>
    </>
  );

  const className = cn(
    "rounded-xl border border-border/80 bg-card p-3.5 shadow-sm transition-[box-shadow,border-color] duration-200 hover:border-border hover:shadow-md",
    (href || onClick) && "flex h-full min-h-[11rem] cursor-pointer flex-col hover:border-primary/30",
    onClick && "w-full text-left",
    href && "block",
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className}>
        {body}
      </button>
    );
  }

  if (href) {
    return (
      <Link href={href} className={className}>
        {body}
      </Link>
    );
  }

  return <div className={className}>{body}</div>;
}
