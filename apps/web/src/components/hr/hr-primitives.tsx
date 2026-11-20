"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Inbox, RefreshCw } from "lucide-react";

import { redirectToLogin } from "@/lib/auth";

import { EmptyState } from "@/components/shared/empty-state";
import { dataTableClasses } from "@/components/shared/table-classes";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function HrStatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase();
  const tone =
    s.includes("not present") ||
    s.includes("absent") ||
    s.includes("reject") ||
    s.includes("cancel") ||
    s.includes("lost") ||
    s.includes("not served") ||
    s.includes("direct") ||
    s.includes("resign") ||
    s.includes("terminat") ||
    s.includes("ex employee") ||
    s === "inactive"
      ? "border-transparent bg-hrms-pink text-hrms-danger"
      : s.includes("active") ||
          s.includes("approved") ||
          s.includes("accepted") ||
          s.includes("present") ||
          s.includes("paid") ||
          s === "served"
        ? "border-transparent bg-hrms-mint text-hrms-success"
        : s.includes("pending") ||
            s.includes("draft") ||
            s.includes("submitted") ||
            s.includes("open") ||
            s.includes("onboarding") ||
            s.includes("notice") ||
            s.includes("serving")
          ? "border-transparent bg-hrms-peach text-hrms-warning"
          : "border-transparent bg-hrms-blue text-hrms-info";
  return (
    <span
      className={cn(
        "inline-flex rounded-md border px-1.5 py-0.5 text-[10px] font-medium tracking-wide uppercase",
        tone,
      )}
    >
      {status || "-"}
    </span>
  );
}

export function HrEmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <EmptyState
      bordered
      icon={Inbox}
      title={title}
      description={description ?? null}
      action={action}
      className="bg-card"
    />
  );
}

export function HrAuthBanner() {
  useEffect(() => {
    redirectToLogin();
  }, []);

  return (
    <div className="rounded-2xl border border-hrms-peach bg-hrms-peach px-4 py-3 text-sm text-foreground">
      Session not found. Redirecting to sign in…{" "}
      <Link href="/login" className="cursor-pointer font-medium underline underline-offset-2">
        Go to login
      </Link>
    </div>
  );
}

export function HrLoadingBlock({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 rounded-2xl border border-border bg-card px-4 py-8 text-sm text-muted-foreground shadow-sm">
      <RefreshCw className="size-4 animate-spin" />
      {label}
    </div>
  );
}

