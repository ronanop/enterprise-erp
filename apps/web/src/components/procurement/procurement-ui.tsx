"use client";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/** Shared layout tokens — aligned with CRM workspace UI. */
export const procurementUi = {
  page: "space-y-5",
  tableShell: "overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm",
  tableScroll: "overflow-x-auto",
  table: "w-full text-left text-[13px] leading-snug",
  thead:
    "border-b border-border/80 bg-muted/20 text-[10px] font-semibold uppercase tracking-[0.07em] text-muted-foreground",
  th: "px-3 py-2.5",
  tr: "border-b border-border/50 transition-colors duration-150 last:border-0 hover:bg-muted/20",
  td: "px-3 py-2 align-middle",
  tdMuted: "px-3 py-2 align-middle text-muted-foreground",
  tdNumeric: "px-3 py-2 align-middle tabular-nums",
  empty: "px-3 py-12 text-center text-sm text-muted-foreground",
  searchRow: "flex justify-end",
  searchInput:
    "h-8 w-full max-w-[220px] border-border/70 bg-background text-sm shadow-none transition-colors duration-200",
  rowActions: "flex flex-wrap items-center gap-1",
  actionBtn:
    "h-7 cursor-pointer gap-1 px-2 text-xs font-medium transition-colors duration-200",
  statusBadge: "text-[10px] font-medium uppercase tracking-wide",
  sectionCard: "space-y-3 rounded-xl border border-border/80 bg-card p-4 shadow-sm",
  sectionTitle: "text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground",
} as const;

/** Page vertical rhythm — matches CRM dashboard. */
export function ProcurementPage({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn(procurementUi.page, className)}>{children}</div>;
}

export function ProcurementErrorBanner({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
      {children}
    </div>
  );
}

export function ProcurementInfoBanner({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-sky-200/80 bg-sky-50 px-4 py-2.5 text-xs text-sky-950">
      {children}
    </div>
  );
}

export function ProcurementWarnBanner({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-amber-300/80 bg-amber-50 px-4 py-3 text-sm text-amber-950">
      {children}
    </div>
  );
}

export function ProcurementIconBadge({
  icon: Icon,
  className,
}: {
  icon: LucideIcon;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground",
        className,
      )}
    >
      <Icon className="size-4" aria-hidden />
    </span>
  );
}

export function ProcurementSection({
  title,
  subtitle,
  icon,
  badge,
  actions,
  children,
  className,
  bodyClassName,
}: {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  badge?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn("rounded-xl border border-border/80 bg-card p-4 shadow-sm", className)}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          {icon ? <ProcurementIconBadge icon={icon} /> : null}
          <div className="min-w-0">
            <h2 className="truncate text-sm font-medium tracking-tight">{title}</h2>
            {subtitle ? <p className="text-[11px] text-muted-foreground">{subtitle}</p> : null}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {badge}
          {actions}
        </div>
      </div>
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}

export function ProcurementListPanel({
  children,
  className,
  id,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <div id={id} className={cn(procurementUi.tableShell, className)}>{children}</div>
  );
}

export function ProcurementHeadlineBand({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-xl border border-border/80 bg-primary shadow-sm",
        className,
      )}
    >
      {children}
    </section>
  );
}

export function ProcurementHeadlineStat({
  label,
  value,
  sub,
  loading,
  className,
}: {
  label: string;
  value: string;
  sub?: string;
  loading?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0 px-5 py-4", className)}>
      <p className="text-[11px] font-medium tracking-wide text-white/60 uppercase">{label}</p>
      {loading ? (
        <div className="mt-2 h-8 w-32 animate-pulse rounded bg-white/15" />
      ) : (
        <p className="mt-1.5 truncate text-2xl font-semibold tracking-tight text-white tabular-nums">
          {value}
        </p>
      )}
      {sub ? <p className="mt-1 text-xs text-white/60">{sub}</p> : null}
    </div>
  );
}

type KpiTone = "default" | "success" | "warning" | "danger";

const KPI_TONE: Record<KpiTone, { icon: string; bar: string }> = {
  default: { icon: "bg-sky-50 text-sky-700", bar: "bg-sky-500" },
  success: { icon: "bg-emerald-50 text-emerald-700", bar: "bg-emerald-500" },
  warning: { icon: "bg-amber-50 text-amber-700", bar: "bg-amber-500" },
  danger: { icon: "bg-red-50 text-red-700", bar: "bg-red-500" },
};

export function ProcurementKpiCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
  href,
  loading,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: LucideIcon;
  tone?: KpiTone;
  href?: string;
  loading?: boolean;
}) {
  const styles = KPI_TONE[tone];
  const body = (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border border-border/80 bg-card p-3.5 shadow-sm transition-[box-shadow,border-color] duration-200",
        href && "hover:border-border hover:shadow-md",
      )}
    >
      <span className={cn("absolute inset-y-0 left-0 w-1", styles.bar)} aria-hidden />
      <div className="flex items-start justify-between gap-2 pl-1.5">
        <p className="text-[11px] font-medium tracking-wide text-muted-foreground">
          {label}
        </p>
        <span
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-lg",
            styles.icon,
          )}
        >
          <Icon className="size-4" aria-hidden />
        </span>
      </div>
      {loading ? (
        <div className="mt-2 ml-1.5 h-7 w-24 animate-pulse rounded bg-muted" />
      ) : (
        <p className="mt-2 pl-1.5 text-2xl font-semibold tracking-tight text-foreground tabular-nums">
          {value}
        </p>
      )}
      {hint ? (
        <p className="mt-1 flex items-center gap-1 pl-1.5 text-[11px] text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
  if (href) {
    return (
      <Link
        href={href}
        className="block h-full w-full cursor-pointer rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        {body}
      </Link>
    );
  }
  return body;
}

export function ProcurementViewAllLink({
  href,
  label = "View all",
}: {
  href: string;
  label?: string;
}) {
  return (
    <Link
      href={href}
      className="inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-primary transition-opacity duration-200 hover:opacity-80"
    >
      {label} <ArrowUpRight className="size-3.5" />
    </Link>
  );
}

export function ProcurementCountBadge({
  count,
  label = "shown",
}: {
  count: number;
  label?: string;
}) {
  return (
    <Badge variant="secondary" className="shrink-0">
      {count} {label}
    </Badge>
  );
}
