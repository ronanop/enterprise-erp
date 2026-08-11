"use client";

import Link from "next/link";
import { Pie, PieChart, ResponsiveContainer, Tooltip, Cell } from "recharts";
import { ExternalLink, PieChart as PieChartIcon, type LucideIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  PO_OVERVIEW_BUCKET_LABELS,
  type PoBucketCounts,
  type PoOverviewBucket,
} from "@/utils/procurement-po-buckets";

/** Swiss/minimal palette — aligned with CRM dashboard charts (no purple). */
const PROC_CHART_COLORS = {
  sky: "#0369A1",
  teal: "#0F766E",
  emerald: "#047857",
  slate: "#475569",
  amber: "#B45309",
} as const;

const PO_BUCKET_COLORS: Record<PoOverviewBucket, string> = {
  draft: PROC_CHART_COLORS.slate,
  open: PROC_CHART_COLORS.sky,
  partial: PROC_CHART_COLORS.amber,
  close: PROC_CHART_COLORS.emerald,
};

const PO_BUCKETS: PoOverviewBucket[] = ["draft", "open", "partial", "close"];

const DONUT_H = 112;
const DONUT_INNER = 34;
const DONUT_OUTER = 48;

type TooltipPayload = { name?: string; value?: number };

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0];
  const value = Number(row.value ?? 0);
  return (
    <div className="rounded-lg border border-border/80 bg-card px-2 py-1 text-xs shadow-md">
      <p className="font-medium text-foreground">{label ?? row.name}</p>
      <p className="tabular-nums text-muted-foreground">{value.toLocaleString("en-IN")}</p>
    </div>
  );
}

function ProcurementChartSection({
  title,
  subtitle,
  icon: Icon,
  badge,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  badge?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn("rounded-xl border border-border/80 bg-card p-3 shadow-sm", className)}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          {Icon ? (
            <span
              className="inline-flex size-7 shrink-0 items-center justify-center rounded-md border border-border/60 bg-muted/40 text-foreground"
              aria-hidden
            >
              <Icon className="size-3.5" />
            </span>
          ) : null}
          <div className="min-w-0">
            <h2 className="truncate text-sm font-medium tracking-tight">{title}</h2>
            {subtitle ? (
              <p className="truncate text-[10px] text-muted-foreground">{subtitle}</p>
            ) : null}
          </div>
        </div>
        {badge ? <div className="shrink-0">{badge}</div> : null}
      </div>
      {children}
    </section>
  );
}

function ChartEmpty({ message }: { message: string }) {
  return (
    <div
      className="flex h-[112px] items-center justify-center text-xs text-muted-foreground"
      style={{ minHeight: DONUT_H }}
    >
      {message}
    </div>
  );
}

