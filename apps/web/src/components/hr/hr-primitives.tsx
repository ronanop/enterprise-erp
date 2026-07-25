"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Inbox, RefreshCw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function HrStatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase();
  const tone =
    s.includes("active") || s.includes("approved") || s.includes("present") || s.includes("paid")
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : s.includes("pending") || s.includes("draft") || s.includes("submitted") || s.includes("open")
        ? "border-amber-200 bg-amber-50 text-amber-900"
        : s.includes("absent") || s.includes("reject") || s.includes("cancel") || s.includes("lost")
          ? "border-red-200 bg-red-50 text-red-800"
          : "border-border bg-muted text-muted-foreground";
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
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/80 bg-card/40 px-6 py-12 text-center">
      <div className="mb-3 flex size-10 items-center justify-center rounded-full bg-muted">
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
  return (
    <div className="rounded-xl border border-dashed border-amber-300/80 bg-amber-50 px-4 py-3 text-sm text-amber-950">
      Sign in to load live HRMS data.{" "}
      <Link href="/login" className="cursor-pointer font-medium underline underline-offset-2">
        Go to login
      </Link>
    </div>
  );
}

export function HrLoadingBlock({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-border/70 bg-card px-4 py-8 text-sm text-muted-foreground">
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
}: {
  items: { label: string; value: string | number; hint?: string }[];
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-xl border border-border/70 bg-card px-4 py-3 shadow-sm"
        >
          <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            {item.label}
          </p>
          <p className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
            {item.value}
          </p>
          {item.hint ? (
            <p className="mt-0.5 text-[11px] text-muted-foreground">{item.hint}</p>
          ) : null}
        </div>
      ))}
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
    <div className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm">
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
    <div className="flex flex-wrap items-center gap-2">
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
      className="group block cursor-pointer rounded-xl border border-border/70 bg-card p-4 shadow-sm transition-colors duration-200 hover:border-primary/30 hover:bg-muted/30"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-foreground group-hover:text-primary">
            {title}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        </div>
        <Badge variant="secondary">{count}</Badge>
      </div>
    </Link>
  );
}
