"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
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

/** Matches CRM / HR / ERP chart palette — no purple gradients. */
export const SERVICE_CHART_COLORS = {
  sky: "#0369A1",
  skyDark: "#0C4A6E",
  teal: "#0F766E",
  emerald: "#047857",
  slate: "#475569",
  amber: "#B45309",
  rose: "#BE123C",
  muted: "#94A3B8",
  track: "#E2E8F0",
  tick: "#64748B",
} as const;

const PALETTE = [
  SERVICE_CHART_COLORS.sky,
  SERVICE_CHART_COLORS.teal,
  SERVICE_CHART_COLORS.emerald,
  SERVICE_CHART_COLORS.amber,
  SERVICE_CHART_COLORS.skyDark,
  SERVICE_CHART_COLORS.slate,
  SERVICE_CHART_COLORS.rose,
] as const;

const MODE_COLORS: Record<string, string> = {
  "Remote Support": SERVICE_CHART_COLORS.sky,
  "Onsite Support": SERVICE_CHART_COLORS.teal,
  "OEM Support": SERVICE_CHART_COLORS.amber,
};

const SLA_COLORS: Record<string, string> = {
  "Currently breached": SERVICE_CHART_COLORS.rose,
  "Closed within SLA": SERVICE_CHART_COLORS.emerald,
  "Closed after breach": SERVICE_CHART_COLORS.amber,
};

export type ServiceChartLinkPoint = {
  name: string;
  href?: string;
};

type TooltipPayload = {
  name?: string;
  value?: number;
  color?: string;
  payload?: Record<string, unknown>;
};

function useChartNavigate() {
  const router = useRouter();
  return (entry: { href?: string } | null | undefined) => {
    if (entry?.href) router.push(entry.href);
  };
}

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
  const value = Number(row.value ?? row.payload?.count ?? 0);
  const color = row.color ?? (typeof row.payload?.fill === "string" ? row.payload.fill : undefined);
  return (
    <div className="rounded-lg border border-border/80 bg-card px-3 py-2 text-xs shadow-md">
      <div className="flex items-center gap-2">
        {color ? (
          <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
        ) : null}
        <p className="font-medium text-foreground">{label ?? row.name}</p>
      </div>
      <p className="mt-1 font-mono text-[11px] tabular-nums text-muted-foreground">
        {value.toLocaleString("en-IN")} tickets
      </p>
    </div>
  );
}

function ChartShell({
  loading,
  empty,
  emptyLabel,
  height = 248,
  children,
  ariaLabel,
}: {
  loading?: boolean;
  empty?: boolean;
  emptyLabel: string;
  height?: number;
  children: ReactNode;
  ariaLabel: string;
}) {
  if (loading) {
    return (
      <div
        className="flex items-center justify-center text-sm text-muted-foreground"
        style={{ height }}
      >
        Loading chart…
      </div>
    );
  }
  if (empty) {
    return (
      <div
        className="flex items-center justify-center rounded-lg border border-dashed border-border/60 bg-muted/20 text-sm text-muted-foreground"
        style={{ height }}
      >
        {emptyLabel}
      </div>
    );
  }
  return (
    <div className="w-full min-w-0" style={{ height }} role="img" aria-label={ariaLabel}>
      {children}
    </div>
  );
}

