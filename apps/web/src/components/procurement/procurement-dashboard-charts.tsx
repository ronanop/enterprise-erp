"use client";

import { useRouter } from "next/navigation";
import { PieChart as PieChartIcon, type LucideIcon } from "lucide-react";

import {
  Exploded3dPieChart,
  type Exploded3dPieSlice,
} from "@/components/procurement/exploded-3d-pie";
import { cn } from "@/lib/utils";
import {
  PO_OVERVIEW_BUCKET_LABELS,
  type PoBucketCounts,
  type PoOverviewBucket,
} from "@/utils/procurement-po-buckets";

/** ERP palette — navy/sky/teal/amber (no purple). */
const PROC_CHART_COLORS = {
  sky: "#0369A1",
  teal: "#0F766E",
  emerald: "#047857",
  slate: "#475569",
  amber: "#B45309",
  orange: "#C2410C",
  gold: "#A16207",
} as const;

const PO_BUCKET_COLORS: Record<PoOverviewBucket, string> = {
  open: PROC_CHART_COLORS.sky,
  partial: PROC_CHART_COLORS.orange,
  close: PROC_CHART_COLORS.teal,
  draft: PROC_CHART_COLORS.gold,
};

const PO_BUCKET_HREFS: Record<PoOverviewBucket, string> = {
  draft: "/procurement/orders?bucket=draft",
  open: "/procurement/orders?bucket=open",
  partial: "/procurement/orders?bucket=partial",
  close: "/procurement/orders?bucket=close",
};

function ProcurementChartSection({
  title,
  subtitle,
  icon: Icon,
  iconTone = "teal",
  children,
  className,
  headerAction,
  onClick,
}: {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  iconTone?: "sky" | "teal" | "amber" | "emerald";
  children: React.ReactNode;
  className?: string;
  headerAction?: React.ReactNode;
  onClick?: () => void;
}) {
  const iconToneClass =
    iconTone === "sky"
      ? "border-sky-200/80 bg-sky-100 text-sky-800"
      : iconTone === "amber"
        ? "border-amber-200/80 bg-amber-100 text-amber-800"
        : iconTone === "emerald"
          ? "border-emerald-200/80 bg-emerald-100 text-emerald-800"
          : "border-teal-200/80 bg-teal-100 text-teal-800";

  const panelToneClass =
    iconTone === "sky"
      ? "border-sky-200/80 bg-sky-50/70"
      : iconTone === "amber"
        ? "border-amber-200/80 bg-amber-50/70"
        : iconTone === "emerald"
          ? "border-emerald-200/80 bg-emerald-50/70"
          : "border-teal-200/80 bg-teal-50/70";

  return (
    <section
      role={onClick ? "link" : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label={onClick ? `${title} — open all purchase orders` : undefined}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      className={cn(
        "flex flex-col rounded-2xl border p-4 shadow-sm sm:p-5",
        panelToneClass,
        onClick &&
          "cursor-pointer transition-[box-shadow,transform] duration-200 hover:shadow-md motion-safe:hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        className,
      )}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          {Icon ? (
            <span
              className={cn(
                "inline-flex size-8 shrink-0 items-center justify-center rounded-xl border",
                iconToneClass,
              )}
              aria-hidden
            >
              <Icon className="size-3.5" />
            </span>
          ) : null}
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold tracking-tight text-foreground">
              {title}
            </h2>
            {subtitle ? (
              <p className="truncate text-[11px] font-normal text-muted-foreground">{subtitle}</p>
            ) : null}
          </div>
        </div>
        {headerAction ? <div className="shrink-0">{headerAction}</div> : null}
      </div>
      <div className="flex flex-1 flex-col justify-center">{children}</div>
    </section>
  );
}

function ChartEmpty({ message }: { message: string }) {
  return (
    <div className="flex min-h-[10rem] items-center justify-center text-xs text-muted-foreground">
      {message}
    </div>
  );
}

function PoLifecycleDonut({
  counts,
  loading,
  compact,
}: {
  counts: PoBucketCounts;
  loading?: boolean;
  compact?: boolean;
}) {
  // Lifecycle stages only — draft is not part of the open→partial→close mix.
  const lifecycleBuckets: PoOverviewBucket[] = ["open", "partial", "close"];
  const slices: Exploded3dPieSlice[] = lifecycleBuckets
    .map((key) => ({
      key,
      label: PO_OVERVIEW_BUCKET_LABELS[key],
      value: counts[key],
      color: PO_BUCKET_COLORS[key],
      href: PO_BUCKET_HREFS[key],
    }))
    .filter((s) => s.value > 0);
  const total = slices.reduce((sum, d) => sum + d.value, 0);

  if (loading) return <ChartEmpty message="Loading…" />;
  if (!total) return <ChartEmpty message="No purchase orders yet" />;

  return (
    <div className="rounded-xl border border-border/50 bg-gradient-to-b from-slate-50/90 to-white px-2.5 py-3">
      <Exploded3dPieChart
        slices={slices}
        ariaLabel="Purchase order lifecycle mix"
        size={compact ? 148 : 176}
        layout="horizontal"
        legendMode="count"
      />
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
  open: "Open OVF",
  close: "Close OVF",
  hold: "Hold OVF",
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
  const slices: Exploded3dPieSlice[] = SCM_STATUS_KEYS.map((key) => ({
    key,
    label: SCM_STATUS_LABELS[key],
    value: counts[key],
    color: SCM_STATUS_COLORS[key],
  }));
  const total = slices.reduce((sum, d) => sum + d.value, 0);

  if (loading) return <ChartEmpty message="Loading…" />;
  if (!total) return <ChartEmpty message="SCM queue is empty" />;

  return (
    <Exploded3dPieChart
      slices={slices}
      ariaLabel="SCM queue OVF status mix"
      size={176}
    />
  );
}

export function PoLifecycleChartCard({
  counts,
  loading,
  className,
  compact,
}: {
  counts: PoBucketCounts;
  loading?: boolean;
  className?: string;
  compact?: boolean;
}) {
  const router = useRouter();
  return (
    <ProcurementChartSection
      title="PO LIFECYCLE"
      icon={PieChartIcon}
      iconTone="teal"
      className={className}
      onClick={() => router.push("/procurement/orders")}
    >
      <PoLifecycleDonut counts={counts} loading={loading} compact={compact} />
    </ProcurementChartSection>
  );
}

export function OvfStatusChartCard({
  open,
  close,
  hold,
  loading,
  className,
}: {
  open: number;
  close: number;
  hold: number;
  loading?: boolean;
  className?: string;
}) {
  return (
    <ProcurementChartSection title="OVF status" icon={PieChartIcon} iconTone="amber" className={className}>
      <ScmQueueDonut open={open} close={close} hold={hold} loading={loading} />
    </ProcurementChartSection>
  );
}

export function ProcurementDashboardCharts({
  loading,
  scmOpen,
  scmClose,
  scmHold,
}: {
  loading?: boolean;
  scmOpen: number;
  scmClose: number;
  scmHold: number;
}) {
  return (
    <OvfStatusChartCard open={scmOpen} close={scmClose} hold={scmHold} loading={loading} />
  );
}
