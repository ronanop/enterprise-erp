"use client";

import { useId, useMemo, useState, type ComponentType } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BarChart3,
  Boxes,
  ClipboardList,
  IndianRupee,
  PackageCheck,
  PackageOpen,
  ShoppingCart,
  Warehouse,
} from "lucide-react";
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Exploded3dPieChart, type Exploded3dPieSlice } from "@/components/procurement/exploded-3d-pie";
import { PoLifecycleChartCard } from "@/components/procurement/procurement-dashboard-charts";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatInr } from "@/services/procurement-service";
import type { ProcurementInventoryStockSummary } from "@/utils/procurement-inventory-report";
import {
  PO_OVERVIEW_BUCKET_LABELS,
  type PoBucketCounts,
} from "@/utils/procurement-po-buckets";

type Tint = "amber" | "sky" | "teal" | "emerald" | "orange";

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
  teal: {
    card: "border-teal-200/80 bg-teal-50/70",
    icon: "bg-teal-100 text-teal-800",
  },
  emerald: {
    card: "border-emerald-200/80 bg-emerald-50/80",
    icon: "bg-emerald-100 text-emerald-800",
  },
  orange: {
    card: "border-orange-200/80 bg-orange-50/80",
    icon: "bg-orange-100 text-orange-800",
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
        <p className="min-w-0 flex-1 truncate text-[13px] font-semibold uppercase tracking-wide text-foreground">
          {label}
        </p>
        <span
          className={cn(
            "inline-flex size-10 shrink-0 items-center justify-center rounded-xl",
            styles.icon,
          )}
        >
          <Icon className="size-5" aria-hidden />
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

/** Inventory chart accents — MASTER navy/sky + stock teal (no purple). */
const STOCK_BAR_TOP = "#0369A1";
const STOCK_BAR_REST = ["#0EA5E9", "#0D9488", "#14B8A6", "#64748B", "#94A3B8"];
const OEM_PIE_COLORS = [
  "#0369A1",
  "#0D9488",
  "#0284C7",
  "#0F766E",
  "#475569",
  "#38BDF8",
  "#2DD4BF",
];

type InventoryStatTint = "sky" | "teal" | "cyan";

const INVENTORY_STAT_TINT: Record<
  InventoryStatTint,
  { card: string; icon: string; value: string }
> = {
  sky: {
    card: "border-sky-200/80 bg-gradient-to-br from-sky-50 via-sky-50/70 to-white",
    icon: "bg-sky-100 text-sky-800",
    value: "text-sky-950",
  },
  teal: {
    card: "border-teal-200/80 bg-gradient-to-br from-teal-50 via-teal-50/70 to-white",
    icon: "bg-teal-100 text-teal-800",
    value: "text-teal-950",
  },
  cyan: {
    card: "border-cyan-200/80 bg-gradient-to-br from-cyan-50 via-cyan-50/70 to-white",
    icon: "bg-cyan-100 text-cyan-800",
    value: "text-cyan-950",
  },
};

function InventoryStockPanel({
  summary,
  loading,
}: {
  summary: ProcurementInventoryStockSummary | null;
  loading?: boolean;
}) {
  const topProducts = useMemo(() => {
    const rows = [...(summary?.byProduct ?? [])].sort(
      (a, b) =>
        b.units - a.units ||
        b.stockValue - a.stockValue ||
        a.productName.localeCompare(b.productName),
    );
    return rows.slice(0, 6).map((row) => ({
      name:
        row.productName.length > 22
          ? `${row.productName.slice(0, 20)}…`
          : row.productName,
      fullName: row.productName,
      units: row.units,
      stockValue: row.stockValue,
      avgUnitCost: row.avgUnitCost,
    }));
  }, [summary]);

  const oemSlices = useMemo((): Exploded3dPieSlice[] => {
    const rows = summary?.byVendor ?? [];
    const top = rows.slice(0, 5);
    const rest = rows.slice(5);
    const slices: Exploded3dPieSlice[] = top.map((row, index) => ({
      key: row.vendorId || `oem-${index}`,
      label: row.vendorLabel,
      value: Math.max(row.stockValue, row.units),
      color: OEM_PIE_COLORS[index % OEM_PIE_COLORS.length],
    }));
    if (rest.length > 0) {
      const otherValue = rest.reduce(
        (sum, row) => sum + Math.max(row.stockValue, row.units),
        0,
      );
      if (otherValue > 0) {
        slices.push({
          key: "other-oems",
          label: "Other OEMs",
          value: otherValue,
          color: OEM_PIE_COLORS[OEM_PIE_COLORS.length - 1],
        });
      }
    }
    return slices.filter((s) => s.value > 0);
  }, [summary]);

  const totalUnits = summary?.totalUnits ?? 0;
  const totalStockValue = summary?.totalStockValue ?? 0;
  const oemCount = summary?.byVendor.length ?? 0;

  return (
    <section
      aria-label="Inventory stock"
      className="rounded-[1.35rem] border border-sky-200/60 bg-gradient-to-br from-sky-50/80 via-card to-teal-50/40 p-4 shadow-sm sm:p-5"
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl border border-sky-200/80 bg-sky-100 text-sky-800">
            <Warehouse className="size-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold tracking-tight text-foreground">
              Inventory Value
            </h2>
          </div>
        </div>
        <Link
          href="/procurement/inventory"
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "h-8 cursor-pointer rounded-lg border-sky-200/80 bg-white/80 text-sky-900 transition-colors duration-200 hover:bg-sky-50",
          )}
        >
          Open inventory
        </Link>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2.5 xl:grid-cols-3">
        <InventoryStat
          label="Stock value"
          value={loading ? "—" : formatInr(totalStockValue)}
          icon={IndianRupee}
          tint="sky"
        />
        <InventoryStat
          label="Stock units"
          value={loading ? "—" : totalUnits.toLocaleString("en-IN")}
          icon={Boxes}
          tint="teal"
        />
        <InventoryStat
          label="OEM coverage"
          value={loading ? "—" : oemCount.toLocaleString("en-IN")}
          icon={PackageCheck}
          tint="cyan"
        />
      </div>

      <div className="grid items-stretch gap-4 lg:grid-cols-[58fr_42fr] lg:gap-5">
        <div className="rounded-xl border border-sky-200/70 bg-gradient-to-b from-white via-sky-50/40 to-white px-2 py-3 shadow-sm">
          <div className="mb-1 flex items-center justify-between gap-2 px-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-sky-800/80">
              Top products by units
            </p>
            <p className="text-[11px] tabular-nums font-medium text-sky-900/70">
              {loading ? "—" : `${totalUnits.toLocaleString("en-IN")} units`}
            </p>
          </div>
          {loading ? (
            <div className="flex h-[210px] items-center justify-center text-sm text-muted-foreground">
              Loading stock…
            </div>
          ) : topProducts.length === 0 ? (
            <div className="flex h-[210px] items-center justify-center text-sm text-muted-foreground">
              No stock units on hand
            </div>
          ) : (
            <div
              className="h-[210px] w-full"
              role="img"
              aria-label="Top products by inventory units"
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={topProducts}
                  layout="vertical"
                  margin={{ top: 4, right: 36, left: 4, bottom: 4 }}
                >
                  <CartesianGrid
                    strokeDasharray="4 4"
                    stroke="#BAE6FD"
                    strokeWidth={1}
                    horizontal={false}
                  />
                  <XAxis
                    type="number"
                    allowDecimals={false}
                    tick={{ fontSize: 10, fill: "#64748B" }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value: number) => value.toLocaleString("en-IN")}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={108}
                    tick={{ fontSize: 11, fill: "#334155", fontWeight: 500 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: "rgba(3, 105, 161, 0.06)" }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const row = payload[0]?.payload as
                        | (typeof topProducts)[number]
                        | undefined;
                      if (!row) return null;
                      return (
                        <div className="rounded-lg border border-sky-200/80 bg-card px-3 py-2 text-xs shadow-md">
                          <p className="font-medium text-foreground">{row.fullName}</p>
                          <p className="mt-1 tabular-nums text-sky-800">
                            {row.units.toLocaleString("en-IN")} inventory unit
                            {row.units === 1 ? "" : "s"}
                          </p>
                          {row.stockValue > 0 ? (
                            <p className="tabular-nums text-muted-foreground">
                              Value {formatInr(row.stockValue)}
                              {row.avgUnitCost > 0
                                ? ` · avg ${formatInr(row.avgUnitCost)}`
                                : ""}
                            </p>
                          ) : null}
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="units" radius={[0, 6, 6, 0]} maxBarSize={18}>
                    {topProducts.map((row, index) => (
                      <Cell
                        key={row.fullName}
                        fill={
                          index === 0
                            ? STOCK_BAR_TOP
                            : STOCK_BAR_REST[(index - 1) % STOCK_BAR_REST.length]
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-teal-200/70 bg-gradient-to-b from-white via-teal-50/35 to-white px-3 py-3 shadow-sm">
          <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-teal-800/80">
            OEM coverage
          </p>
          {loading ? (
            <div className="flex min-h-[210px] items-center justify-center text-sm text-muted-foreground">
              Loading OEMs…
            </div>
          ) : oemSlices.length === 0 ? (
            <div className="flex min-h-[210px] items-center justify-center text-sm text-muted-foreground">
              No OEM stock mix yet
            </div>
          ) : (
            <Exploded3dPieChart
              slices={oemSlices}
              ariaLabel="OEM coverage by stock value"
              size={128}
              layout="compact"
            />
          )}
        </div>
      </div>
    </section>
  );
}

function InventoryStat({
  label,
  value,
  hint,
  icon: Icon,
  tint,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  tint: InventoryStatTint;
}) {
  const styles = INVENTORY_STAT_TINT[tint];
  return (
    <div
      className={cn(
        "flex min-h-[5rem] items-start gap-2.5 rounded-xl border px-3.5 py-3.5 shadow-sm transition-[box-shadow] duration-200",
        styles.card,
      )}
    >
      <span
        className={cn(
          "mt-0.5 inline-flex size-10 shrink-0 items-center justify-center rounded-xl",
          styles.icon,
        )}
      >
        <Icon className="size-5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-bold uppercase tracking-wide text-foreground">
          {label}
        </p>
        <p
          className={cn(
            "mt-1 text-lg font-medium tabular-nums tracking-tight sm:text-xl",
            styles.value,
          )}
        >
          {value}
        </p>
        {hint ? <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p> : null}
      </div>
    </div>
  );
}

export function ProcurementDashboardSummary({
  loading,
  openOvfCount,
  holdOvfCount,
  openPoCount,
  poBucketCounts,
  inventorySummary,
}: {
  loading?: boolean;
  openOvfCount: number;
  holdOvfCount: number;
  openPoCount: number;
  poBucketCounts: PoBucketCounts;
  inventorySummary?: ProcurementInventoryStockSummary | null;
}) {
  const openOvfIncludingHold = openOvfCount + holdOvfCount;
  const cards: SummaryCard[] = [
    {
      label: "OPEN OVF",
      value: openOvfIncludingHold.toLocaleString("en-IN"),
      href: "/procurement/scm?filter=open",
      icon: ClipboardList,
      tint: "amber",
    },
    {
      label: "OPEN PO",
      value: openPoCount.toLocaleString("en-IN"),
      href: "/procurement/orders?bucket=open",
      icon: ShoppingCart,
      tint: "sky",
    },
    {
      label: "PARTIAL PO",
      value: poBucketCounts.partial.toLocaleString("en-IN"),
      href: "/procurement/orders?bucket=partial",
      icon: PackageOpen,
      tint: "orange",
    },
    {
      label: "CLOSED PO",
      value: poBucketCounts.close.toLocaleString("en-IN"),
      href: "/procurement/orders?bucket=close",
      icon: PackageCheck,
      tint: "teal",
    },
  ];

  const histogram: HistRow[] = [
    {
      key: "ovf",
      name: "Open OVF",
      count: openOvfIncludingHold,
      href: "/procurement/scm?filter=open",
    },
    {
      key: "open",
      name: PO_OVERVIEW_BUCKET_LABELS.open,
      count: poBucketCounts.open,
      href: "/procurement/orders?bucket=open",
    },
    {
      key: "partial",
      name: PO_OVERVIEW_BUCKET_LABELS.partial,
      count: poBucketCounts.partial,
      href: "/procurement/orders?bucket=partial",
    },
    {
      key: "close",
      name: PO_OVERVIEW_BUCKET_LABELS.close,
      count: poBucketCounts.close,
      href: "/procurement/orders?bucket=close",
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

      <InventoryStockPanel summary={inventorySummary ?? null} loading={loading} />

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
