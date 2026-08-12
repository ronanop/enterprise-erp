"use client";

import { useId, useMemo, useState, type ComponentType } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BarChart3,
  Boxes,
  ClipboardList,
  PackageOpen,
  ShoppingCart,
} from "lucide-react";
import {
  Area,
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { cn } from "@/lib/utils";
import {
  PO_OVERVIEW_BUCKET_LABELS,
  type PoBucketCounts,
} from "@/utils/procurement-po-buckets";
import { PoLifecycleChartCard } from "@/components/procurement/procurement-dashboard-charts";

type Tint = "amber" | "sky" | "orange" | "emerald";

type SummaryCard = {
  label: string;
  value: string;
  href: string;
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  tint: Tint;
};

type HistRow = {
  key: string;
  name: string;
  count: number;
  href: string;
};

const BAR_ACTIVE = "#94A3B8";
const BAR_IDLE = "#0F172A";
const GRID = "#E2E8F0";
const GRID_LINE = "#CBD5E1";
const TREND_LINE = "#38BDF8";
const TREND_FILL = "#7DD3FC";

const HIST_BAR_COLORS: Record<string, { base: string; active: string }> = {
  ovf: { base: "#FBBF24", active: "#F59E0B" },
  open: { base: "#38BDF8", active: "#0284C7" },
  partial: { base: "#FB923C", active: "#EA580C" },
  close: { base: "#2DD4BF", active: "#0F766E" },
};

function ChartCardHeader({
  title,
  icon: Icon,
}: {
  title: string;
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
}) {
  return (
    <div className="mb-3 flex items-start justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-muted/40 text-foreground">
          <Icon className="size-3.5" aria-hidden />
        </span>
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold tracking-tight text-foreground">{title}</h2>
        </div>
      </div>
    </div>
  );
}

const TINT: Record<Tint, { card: string; icon: string }> = {
  amber: {
    card: "border-amber-200/80 bg-amber-50/80",
    icon: "bg-amber-100 text-amber-800",
  },
  sky: {
    card: "border-sky-200/80 bg-sky-50/80",
    icon: "bg-sky-100 text-sky-800",
  },
  orange: {
    card: "border-orange-200/80 bg-orange-50/70",
    icon: "bg-orange-100 text-orange-800",
  },
  emerald: {
    card: "border-emerald-200/80 bg-emerald-50/80",
    icon: "bg-emerald-100 text-emerald-800",
  },
};

function KpiCard({
  label,
  value,
  href,
  icon: Icon,
  tint,
  loading,
}: SummaryCard & { loading?: boolean }) {
  const styles = TINT[tint];
  return (
    <Link
      href={href}
      className={cn(
        "group flex min-h-[5.25rem] cursor-pointer flex-col rounded-[1.25rem] border p-3.5 text-foreground shadow-sm transition-[box-shadow,transform,opacity] duration-200",
        "hover:shadow-md motion-safe:hover:-translate-y-0.5",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        styles.card,
      )}
    >
      <div className="flex items-center gap-2.5">
        <p className="min-w-0 flex-1 truncate text-[13px] font-semibold tracking-tight text-foreground">
          {label}
        </p>
        <span
          className={cn(
            "inline-flex size-7 shrink-0 items-center justify-center rounded-lg",
            styles.icon,
          )}
        >
          <Icon className="size-3.5" aria-hidden />
        </span>
      </div>
      <p className="mt-2.5 text-[1.55rem] font-light leading-none tracking-tight text-foreground/85 tabular-nums">
        {loading ? "—" : value}
      </p>
    </Link>
  );
}

function ChartTooltip({
  active,
  payload,
  total,
}: {
  active?: boolean;
  payload?: Array<{ value?: number; payload?: HistRow }>;
  total: number;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;
  const pct = total > 0 ? (row.count / total) * 100 : 0;
  return (
    <div className="rounded-lg border border-border/80 bg-card px-2.5 py-1.5 text-xs shadow-md">
      <p className="font-semibold text-foreground">{row.name}</p>
      <p className="mt-0.5 tabular-nums text-muted-foreground">
        {row.count.toLocaleString("en-IN")}
        <span className="ml-1.5 text-foreground/70">({pct.toFixed(1)}%)</span>
      </p>
    </div>
  );
}

function OverviewHistogram({
  data,
  loading,
}: {
  data: HistRow[];
  loading?: boolean;
}) {
  const router = useRouter();
  const trendFillId = useId().replace(/:/g, "");
  const maxKey = useMemo(() => {
    let best = data[0]?.key ?? "";
    let max = -1;
    for (const row of data) {
      if (row.count > max) {
        max = row.count;
        best = row.key;
      }
    }
    return best;
  }, [data]);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const highlight = activeKey ?? maxKey;
  const total = data.reduce((sum, row) => sum + row.count, 0);

  return (
    <section className="flex h-full flex-col rounded-[1.35rem] border border-border/70 bg-card p-4 shadow-sm sm:p-5">
      <ChartCardHeader title="Procurement volume" icon={BarChart3} />

      {loading ? (
        <div className="flex flex-1 items-center justify-center rounded-xl bg-muted/25 py-16 text-sm text-muted-foreground">
          Loading chart…
        </div>
      ) : total <= 0 ? (
        <div className="flex flex-1 items-center justify-center rounded-xl bg-muted/25 py-16 text-sm text-muted-foreground">
          No volume data yet
        </div>
      ) : (
        <div
          className="min-h-[220px] flex-1 rounded-xl border border-border/50 bg-gradient-to-b from-slate-50/90 to-white px-1 py-2"
          role="img"
          aria-label="Procurement volume histogram"
        >
          <ResponsiveContainer width="100%" height={220}>
            <ComposedChart
              data={data}
              margin={{ top: 16, right: 12, left: 0, bottom: 4 }}
              onMouseLeave={() => setActiveKey(null)}
            >
              <defs>
                <linearGradient id={trendFillId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={TREND_FILL} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={TREND_FILL} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="4 4"
                stroke={GRID_LINE}
                strokeWidth={1}
                vertical={false}
              />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 10, fill: "#64748B", fontWeight: 500 }}
                tickLine={false}
                axisLine={{ stroke: GRID }}
                interval={0}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 10, fill: "#94A3B8" }}
                tickLine={false}
                axisLine={false}
                width={28}
              />
              <Tooltip
                content={<ChartTooltip total={total} />}
                cursor={{ fill: "rgba(15, 23, 42, 0.05)", radius: 6 }}
              />
              <Bar
                dataKey="count"
                radius={[6, 6, 0, 0]}
                maxBarSize={40}
                onMouseEnter={(_, index) => {
                  const row = data[index];
                  if (row) setActiveKey(row.key);
                }}
                onClick={(_, index) => {
                  const row = data[index];
                  if (row?.href) router.push(row.href);
                }}
                className="cursor-pointer"
              >
                {data.map((row) => {
                  const colors = HIST_BAR_COLORS[row.key] ?? {
                    base: BAR_IDLE,
                    active: BAR_ACTIVE,
                  };
                  return (
                    <Cell
                      key={row.key}
                      fill={row.key === highlight ? colors.active : colors.base}
                      opacity={row.key === highlight ? 1 : 0.88}
                    />
                  );
                })}
              </Bar>
              <Area
                type="monotone"
                dataKey="count"
                stroke="none"
                fill={`url(#${trendFillId})`}
                legendType="none"
                isAnimationActive={false}
                tooltipType="none"
              />
              <Line
                type="monotone"
                dataKey="count"
                stroke={TREND_LINE}
                strokeWidth={2}
                dot={{
                  r: 3.5,
                  fill: "#fff",
                  stroke: TREND_LINE,
                  strokeWidth: 2,
                }}
                activeDot={{
                  r: 5,
                  fill: "#fff",
                  stroke: TREND_LINE,
                  strokeWidth: 2.5,
                }}
                legendType="none"
                tooltipType="none"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}

export function ProcurementDashboardSummary({
  loading,
  openOvfCount,
  openPoCount,
  partialPoCount,
  stockUnits,
  poBucketCounts,
}: {
  loading?: boolean;
  openOvfCount: number;
  openPoCount: number;
  partialPoCount: number;
  stockUnits: number;
  poBucketCounts: PoBucketCounts;
}) {
  const cards: SummaryCard[] = [
    {
      label: "Open OVF",
      value: openOvfCount.toLocaleString("en-IN"),
      href: "/procurement/scm?filter=open",
      icon: ClipboardList,
      tint: "amber",
    },
    {
      label: "Open PO",
      value: openPoCount.toLocaleString("en-IN"),
      href: "/procurement/orders/overview?bucket=open",
      icon: ShoppingCart,
      tint: "sky",
    },
    {
      label: "Partial PO",
      value: partialPoCount.toLocaleString("en-IN"),
      href: "/procurement/orders/overview?bucket=partial",
      icon: PackageOpen,
      tint: "orange",
    },
    {
      label: "Total stock",
      value: stockUnits.toLocaleString("en-IN"),
      href: "/procurement/inventory",
      icon: Boxes,
      tint: "emerald",
    },
  ];

  const histogram: HistRow[] = [
    {
      key: "ovf",
      name: "Open OVF",
      count: openOvfCount,
      href: "/procurement/scm?filter=open",
    },
    {
      key: "open",
      name: PO_OVERVIEW_BUCKET_LABELS.open,
      count: poBucketCounts.open,
      href: "/procurement/orders/overview?bucket=open",
    },
    {
      key: "partial",
      name: PO_OVERVIEW_BUCKET_LABELS.partial,
      count: poBucketCounts.partial,
      href: "/procurement/orders/overview?bucket=partial",
    },
    {
      key: "close",
      name: PO_OVERVIEW_BUCKET_LABELS.close,
      count: poBucketCounts.close,
      href: "/procurement/orders/overview?bucket=close",
    },
  ];

  return (
    <div className="space-y-4">
      <section
        aria-label="Procurement overview"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 xl:gap-5"
      >
        {cards.map((card) => (
          <KpiCard key={card.label} {...card} loading={loading} />
        ))}
      </section>
      <div className="grid items-stretch gap-4 lg:grid-cols-[68fr_32fr] lg:gap-5">
        <OverviewHistogram data={histogram} loading={loading} />
        <PoLifecycleChartCard
          counts={poBucketCounts}
          loading={loading}
          compact
          className="h-full rounded-[1.35rem]"
        />
      </div>
    </div>
  );
}
