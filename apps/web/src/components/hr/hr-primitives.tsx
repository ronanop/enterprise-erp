"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Inbox, RefreshCw } from "lucide-react";

import { redirectToLogin } from "@/lib/auth";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { hrmsPastelSurface } from "@/config/hrms-theme";
import { cn } from "@/lib/utils";

export function HrStatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase();
  const tone =
    s.includes("active") || s.includes("approved") || s.includes("present") || s.includes("paid")
      ? "border-transparent bg-hrms-mint text-hrms-success"
      : s.includes("pending") || s.includes("draft") || s.includes("submitted") || s.includes("open") || s.includes("onboarding")
        ? "border-transparent bg-hrms-peach text-hrms-warning"
        : s.includes("absent") || s.includes("reject") || s.includes("cancel") || s.includes("lost")
          ? "border-transparent bg-hrms-pink text-hrms-danger"
          : "border-transparent bg-hrms-blue text-hrms-info";
  return (
    <span
      className={cn(
        "inline-flex rounded-md border px-1.5 py-0.5 text-[10px] font-medium tracking-wide uppercase",
        tone,
      )}
    >
      {status || "—"}
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
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card px-6 py-12 text-center shadow-sm">
      <div className="mb-3 flex size-10 items-center justify-center rounded-full bg-hrms-lavender">
        <Inbox className="size-4 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description ? (
        <p className="mt-1 max-w-sm text-xs text-muted-foreground">{description}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
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
      {items.map((item, index) => {
        const itemKey = item.key ?? item.label;
        const clickable = Boolean(onItemClick);
        const active = activeKey === itemKey;
        const pastel = hrmsPastelSurface(index);
        const inner = (
          <>
            <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
              {item.label}
            </p>
            <p className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
              {item.value}
            </p>
            {item.hint ? (
              <p className="mt-0.5 text-[11px] text-muted-foreground">{item.hint}</p>
            ) : null}
          </>
        );
        if (!clickable) {
          return (
            <div
              key={itemKey}
              className={cn(
                "rounded-2xl border border-border px-4 py-3 shadow-sm",
                pastel,
              )}
            >
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
              "cursor-pointer rounded-2xl border px-4 py-3 text-left shadow-sm transition-all",
              pastel,
              active
                ? "border-foreground/20 ring-2 ring-primary"
                : "border-border hover:brightness-[0.98]",
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
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="erp-scroll overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-border/70 bg-muted/40">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    "px-3 py-2 text-[11px] font-medium tracking-wide text-muted-foreground uppercase",
                    col.className,
                  )}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr
                key={String(row.__key ?? idx)}
                className="border-b border-border/50 last:border-0 hover:bg-muted/30"
              >
                {columns.map((col) => (
                  <td key={col.key} className={cn("px-3 py-2.5 align-middle", col.className)}>
                    {row[col.key] ?? "—"}
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
}: {
  tabs: HrTabItem[];
  value: string;
  onChange: (id: string) => void;
  className?: string;
  trailing?: ReactNode;
  /** Skip outer card chrome when tabs sit inside another container. */
  embedded?: boolean;
  size?: "sm" | "md";
}) {
  const pad = size === "sm" ? "px-2.5 py-2 text-xs" : "px-3 py-2.5 text-sm sm:px-4";
  const iconSize = size === "sm" ? "size-3.5" : "size-4";

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-2",
        !embedded && "rounded-2xl border border-border bg-card px-2 shadow-sm",
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
                "-mb-px flex shrink-0 cursor-pointer items-center gap-2 border-b-[3px] transition-colors",
                pad,
                active
                  ? "border-primary font-semibold text-foreground"
                  : "border-transparent font-normal text-muted-foreground hover:text-foreground",
              )}
            >
              {Icon ? <Icon className={cn(iconSize, "shrink-0")} /> : null}
              <span className="whitespace-nowrap">{t.label}</span>
              {t.badge != null && t.badge !== 0 ? (
                <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
                  {t.badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      {trailing ? <div className="flex shrink-0 flex-wrap items-center gap-2 pb-1">{trailing}</div> : null}
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