export function HrSection({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-foreground">{title}</h2>
          {description ? (
            <p className="text-xs text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {children}
    </section>
  );
}

const HR_KPI_HERO =
  "relative overflow-hidden rounded-2xl border border-white/10 px-4 py-3 text-white shadow-sm bg-[linear-gradient(135deg,var(--kpi-hero-from)_0%,var(--kpi-hero-via)_45%,var(--kpi-hero-to)_100%)]";

export function HrKpiGrid({
  items,
  className,
  activeKey,
  onItemClick,
}: {
  items: { key?: string; label: string; value: string | number; hint?: string }[];
  className?: string;
  activeKey?: string;
  onItemClick?: (key: string) => void;
}) {
  const desktopCols =
    items.length <= 3
      ? "lg:grid-cols-3"
      : items.length === 4
        ? "lg:grid-cols-4"
        : items.length === 5
          ? "lg:grid-cols-5"
          : "lg:grid-cols-6";

  return (
    <div className={cn("grid grid-cols-2 gap-3", desktopCols, className)}>
      {items.map((item) => {
        const itemKey = item.key ?? item.label;
        const clickable = Boolean(onItemClick);
        const active = activeKey === itemKey;
        const inner = (
          <>
            <span
              className="pointer-events-none absolute -top-10 -right-8 size-28 rounded-full bg-white/10 blur-2xl"
              aria-hidden
            />
            <p className="relative text-[11px] font-normal tracking-wide text-white/75 uppercase">
              {item.label}
            </p>
            <p className="relative mt-1 text-2xl font-normal tracking-tight text-white tabular-nums">
              {item.value}
            </p>
            {item.hint ? (
              <p className="relative mt-0.5 text-[11px] text-white/65">{item.hint}</p>
            ) : null}
          </>
        );
        if (!clickable) {
          return (
            <div key={itemKey} className={HR_KPI_HERO}>
              {inner}
            </div>
          );
        }
        return (
          <button
            key={itemKey}
            type="button"
            onClick={() => onItemClick?.(itemKey)}
            className={cn(
              HR_KPI_HERO,
              "cursor-pointer text-left transition-[filter,box-shadow] duration-200 hover:brightness-[1.06]",
              active && "ring-2 ring-white/40 ring-offset-2 ring-offset-background",
            )}
          >
            {inner}
          </button>
        );
      })}
    </div>
  );
}

export function HrTable({
  columns,
  rows,
  emptyTitle,
  emptyDescription,
}: {
  columns: { key: string; label: string; className?: string }[];
  rows: Record<string, ReactNode>[];
  emptyTitle: string;
  emptyDescription?: string;
}) {
  if (!rows.length) {
    return <HrEmptyState title={emptyTitle} description={emptyDescription} />;
  }
  return (
    <div className={dataTableClasses.shell}>
      <div className={dataTableClasses.scroll}>
        <table className={cn(dataTableClasses.table, "min-w-[640px]")}>
          <thead>
            <tr className={dataTableClasses.thead}>
              {columns.map((col) => (
                <th key={col.key} scope="col" className={cn(dataTableClasses.th, col.className)}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={String(row.__key ?? idx)} className={dataTableClasses.tr}>
                {columns.map((col) => (
                  <td key={col.key} className={cn(dataTableClasses.td, col.className)}>
                    {row[col.key] ?? "-"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export type HrTabItem = {
  id: string;
  label: string;
  icon?: LucideIcon;
  badge?: number | string;
};

/** Underline tabs with optional icon + label (uses theme primary, not hard-coded blue). */
export function HrUnderlineTabs({
  tabs,
  value,
  onChange,
  className,
  trailing,
  embedded,
  size = "md",
  variant = "underline",
}: {
  tabs: HrTabItem[];
  value: string;
  onChange: (id: string) => void;
  className?: string;
  trailing?: ReactNode;
  /** Skip outer card chrome when tabs sit inside another container. */
  embedded?: boolean;
  size?: "sm" | "md";
  variant?: "underline" | "pills";
}) {
  const pills = variant === "pills";
  const pad = pills
    ? "px-3 py-1.5 text-[12px]"
    : size === "sm"
      ? "px-2.5 py-2 text-xs"
      : "px-3 py-2.5 text-sm sm:px-4";
  const iconSize = pills || size === "sm" ? "size-3.5" : "size-4";

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-2",
        !embedded && !pills && "rounded-2xl border border-border bg-card px-2 shadow-sm",
        !embedded && pills && "rounded-full border border-[#E5E7EB] bg-white px-1.5 py-1 shadow-[0_1px_2px_rgba(15,23,42,0.04)]",
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-0.5 overflow-x-auto overflow-y-hidden">
        {tabs.map((t) => {
          const active = value === t.id;
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onChange(t.id)}
              className={cn(
                "flex shrink-0 cursor-pointer items-center gap-2 transition-colors duration-200",
                pad,
                pills
                  ? cn(
                      "rounded-full font-medium",
                      active
                        ? "bg-[#7C3AED] text-white"
                        : "text-[#6B7280] hover:bg-[#F5F3FF] hover:text-[#7C3AED]",
                    )
                  : cn(
                      "-mb-px border-b-[3px]",
                      active
                        ? "border-primary font-semibold text-foreground"
                        : "border-transparent font-normal text-muted-foreground hover:text-foreground",
                    ),
              )}
            >
              {Icon ? <Icon className={cn(iconSize, "shrink-0")} strokeWidth={1.75} /> : null}
              <span className="whitespace-nowrap">{t.label}</span>
              {t.badge != null && t.badge !== 0 ? (
                <span
                  className={cn(
                    "inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                    pills
                      ? active
                        ? "bg-white/20 text-white"
                        : "bg-[#7C3AED] text-white"
                      : "bg-primary text-primary-foreground",
                  )}
                >
                  {t.badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      {trailing ? (
        <div className={cn("flex shrink-0 flex-wrap items-center gap-2", !pills && "pb-1")}>
          {trailing}
        </div>
      ) : null}
    </div>
  );
}

export function HrToolbar({
  onRefresh,
  loading,
  children,
}: {
  onRefresh?: () => void;
  loading?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className="flex w-full min-w-0 flex-wrap items-center gap-2">
      {children}
      {onRefresh ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="cursor-pointer"
          disabled={loading}
          onClick={onRefresh}
        >
          <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
          Refresh
        </Button>
      ) : null}
    </div>
  );
}

export function HrSetupCard({
  title,
  description,
  count,
  href,
}: {
  title: string;
  description: string;
  count: number;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group block cursor-pointer rounded-2xl border border-border bg-card p-4 shadow-sm transition-all duration-200 hover:border-primary/40 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-foreground">
            {title}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        </div>
        <Badge variant="secondary">{count}</Badge>
      </div>
    </Link>
  );
}