function ChartLegend({
  items,
  onSelect,
}: {
  items: { name: string; value: number; color: string; href?: string }[];
  onSelect?: (href?: string) => void;
}) {
  return (
    <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 border-t border-border/50 pt-3">
      {items.map((item) => (
        <li key={item.name}>
          <button
            type="button"
            disabled={!item.href}
            onClick={() => onSelect?.(item.href)}
            className="inline-flex max-w-full items-center gap-1.5 text-[11px] text-muted-foreground transition-colors hover:text-foreground disabled:cursor-default"
          >
            <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
            <span className="truncate">{item.name}</span>
            <span className="font-mono tabular-nums text-foreground">{item.value.toLocaleString("en-IN")}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

/** Horizontal bars — ticket lifecycle stages */
export function ServiceStatusBarChart({
  data,
  loading,
}: {
  data: (ServiceChartLinkPoint & { value: number })[];
  loading?: boolean;
}) {
  const navigate = useChartNavigate();
  const chartData = data.map((d, i) => ({
    name: d.name,
    count: d.value,
    href: d.href,
    fill: PALETTE[i % PALETTE.length],
  }));

  return (
    <ChartShell
      loading={loading}
      empty={!data.length}
      emptyLabel="No ticket status data"
      ariaLabel="Ticket status horizontal bar chart"
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 36, left: 4, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={SERVICE_CHART_COLORS.track} horizontal={false} />
          <XAxis
            type="number"
            allowDecimals={false}
            tick={{ fontSize: 10, fill: SERVICE_CHART_COLORS.tick }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={100}
            tick={{ fontSize: 11, fill: SERVICE_CHART_COLORS.tick }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(15, 23, 42, 0.04)" }} />
          <Bar
            dataKey="count"
            radius={[0, 8, 8, 0]}
            maxBarSize={26}
            style={{ cursor: "pointer" }}
            onClick={(entry) => navigate(entry as { href?: string })}
          >
            {chartData.map((entry) => (
              <Cell key={entry.name} fill={entry.fill} />
            ))}
            <LabelList
              dataKey="count"
              position="right"
              className="fill-muted-foreground"
              style={{ fontSize: 10, fontVariantNumeric: "tabular-nums" }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartShell>
  );
}

/** Vertical columns — within SLA vs breached */
export function ServiceSlaComplianceBarChart({
  data,
  loading,
}: {
  data: (ServiceChartLinkPoint & { count: number })[];
  loading?: boolean;
}) {
  const navigate = useChartNavigate();
  const chartData = data.map((d) => ({
    ...d,
    fill: SLA_COLORS[d.name] ?? SERVICE_CHART_COLORS.slate,
  }));
  const total = data.reduce((sum, d) => sum + d.count, 0);

  return (
    <div>
      <ChartShell
        loading={loading}
        empty={!data.some((d) => d.count > 0)}
        emptyLabel="No SLA data yet"
        height={210}
        ariaLabel="SLA compliance column chart"
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 18, right: 8, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={SERVICE_CHART_COLORS.track} vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 10, fill: SERVICE_CHART_COLORS.tick }}
              tickLine={false}
              axisLine={{ stroke: SERVICE_CHART_COLORS.track }}
              interval={0}
              height={42}
              tickFormatter={(value: string) =>
                value === "Currently breached"
                  ? "Breached"
                  : value === "Closed within SLA"
                    ? "Within SLA"
                    : value === "Closed after breach"
                      ? "After breach"
                      : value
              }
            />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 11, fill: SERVICE_CHART_COLORS.tick }}
              tickLine={false}
              axisLine={false}
              width={32}
            />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(15, 23, 42, 0.04)" }} />
            <Bar
              dataKey="count"
              radius={[8, 8, 0, 0]}
              maxBarSize={64}
              style={{ cursor: "pointer" }}
              onClick={(entry) => navigate(entry as { href?: string })}
            >
              {chartData.map((entry) => (
                <Cell key={entry.name} fill={entry.fill} />
              ))}
              <LabelList
                dataKey="count"
                position="top"
                className="fill-foreground"
                style={{ fontSize: 11, fontWeight: 500, fontVariantNumeric: "tabular-nums" }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartShell>
      {!loading && total > 0 ? (
        <ChartLegend
          items={chartData.map((d) => ({
            name: d.name,
            value: d.count,
            color: d.fill,
            href: d.href,
          }))}
          onSelect={(href) => href && navigate({ href })}
        />
      ) : null}
    </div>
  );
}

/** Donut — tickets by support mode (remote / onsite / OEM) */
export function ServiceSupportModeChart({
  data,
  loading,
}: {
  data: (ServiceChartLinkPoint & { count: number })[];
  loading?: boolean;
}) {
  const navigate = useChartNavigate();
  const chartData = data
    .filter((d) => d.count > 0)
    .map((d) => ({
      ...d,
      fill: MODE_COLORS[d.name] ?? SERVICE_CHART_COLORS.slate,
    }));
  const total = chartData.reduce((sum, d) => sum + d.count, 0);

  return (
    <ChartShell
      loading={loading}
      empty={!total}
      emptyLabel="No tickets with a support mode assigned"
      ariaLabel="Support mode donut chart"
    >
      <div className="flex h-full items-center gap-4">
        <div className="relative h-full min-w-0 flex-1">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                dataKey="count"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius="56%"
                outerRadius="82%"
                paddingAngle={3}
                strokeWidth={0}
                style={{ cursor: "pointer" }}
                onClick={(entry) => navigate(entry as ServiceChartLinkPoint & { count: number })}
              >
                {chartData.map((entry) => (
                  <Cell key={entry.name} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip content={<ChartTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <p className="font-mono text-2xl font-semibold tabular-nums tracking-tight text-foreground">
              {total}
            </p>
            <p className="text-[10px] font-medium tracking-[0.12em] text-muted-foreground uppercase">
              Tickets
            </p>
          </div>
        </div>
        <ul className="w-[42%] shrink-0 space-y-2.5 pr-1">
          {chartData.map((entry) => {
            const pct = total ? Math.round((entry.count / total) * 100) : 0;
            return (
              <li key={entry.name}>
                <button
                  type="button"
                  onClick={() => navigate(entry)}
                  className="flex w-full cursor-pointer items-start justify-between gap-2 rounded-md px-1.5 py-1 text-left transition-colors hover:bg-muted/50"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span
                      className="mt-0.5 size-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: entry.fill }}
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-[11px] font-medium text-foreground">
                        {entry.name}
                      </span>
                      <span className="block text-[10px] text-muted-foreground">{pct}%</span>
                    </span>
                  </span>
                  <span className="shrink-0 font-mono text-xs tabular-nums text-foreground">
                    {entry.count.toLocaleString("en-IN")}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </ChartShell>
  );
}