function PoLifecycleDonut({
  counts,
  loading,
}: {
  counts: PoBucketCounts;
  loading?: boolean;
}) {
  const data = PO_BUCKETS.map((key) => ({
    name: PO_OVERVIEW_BUCKET_LABELS[key],
    value: counts[key],
    key,
  }));
  const total = data.reduce((sum, d) => sum + d.value, 0);
  const chartData = data.filter((d) => d.value > 0);

  if (loading) return <ChartEmpty message="Loading…" />;
  if (!total) return <ChartEmpty message="No purchase orders yet" />;

  return (
    <div className="flex items-center gap-3">
      <div
        className="relative shrink-0"
        style={{ width: DONUT_H, height: DONUT_H }}
        role="img"
        aria-label="Purchase order lifecycle mix"
      >
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="name"
              innerRadius={DONUT_INNER}
              outerRadius={DONUT_OUTER}
              paddingAngle={2}
              strokeWidth={0}
            >
              {chartData.map((d) => (
                <Cell key={d.key} fill={PO_BUCKET_COLORS[d.key]} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <p className="font-mono text-base font-medium tabular-nums text-foreground">{total}</p>
          <p className="text-[9px] tracking-wide text-muted-foreground uppercase">POs</p>
        </div>
      </div>
      <ul className="min-w-0 flex-1 space-y-1">
        {PO_BUCKETS.map((key) => {
          const count = counts[key];
          if (!count) return null;
          return (
            <li key={key} className="flex items-center justify-between gap-2 text-[11px]">
              <Link
                href="/procurement"
                className="flex min-w-0 cursor-pointer items-center gap-1.5 truncate text-muted-foreground transition-colors duration-200 hover:text-foreground"
              >
                <span
                  className="size-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: PO_BUCKET_COLORS[key] }}
                />
                {PO_OVERVIEW_BUCKET_LABELS[key]}
              </Link>
              <span className="shrink-0 font-mono tabular-nums text-foreground">{count}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

const SCM_STATUS_COLORS = {
  open: PROC_CHART_COLORS.amber,
  close: PROC_CHART_COLORS.emerald,
  hold: "#DC2626",
} as const;

type ScmOvfStatusKey = keyof typeof SCM_STATUS_COLORS;

const SCM_STATUS_LABELS: Record<ScmOvfStatusKey, string> = {
  open: "Open",
  close: "Close",
  hold: "Hold",
};

const SCM_STATUS_FILTERS: Record<ScmOvfStatusKey, string> = {
  open: "open",
  close: "close",
  hold: "hold",
};

const SCM_STATUS_KEYS: ScmOvfStatusKey[] = ["open", "close", "hold"];

function ScmQueueDonut({
  open,
  close,
  hold,
  loading,
}: {
  open: number;
  close: number;
  hold: number;
  loading?: boolean;
}) {
  const counts: Record<ScmOvfStatusKey, number> = { open, close, hold };
  const data = SCM_STATUS_KEYS.map((key) => ({
    name: SCM_STATUS_LABELS[key],
    value: counts[key],
    key,
    color: SCM_STATUS_COLORS[key],
  }));
  const total = data.reduce((sum, d) => sum + d.value, 0);
  const chartData = data.filter((d) => d.value > 0);

  if (loading) return <ChartEmpty message="Loading…" />;
  if (!total) return <ChartEmpty message="SCM queue is empty" />;

  return (
    <div className="flex items-center gap-3">
      <div
        className="relative shrink-0"
        style={{ width: DONUT_H, height: DONUT_H }}
        role="img"
        aria-label="SCM queue OVF status mix"
      >
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="name"
              innerRadius={DONUT_INNER}
              outerRadius={DONUT_OUTER}
              paddingAngle={3}
              strokeWidth={0}
            >
              {chartData.map((d) => (
                <Cell key={d.key} fill={d.color} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <p className="font-mono text-base font-medium tabular-nums text-foreground">{total}</p>
          <p className="text-[9px] tracking-wide text-muted-foreground uppercase">OVFs</p>
        </div>
      </div>
      <ul className="min-w-0 flex-1 space-y-1 text-[11px]">
        {SCM_STATUS_KEYS.map((key) => {
          const count = counts[key];
          if (!count) return null;
          return (
            <li key={key} className="flex items-center justify-between gap-2 text-muted-foreground">
              <span className="flex min-w-0 items-center gap-1.5">
                <span
                  className="size-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: SCM_STATUS_COLORS[key] }}
                />
                <span className="truncate">{SCM_STATUS_LABELS[key]}</span>
              </span>
              <span className="flex shrink-0 items-center gap-1.5">
                <span className="font-mono tabular-nums text-foreground">{count}</span>
                <Link
                  href={`/procurement/scm?filter=${SCM_STATUS_FILTERS[key]}`}
                  className="inline-flex cursor-pointer items-center text-muted-foreground transition-colors duration-200 hover:text-foreground"
                  aria-label={`Open ${SCM_STATUS_LABELS[key]} OVFs in SCM queue`}
                >
                  <ExternalLink className="size-3 shrink-0 opacity-70" aria-hidden />
                </Link>
              </span>
            </li>
          );
        })}
        <li
          className="flex items-center justify-between gap-2 border-t border-border/60 pt-1 text-muted-foreground"
        >
          <span className="flex min-w-0 items-center gap-1.5">
            <span
              className="size-1.5 shrink-0 rounded-full"
              style={{ backgroundColor: PROC_CHART_COLORS.slate }}
            />
            <span className="truncate font-medium text-foreground">Total</span>
          </span>
          <span className="flex shrink-0 items-center gap-1.5">
            <span className="font-mono tabular-nums text-foreground">{total}</span>
            <Link
              href="/procurement/scm"
              className="inline-flex cursor-pointer items-center text-muted-foreground transition-colors duration-200 hover:text-foreground"
              aria-label="Open all OVFs in SCM queue"
            >
              <ExternalLink className="size-3 shrink-0 opacity-70" aria-hidden />
            </Link>
          </span>
        </li>
      </ul>
    </div>
  );
}

export function ProcurementDashboardCharts({
  loading,
  poBucketCounts,
  scmOpen,
  scmClose,
  scmHold,
}: {
  loading?: boolean;
  poBucketCounts: PoBucketCounts;
  scmOpen: number;
  scmClose: number;
  scmHold: number;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <ProcurementChartSection
        title="PO lifecycle"
        icon={PieChartIcon}
        badge={
          <Badge variant="secondary" className="text-[10px]">
            Share
          </Badge>
        }
      >
        <PoLifecycleDonut counts={poBucketCounts} loading={loading} />
      </ProcurementChartSection>

      <ProcurementChartSection
        title="OVF status"
        icon={PieChartIcon}
        badge={
          <Badge variant="secondary" className="text-[10px]">
            Status
          </Badge>
        }
      >
        <ScmQueueDonut open={scmOpen} close={scmClose} hold={scmHold} loading={loading} />
      </ProcurementChartSection>
    </div>
  );
}
