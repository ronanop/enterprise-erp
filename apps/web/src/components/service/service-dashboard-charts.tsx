"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

/** Matches CRM / ERP chart palette — no purple gradients. */
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
} as const;

const PALETTE = [
  SERVICE_CHART_COLORS.sky,
  SERVICE_CHART_COLORS.skyDark,
  SERVICE_CHART_COLORS.teal,
  SERVICE_CHART_COLORS.emerald,
  SERVICE_CHART_COLORS.amber,
  SERVICE_CHART_COLORS.slate,
  SERVICE_CHART_COLORS.rose,
] as const;

const MODE_COLORS: Record<string, string> = {
  "Remote Support": SERVICE_CHART_COLORS.sky,
  "Onsite Support": SERVICE_CHART_COLORS.teal,
  "OEM Support": SERVICE_CHART_COLORS.amber,
};

export type ServiceChartLinkPoint = {
  name: string;
  href?: string;
};

type TooltipPayload = { name?: string; value?: number; payload?: Record<string, unknown> };

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
  return (
    <div className="rounded-lg border border-border/80 bg-card px-2.5 py-1.5 text-xs shadow-md">
      <p className="font-medium text-foreground">{label ?? row.name}</p>
      <p className="mt-0.5 tabular-nums text-muted-foreground">{value.toLocaleString("en-IN")}</p>
    </div>
  );
}

function ChartShell({
  loading,
  empty,
  emptyLabel,
  height = 240,
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
        className="flex items-center justify-center text-sm text-muted-foreground"
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

/** Horizontal bars — ticket lifecycle stages */
export function ServiceStatusBarChart({
  data,
  loading,
}: {
  data: (ServiceChartLinkPoint & { value: number })[];
  loading?: boolean;
}) {
  const navigate = useChartNavigate();
  const chartData = data.map((d) => ({ name: d.name, count: d.value, href: d.href }));

  return (
    <ChartShell
      loading={loading}
      empty={!data.length}
      emptyLabel="No ticket status data"
      ariaLabel="Ticket status horizontal bar chart"
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={SERVICE_CHART_COLORS.track} horizontal={false} />
          <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10, fill: "#64748B" }} axisLine={false} tickLine={false} />
          <YAxis
            type="category"
            dataKey="name"
            width={92}
            tick={{ fontSize: 11, fill: "#64748B" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(15, 23, 42, 0.04)" }} />
          <Bar
            dataKey="count"
            radius={[0, 6, 6, 0]}
            maxBarSize={22}
            style={{ cursor: "pointer" }}
            onClick={(entry) => navigate(entry as { href?: string })}
          >
            {chartData.map((_, i) => (
              <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
            ))}
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
  const colors: Record<string, string> = {
    "Currently breached": SERVICE_CHART_COLORS.rose,
    "Closed within SLA": SERVICE_CHART_COLORS.emerald,
    "Closed after breach": SERVICE_CHART_COLORS.amber,
  };

  return (
    <ChartShell
      loading={loading}
      empty={!data.some((d) => d.count > 0)}
      emptyLabel="No SLA data yet"
      ariaLabel="SLA compliance column chart"
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={SERVICE_CHART_COLORS.track} vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 11, fill: "#64748B" }}
            tickLine={false}
            axisLine={{ stroke: SERVICE_CHART_COLORS.track }}
          />
          <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#64748B" }} tickLine={false} axisLine={false} width={32} />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(15, 23, 42, 0.04)" }} />
          <Bar
            dataKey="count"
            radius={[6, 6, 0, 0]}
            maxBarSize={72}
            style={{ cursor: "pointer" }}
            onClick={(entry) => navigate(entry as { href?: string })}
          >
            {data.map((entry) => (
              <Cell key={entry.name} fill={colors[entry.name] ?? SERVICE_CHART_COLORS.slate} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartShell>
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

  return (
    <ChartShell
      loading={loading}
      empty={!data.some((d) => d.count > 0)}
      emptyLabel="No tickets with a support mode assigned"
      ariaLabel="Support mode donut chart"
    >
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data.filter((d) => d.count > 0)}
            dataKey="count"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius="52%"
            outerRadius="78%"
            paddingAngle={2}
            style={{ cursor: "pointer" }}
            onClick={(entry) => navigate(entry as ServiceChartLinkPoint & { count: number })}
          >
            {data
              .filter((d) => d.count > 0)
              .map((entry) => (
                <Cell key={entry.name} fill={MODE_COLORS[entry.name] ?? SERVICE_CHART_COLORS.slate} />
              ))}
          </Pie>
          <Tooltip content={<ChartTooltip />} />
        </PieChart>
      </ResponsiveContainer>
    </ChartShell>
  );
}
