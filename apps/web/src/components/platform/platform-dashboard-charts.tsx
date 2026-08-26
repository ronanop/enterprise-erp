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

import { CRM_CHART_COLORS } from "@/components/crm/crm-dashboard-charts";
import { cn } from "@/lib/utils";

const MODULE_COLORS = [
  CRM_CHART_COLORS.sky,
  CRM_CHART_COLORS.skyDark,
  CRM_CHART_COLORS.teal,
  CRM_CHART_COLORS.emerald,
  CRM_CHART_COLORS.amber,
  CRM_CHART_COLORS.slate,
] as const;

const HEALTH_COLORS = [
  CRM_CHART_COLORS.emerald,
  CRM_CHART_COLORS.amber,
  CRM_CHART_COLORS.slate,
] as const;

type ChartTooltipProps = {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number }>;
  label?: string;
  valueFormatter?: (value: number) => string;
};

function ChartTooltip({ active, payload, label, valueFormatter }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  const value = Number(payload[0]?.value ?? 0);
  return (
    <div className="rounded-lg border border-border/80 bg-card px-2.5 py-1.5 text-xs shadow-md">
      <p className="font-medium text-foreground">{label ?? payload[0]?.name}</p>
      <p className="mt-0.5 tabular-nums text-muted-foreground">
        {valueFormatter ? valueFormatter(value) : value.toLocaleString("en-IN")}
      </p>
    </div>
  );
}

function ChartEmpty({ message }: { message: string }) {
  return (
    <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">{message}</div>
  );
}

function ChartLoading() {
  return (
    <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">Loading chart…</div>
  );
}

export function PlatformModuleActivityChart({
  data,
  loading,
}: {
  data: { name: string; count: number }[];
  loading?: boolean;
}) {
  if (loading) return <ChartLoading />;
  if (!data.length) return <ChartEmpty message="No module activity yet" />;

  return (
    <div className="h-[220px] w-full min-w-0" role="img" aria-label="Record counts by module">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={CRM_CHART_COLORS.track} vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 10, fill: "#64748B" }}
            tickLine={false}
            axisLine={{ stroke: CRM_CHART_COLORS.track }}
            interval={0}
            angle={-18}
            textAnchor="end"
            height={56}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 11, fill: "#64748B" }}
            tickLine={false}
            axisLine={false}
            width={36}
          />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(15, 23, 42, 0.04)" }} />
          <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={40}>
            {data.map((_, index) => (
              <Cell key={index} fill={MODULE_COLORS[index % MODULE_COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function PlatformConnectedPipelineChart({
  data,
  loading,
}: {
  data: { stage: string; count: number }[];
  loading?: boolean;
}) {
  if (loading) return <ChartLoading />;
  if (!data.length) return <ChartEmpty message="Connect CRM and Procurement to view the pipeline" />;

  return (
    <div className="h-[220px] w-full min-w-0" role="img" aria-label="Connected revenue-to-fulfillment pipeline">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 12, left: 4, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={CRM_CHART_COLORS.track} horizontal={false} />
          <XAxis
            type="number"
            allowDecimals={false}
            tick={{ fontSize: 10, fill: "#64748B" }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            type="category"
            dataKey="stage"
            width={96}
            tick={{ fontSize: 11, fill: "#64748B" }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(15, 23, 42, 0.04)" }} />
          <Bar dataKey="count" radius={[0, 6, 6, 0]} maxBarSize={22}>
            {data.map((_, index) => (
              <Cell key={index} fill={MODULE_COLORS[index % MODULE_COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function PlatformModuleShareDonut({
  data,
  loading,
}: {
  data: { name: string; value: number }[];
  loading?: boolean;
}) {
  const total = data.reduce((sum, row) => sum + row.value, 0);

  if (loading) return <ChartLoading />;
  if (!total) return <ChartEmpty message="No department share data yet" />;

  return (
    <div className="relative h-[220px] w-full min-w-0" role="img" aria-label="Record share by department">
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
            {data.map((_, index) => (
              <Cell key={index} fill={MODULE_COLORS[index % MODULE_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip content={<ChartTooltip />} />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <p className="font-mono text-xl font-medium tabular-nums text-foreground">
          {total.toLocaleString("en-IN")}
        </p>
        <p className="text-[10px] tracking-wide text-muted-foreground uppercase">Records</p>
      </div>
    </div>
  );
}

export function PlatformModuleHealthDonut({
  data,
  loading,
  compact = false,
}: {
  data: { name: string; value: number }[];
  loading?: boolean;
  compact?: boolean;
}) {
  const total = data.reduce((sum, row) => sum + row.value, 0);

  if (loading) {
    return compact ? (
      <div className="flex h-full items-center justify-center text-[10px] text-muted-foreground">…</div>
    ) : (
      <ChartLoading />
    );
  }
  if (!total) {
    return compact ? (
      <div className="flex h-full items-center justify-center text-[10px] text-muted-foreground">—</div>
    ) : (
      <ChartEmpty message="No module health data" />
    );
  }

  const inner = compact ? 28 : 58;
  const outer = compact ? 42 : 82;

  return (
    <div
      className={cn(
        "relative w-full min-w-0",
        compact ? "h-full" : "h-[220px]",
      )}
      role="img"
      aria-label="Module data health"
    >
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius={inner}
            outerRadius={outer}
            paddingAngle={2}
            strokeWidth={0}
          >
            {data.map((_, index) => (
              <Cell key={index} fill={HEALTH_COLORS[index % HEALTH_COLORS.length]} />
            ))}
          </Pie>
          {!compact ? <Tooltip content={<ChartTooltip />} /> : null}
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <p
          className={cn(
            "font-mono font-medium tabular-nums text-foreground",
            compact ? "text-sm" : "text-xl",
          )}
        >
          {total}
        </p>
        {!compact ? (
          <p className="text-[10px] tracking-wide text-muted-foreground uppercase">Modules</p>
        ) : null}
      </div>
    </div>
  );
}
