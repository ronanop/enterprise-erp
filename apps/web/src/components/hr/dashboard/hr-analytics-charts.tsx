"use client";

import { useId, useMemo, type ReactNode, createContext, useContext } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { cn } from "@/lib/utils";
import type { NamedCount } from "@/types/hr-executive-dashboard";

/** Premium chart palette — purple, teal, green, orange, blue, pink. */
export const HR_CHART_COLORS = [
  "#9B5BB8",
  "#00BBAA",
  "#01BD7E",
  "#FF8904",
  "#155DFD",
  "#FF2057",
] as const;

const FUNNEL_COLORS = ["#9B5BB8", "#00BBAA", "#01BD7E", "#FF8904", "#155DFD"];

type FormatFn = (n: number) => string;

function defaultFormat(n: number): string {
  return n.toLocaleString("en-IN");
}

export const ChartHeightContext = createContext<number | null>(null);

function useChartHeight(fallback: number): number {
  const ctx = useContext(ChartHeightContext);
  return ctx != null && ctx > 0 ? ctx : fallback;
}

function ChartShell({
  title,
  subtitle,
  children,
  className,
  legend,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
  legend?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "group relative flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-sm",
        "transition-[box-shadow,border-color] duration-200 hover:border-primary/30 hover:shadow-md",
        className,
      )}
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px overflow-hidden bg-gradient-to-r from-transparent via-primary/40 to-transparent"
        aria-hidden
      />
      <div className="mb-3 flex shrink-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold tracking-tight text-foreground">{title}</h3>
          {subtitle ? (
            <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{subtitle}</p>
          ) : null}
        </div>
        {legend}
      </div>
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}

function EmptyChart({ height = 220 }: { height?: number }) {
  return (
    <div
      className="flex h-full min-h-[120px] items-center justify-center text-xs text-muted-foreground"
      style={height ? { minHeight: Math.min(height, 180) } : undefined}
    >
      No data available
    </div>
  );
}

