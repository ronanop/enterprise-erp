"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft, RefreshCw } from "lucide-react";

import { Loader2 } from "lucide-react";

import { FinanceStatusBadge } from "@/components/finance/finance-status-badge";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function textOrDash(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  const text = String(value).trim();
  return text || "—";
}

export function ModuleDetailPage({
  title,
  subtitle,
  backHref,
  backLabel,
  status,
  loading,
  error,
  onRefresh,
  busy,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  backHref: string;
  backLabel: string;
  status?: string;
  loading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
  busy?: boolean;
  actions?: ReactNode;
  children: ReactNode;
}) {
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="h-40 animate-pulse rounded-xl bg-muted" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          {backLabel}
        </Link>
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-6 text-sm text-destructive">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={title}
        description={subtitle}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {status ? <FinanceStatusBadge status={status} /> : null}
            {onRefresh ? (
              <Button
                variant="outline"
                size="sm"
                className="shadow-none"
                onClick={onRefresh}
                disabled={busy}
              >
                <RefreshCw className={cn("size-3.5", busy && "animate-spin")} />
                Refresh
              </Button>
            ) : null}
            {actions}
            <Link
              href={backHref}
              className="inline-flex h-8 items-center rounded-lg border border-border/80 bg-card px-3 text-sm font-medium shadow-sm transition-colors hover:bg-muted"
            >
              {backLabel}
            </Link>
          </div>
        }
      />
      {children}
    </div>
  );
}

export function ModuleDetailSection({
  title,
  children,
  className,
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm",
        className,
      )}
    >
      <div className="border-b border-border/70 px-5 py-3.5">
        <h2 className="text-sm font-medium tracking-tight">{title}</h2>
      </div>
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}

export function ModuleDetailGrid({
  items,
}: {
  items: { label: string; value: ReactNode; fullWidth?: boolean }[];
}) {
  return (
    <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <div key={item.label} className={item.fullWidth ? "sm:col-span-2 lg:col-span-3" : undefined}>
          <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {item.label}
          </dt>
          <dd className="mt-1 text-sm text-foreground">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function ModuleWorkflowActions({
  actions,
  busy,
  onAction,
}: {
  actions: { key: string; label: string; variant?: "default" | "outline" | "destructive" }[];
  busy?: boolean;
  onAction: (key: string) => void;
}) {
  if (actions.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((action) => (
        <Button
          key={action.key}
          size="sm"
          variant={action.variant ?? "default"}
          disabled={busy}
          onClick={() => onAction(action.key)}
        >
          {busy ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : null}
          {action.label}
        </Button>
      ))}
    </div>
  );
}

export function ModuleCrossLink({
  href,
  label,
}: {
  href: string;
  label: string;
}) {
  return (
    <Link href={href} className="text-sm font-medium text-primary hover:underline">
      {label}
    </Link>
  );
}

export function ModuleTimeline({
  items,
}: {
  items: { id: string; title: string; subtitle?: string; at?: string }[];
}) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">No activity yet.</p>;
  }
  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item.id} className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5">
          <p className="text-sm font-medium">{item.title}</p>
          {item.subtitle ? (
            <p className="mt-0.5 text-xs text-muted-foreground">{item.subtitle}</p>
          ) : null}
          {item.at ? <p className="mt-1 text-[11px] text-muted-foreground">{item.at}</p> : null}
        </li>
      ))}
    </ul>
  );
}
