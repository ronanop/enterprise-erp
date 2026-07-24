"use client";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/** Page vertical rhythm — matches CRM dashboard. */
export function CrmPage({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("space-y-5", className)}>{children}</div>;
}

export function CrmErrorBanner({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
      {children}
    </div>
  );
}

export function CrmInfoBanner({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-sky-200/80 bg-sky-50 px-4 py-2.5 text-xs text-sky-950">
      {children}
    </div>
  );
}

export function CrmWarnBanner({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-amber-300/80 bg-amber-50 px-4 py-3 text-sm text-amber-950">
      {children}
    </div>
  );
}

/** Icon chip used in section / list headers. */
export function CrmIconBadge({
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

/** Section card with dashboard-style icon header. */
export function CrmSection({
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
          {icon ? <CrmIconBadge icon={icon} /> : null}
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

/** Card shell for list tables — border + shadow only; toolbar is separate. */
export function CrmListPanel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Navy headline strip for key metrics (dashboard / detail pages). */
export function CrmHeadlineBand({
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

export function CrmHeadlineStat({
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

export function CrmKpiCard({
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
    <div className="group relative overflow-hidden rounded-xl border border-border/80 bg-card p-3.5 shadow-sm transition-[box-shadow,border-color] duration-200 hover:border-border hover:shadow-md">
      <span className={cn("absolute inset-y-0 left-0 w-1", styles.bar)} aria-hidden />
      <div className="flex items-start justify-between gap-2 pl-1.5">
        <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
          {label}
        </p>
        <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg", styles.icon)}>
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
      {href ? (
        <ArrowUpRight className="absolute right-3 bottom-3 size-4 text-muted-foreground/0 transition-colors duration-200 group-hover:text-muted-foreground" />
      ) : null}
    </div>
  );
  if (href) {
    return (
      <Link href={href} className="cursor-pointer">
        {body}
      </Link>
    );
  }
  return body;
}

export function CrmActivityTile({
  label,
  value,
  icon: Icon,
  tint,
  href,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  tint: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group flex cursor-pointer items-center gap-3 rounded-xl border border-border/80 bg-card px-4 py-3 shadow-sm transition-[box-shadow,border-color] duration-200 hover:border-border hover:shadow-md"
    >
      <span className={cn("flex size-9 items-center justify-center rounded-lg", tint)}>
        <Icon className="size-4" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
          {label}
        </p>
        <p className="text-lg font-semibold tabular-nums text-foreground">{value}</p>
      </div>
      <ArrowUpRight className="ml-auto size-4 text-muted-foreground/50 transition-colors duration-200 group-hover:text-primary" />
    </Link>
  );
}

export function CrmDetailGrid({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <dl className={cn("grid grid-cols-2 gap-3 text-xs lg:grid-cols-3", className)}>
      {children}
    </dl>
  );
}

export function CrmDetailItem({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="mt-1 break-words text-sm text-foreground">{children}</dd>
    </div>
  );
}

export function CrmMetricStrip({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "grid gap-3 rounded-xl border border-border/80 bg-card p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-4",
        className,
      )}
    >
      {children}
    </section>
  );
}

export function CrmMetric({
  label,
  value,
  hint,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className="mt-1 text-lg font-semibold tracking-tight text-foreground tabular-nums">{value}</p>
      {hint ? <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function CrmViewAllLink({ href, label = "View all" }: { href: string; label?: string }) {
  return (
    <Link
      href={href}
      className="inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-primary transition-opacity duration-200 hover:opacity-80"
    >
      {label} <ArrowUpRight className="size-3.5" />
    </Link>
  );
}

export function CrmCountBadge({ count, label = "shown" }: { count: number; label?: string }) {
  return (
    <Badge variant="secondary" className="shrink-0">
      {count} {label}
    </Badge>
  );
}