function truncateLabel(value: string, max = 14): string {
  const s = String(value ?? "");
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

function ChartTooltip({
  active,
  payload,
  label,
  formatValue = defaultFormat,
}: {
  active?: boolean;
  payload?: Array<{ value?: number; name?: string; color?: string }>;
  label?: string;
  formatValue?: FormatFn;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border/80 bg-card/95 px-3 py-2 text-xs shadow-lg backdrop-blur-sm">
      {label ? <p className="mb-1 font-medium text-foreground">{label}</p> : null}
      {payload.map((p, i) => (
        <p key={`${p.name}-${i}`} className="flex items-center gap-2 text-muted-foreground">
          <span
            className="size-2 rounded-full"
            style={{ background: p.color ?? HR_CHART_COLORS[i % HR_CHART_COLORS.length] }}
          />
          <span>{p.name ?? "Value"}</span>
          <span className="ml-auto font-mono tabular-nums text-foreground">
            {formatValue(Number(p.value ?? 0))}
          </span>
        </p>
      ))}
    </div>
  );
}

export function PremiumAreaChart({
  title,
  subtitle,
  data,
  formatValue,
  color = HR_CHART_COLORS[0],
}: {
  title: string;
  subtitle?: string;
  data: NamedCount[];
  formatValue?: FormatFn;
  color?: string;
}) {
  const gradId = useId().replace(/:/g, "");
  const chartH = useChartHeight(220);
  const rows = useMemo(() => data.map((d) => ({ name: d.label, value: d.value })), [data]);
  if (!rows.length) {
    return (
      <ChartShell title={title} subtitle={subtitle}>
        <EmptyChart height={chartH} />
      </ChartShell>
    );
  }
  return (
    <ChartShell title={title} subtitle={subtitle}>
      <div className="h-full w-full min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={rows} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
            <defs>
              <linearGradient id={`area-${gradId}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.35} />
                <stop offset="100%" stopColor={color} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              axisLine={false}
              tickLine={false}
              width={40}
              tickFormatter={(v) => formatValue?.(Number(v)) ?? String(v)}
            />
            <Tooltip content={<ChartTooltip formatValue={formatValue} />} />
            <Area
              type="monotone"
              dataKey="value"
              name="Value"
              stroke={color}
              strokeWidth={2.25}
              fill={`url(#area-${gradId})`}
              activeDot={{ r: 4, strokeWidth: 0 }}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </ChartShell>
  );
}

export function PremiumBarChart({
  title,
  subtitle,
  data,
  formatValue,
  layout = "vertical",
  showValues = false,
}: {
  title: string;
  subtitle?: string;
  data: NamedCount[];
  formatValue?: FormatFn;
  layout?: "vertical" | "horizontal";
  /** Draw count labels on each bar (good for location / head-count). */
  showValues?: boolean;
}) {
  const fmt = formatValue ?? defaultFormat;
  const rows = useMemo(() => data.map((d) => ({ name: d.label, value: d.value })), [data]);
  const horizontal = layout === "horizontal";
  const autoH = Math.max(220, horizontal ? 48 + Math.max(rows.length, 1) * 36 : 220);
  const chartHeight = useChartHeight(autoH);
  if (!rows.length) {
    return (
      <ChartShell title={title} subtitle={subtitle}>
        <EmptyChart height={chartHeight} />
      </ChartShell>
    );
  }

  const total = rows.reduce((s, r) => s + r.value, 0);

  return (
    <ChartShell
      title={title}
      subtitle={subtitle}
      legend={
        showValues ? (
          <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-[10px] tabular-nums text-muted-foreground">
            Total {fmt(total)}
          </span>
        ) : undefined
      }
    >
      <div className="h-full w-full min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={rows}
            layout={horizontal ? "vertical" : "horizontal"}
            margin={{
              top: 8,
              right: showValues ? 36 : 8,
              left: horizontal ? 8 : -12,
              bottom: 4,
            }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--border)"
              horizontal={!horizontal}
              vertical={horizontal}
            />
            {horizontal ? (
              <>
                <XAxis
                  type="number"
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => fmt(Number(v))}
                  allowDecimals={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={118}
                  tick={{ fontSize: 11, fill: "var(--foreground)", fontWeight: 500 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => truncateLabel(String(v), 15)}
                />
              </>
            ) : (
              <>
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  axisLine={false}
                  tickLine={false}
                  width={40}
                  tickFormatter={(v) => fmt(Number(v))}
                  allowDecimals={false}
                />
              </>
            )}
            <Tooltip content={<ChartTooltip formatValue={fmt} />} cursor={{ fill: "var(--muted)", opacity: 0.45 }} />
            <Bar
              dataKey="value"
              name="Employees"
              radius={horizontal ? [0, 6, 6, 0] : [6, 6, 0, 0]}
              maxBarSize={36}
              isAnimationActive={false}
            >
              {rows.map((_, i) => (
                <Cell key={rows[i].name} fill={HR_CHART_COLORS[i % HR_CHART_COLORS.length]} />
              ))}
              {showValues ? (
                <LabelList
                  dataKey="value"
                  position={horizontal ? "right" : "top"}
                  formatter={(v) => fmt(Number(v ?? 0))}
                  className="fill-foreground text-[11px] font-semibold tabular-nums"
                />
              ) : null}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartShell>
  );
}

export function PremiumDonutChart({
  title,
  subtitle,
  data,
  formatValue,
}: {
  title: string;
  subtitle?: string;
  data: NamedCount[];
  formatValue?: FormatFn;
}) {
  const chartH = useChartHeight(220);
  const rows = useMemo(
    () => data.filter((d) => d.value > 0).map((d) => ({ name: d.label, value: d.value })),
    [data],
  );
  const total = rows.reduce((s, r) => s + r.value, 0);

  if (!rows.length) {
    return (
      <ChartShell title={title} subtitle={subtitle}>
        <EmptyChart height={chartH} />
      </ChartShell>
    );
  }

  return (
    <ChartShell
      title={title}
      subtitle={subtitle}
      legend={
        <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-[10px] tabular-nums text-muted-foreground">
          n={total}
        </span>
      }
    >
      <div className="flex h-full min-h-0 flex-col gap-3 sm:grid sm:grid-cols-[1.15fr_0.85fr] sm:items-center sm:gap-3">
        <div className="relative min-h-[160px] w-full flex-1">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={rows}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius="55%"
                outerRadius="80%"
                paddingAngle={2}
                stroke="var(--card)"
                strokeWidth={2}
                isAnimationActive={false}
              >
                {rows.map((_, i) => (
                  <Cell key={rows[i].name} fill={HR_CHART_COLORS[i % HR_CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<ChartTooltip formatValue={formatValue} />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <p className="text-[10px] tracking-wide text-muted-foreground uppercase">Total</p>
            <p className="text-lg font-semibold tabular-nums text-foreground">
              {(formatValue ?? defaultFormat)(total)}
            </p>
          </div>
        </div>
        <ul className="shrink-0 space-y-1.5 sm:pr-1">
          {rows.map((r, i) => {
            const pct = total ? Math.round((r.value / total) * 100) : 0;
            return (
              <li key={r.name} className="flex items-center gap-2 text-xs">
                <span
                  className="size-2.5 shrink-0 rounded-sm"
                  style={{ background: HR_CHART_COLORS[i % HR_CHART_COLORS.length] }}
                />
                <span className="min-w-0 flex-1 truncate text-muted-foreground">{r.name}</span>
                <span className="font-mono tabular-nums text-foreground">{pct}%</span>
              </li>
            );
          })}
        </ul>
      </div>
    </ChartShell>
  );
}

export function PremiumFunnelChart({
  title = "Hiring Funnel",
  subtitle,
  data,
}: {
  title?: string;
  subtitle?: string;
  data: NamedCount[];
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const first = data[0]?.value || 0;

  if (!data.length) {
    return (
      <ChartShell title={title} subtitle={subtitle}>
        <EmptyChart />
      </ChartShell>
    );
  }

  return (
    <ChartShell title={title} subtitle={subtitle}>
      <div className="flex min-h-[220px] flex-col items-center justify-center gap-1.5 py-1">
        {data.map((d, i) => {
          // Keep a clear funnel taper while ensuring labels fit.
          const widthPct = Math.max(46, Math.round((d.value / max) * 100));
          const prev = i === 0 ? d.value : data[i - 1].value;
          const conv = prev > 0 ? Math.round((d.value / prev) * 100) : 0;
          const overall = first > 0 ? Math.round((d.value / first) * 100) : 0;
          const colorA = FUNNEL_COLORS[Math.min(i, FUNNEL_COLORS.length - 1)];
          const colorB = FUNNEL_COLORS[Math.min(i + 1, FUNNEL_COLORS.length - 1)];

          return (
            <div key={d.label} className="flex w-full flex-col items-center gap-1">
              <div
                className={cn(
                  "flex h-9 items-center justify-between gap-3 px-3.5 text-xs text-white shadow-sm",
                  "rounded-full transition-[transform,filter,width] duration-200",
                  "hover:brightness-105 motion-safe:hover:scale-[1.015]",
                )}
                style={{
                  width: `${widthPct}%`,
                  background: `linear-gradient(90deg, ${colorA} 0%, ${colorB} 100%)`,
                }}
                title={`${d.label}: ${d.value.toLocaleString("en-IN")} (${overall}% of applied)`}
              >
                <span className="truncate font-medium tracking-tight">
                  {i + 1}. {d.label}
                </span>
                <span className="shrink-0 font-mono text-[13px] font-semibold tabular-nums">
                  {d.value.toLocaleString("en-IN")}
                </span>
              </div>
              {i > 0 ? (
                <p className="text-center text-[10px] leading-tight text-muted-foreground">
                  Conversion {conv}% · of applied {overall}%
                </p>
              ) : (
                <p className="text-center text-[10px] leading-tight text-muted-foreground">
                  Top of funnel
                </p>
              )}
            </div>
          );
        })}
      </div>
    </ChartShell>
  );
}
