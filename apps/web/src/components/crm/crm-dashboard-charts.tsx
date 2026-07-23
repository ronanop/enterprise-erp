"use client";

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

/** Swiss/minimal chart palette — matches ERP MASTER (no purple). */
export const CRM_CHART_COLORS = {
  sky: "#0369A1",
  skyDark: "#0C4A6E",
  teal: "#0F766E",
  emerald: "#047857",
  slate: "#475569",
  amber: "#B45309",
  muted: "#94A3B8",
  track: "#E2E8F0",
} as const;

const STAGE_COLORS = [
  CRM_CHART_COLORS.sky,
  CRM_CHART_COLORS.skyDark,
  CRM_CHART_COLORS.teal,
  CRM_CHART_COLORS.emerald,
  CRM_CHART_COLORS.slate,
] as const;

type TooltipPayload = { name?: string; value?: number; payload?: Record<string, unknown> };

function ChartTooltip({
  active,
  payload,
  label,
  valueFormatter,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
  valueFormatter?: (value: number) => string;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0];
  const value = Number(row.value ?? 0);
  return (
    <div className="rounded-lg border border-border/80 bg-card px-2.5 py-1.5 text-xs shadow-md">
      <p className="font-medium text-foreground">{label ?? row.name}</p>
      <p className="mt-0.5 tabular-nums text-muted-foreground">
        {valueFormatter ? valueFormatter(value) : value.toLocaleString("en-IN")}
      </p>
    </div>
  );
}

export function CrmPipelineBarChart({
  data,
  loading,
}: {
  data: { name: string; count: number }[];
  loading?: boolean;
}) {
  if (loading) {
    return <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">Loading chart…</div>;
  }
  if (!data.length) {
    return <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">No pipeline data</div>;
  }

  return (
    <div className="h-[220px] w-full min-w-0" role="img" aria-label="CRM pipeline counts by stage">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={CRM_CHART_COLORS.track} vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 11, fill: "#64748B" }}
            tickLine={false}
            axisLine={{ stroke: CRM_CHART_COLORS.track }}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 11, fill: "#64748B" }}
            tickLine={false}
            axisLine={false}
            width={32}
          />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(15, 23, 42, 0.04)" }} />
          <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={48}>
            {data.map((_, i) => (
              <Cell key={i} fill={STAGE_COLORS[i % STAGE_COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CrmStageDonutChart({
  data,
  loading,
}: {
  data: { name: string; value: number }[];
  loading?: boolean;
}) {
  const total = data.reduce((sum, d) => sum + d.value, 0);

  if (loading) {
    return <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">Loading chart…</div>;
  }
  if (!total) {
    return <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">No stage data</div>;
  }

  return (
    <div className="relative h-[220px] w-full min-w-0" role="img" aria-label="Opportunity stage mix">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius={58}
            outerRadius={82}
            paddingAngle={2}
            strokeWidth={0}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={STAGE_COLORS[i % STAGE_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip content={<ChartTooltip />} />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <p className="font-mono text-xl font-medium tabular-nums text-foreground">{total}</p>
        <p className="text-[10px] tracking-wide text-muted-foreground uppercase">Deals</p>
      </div>
    </div>
  );
}

export function CrmRevenueBarChart({
  data,
  loading,
  formatValue,
}: {
  data: { name: string; value: number }[];
  loading?: boolean;
  formatValue: (n: number) => string;
}) {
  if (loading) {
    return <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">Loading chart…</div>;
  }
  if (!data.some((d) => d.value > 0)) {
    return <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">No revenue data</div>;
  }

  return (
    <div className="h-[220px] w-full min-w-0" role="img" aria-label="Open pipeline value by stage">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 12, left: 4, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={CRM_CHART_COLORS.track} horizontal={false} />
          <XAxis
            type="number"
            tick={{ fontSize: 10, fill: "#64748B" }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => {
              const n = Number(v);
              if (n >= 1e7) return `${(n / 1e7).toFixed(1)}Cr`;
              if (n >= 1e5) return `${(n / 1e5).toFixed(1)}L`;
              if (n >= 1e3) return `${(n / 1e3).toFixed(0)}K`;
              return String(n);
            }}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={88}
            tick={{ fontSize: 11, fill: "#64748B" }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip content={<ChartTooltip valueFormatter={formatValue} />} cursor={{ fill: "rgba(15, 23, 42, 0.04)" }} />
          <Bar dataKey="value" fill={CRM_CHART_COLORS.sky} radius={[0, 6, 6, 0]} maxBarSize={22} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
