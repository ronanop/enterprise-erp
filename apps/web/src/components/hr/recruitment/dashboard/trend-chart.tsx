"use client";

import { useId, useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { FilterSelect } from "@/components/ui/filter-select";
import {
  TREND_RANGE_OPTIONS,
  type TrendPoint,
  type TrendRangeKey,
} from "@/components/hr/recruitment/dashboard/dashboard-model";

const PURPLE = "#9B5BB8";

function TrendTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload?: TrendPoint; value?: number }>;
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload;
  const value = Number(payload[0]?.value ?? point?.value ?? 0);
  return (
    <div className="rounded-[12px] border border-[#EEEFF3] bg-white px-3 py-2 shadow-[0_8px_24px_rgba(15,23,42,0.08)]">
      <p className="text-[11px] text-[#9CA3AF]">{point?.fullLabel}</p>
      <p className="mt-1 flex items-center gap-1.5 text-[12px] font-medium text-[#7C3AED]">
        <span className="size-2 rounded-full bg-[#7C3AED]" />
        {value} Applications
      </p>
    </div>
  );
}

export function TrendChart({
  data,
  range,
  onRangeChange,
}: {
  data: TrendPoint[];
  range: TrendRangeKey;
  onRangeChange: (range: TrendRangeKey) => void;
}) {
  const gradId = useId().replace(/:/g, "");
  const rows = useMemo(() => data, [data]);
  const lastIndex = Math.max(0, rows.length - 1);
  const yMax = Math.max(4, ...rows.map((r) => r.value));

  return (
    <section className="flex h-full min-h-[280px] flex-col rounded-[12px] border border-[#EEEFF3] bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-[15px] font-semibold tracking-tight text-[#111827]">Applications Trend</h2>
        <FilterSelect
          value={range}
          onChange={(v) => onRangeChange(v as TrendRangeKey)}
          options={TREND_RANGE_OPTIONS}
          className="w-[148px] [&_button]:h-8 [&_button]:rounded-lg [&_button]:border-[#E5E7EB] [&_button]:bg-white [&_button]:text-[12px]"
        />
      </div>
      <div className="mt-3 h-[220px] min-h-[220px] w-full">
        {rows.length === 0 ? (
          <div className="flex h-full min-h-[200px] items-center justify-center text-sm text-muted-foreground">
            No application trend yet
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={rows} margin={{ top: 18, right: 12, left: -18, bottom: 0 }}>
              <defs>
                <linearGradient id={`rec-trend-${gradId}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={PURPLE} stopOpacity={0.28} />
                  <stop offset="100%" stopColor={PURPLE} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#EEF0F4" vertical={false} />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 11, fill: "#9CA3AF" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "#9CA3AF" }}
                axisLine={false}
                tickLine={false}
                width={32}
                allowDecimals={false}
                domain={[0, yMax]}
              />
              <Tooltip
                content={<TrendTooltip />}
                cursor={{ stroke: PURPLE, strokeDasharray: "3 3", strokeOpacity: 0.45 }}
                defaultIndex={lastIndex}
              />
              <Area
                type="monotone"
                dataKey="value"
                name="Applications"
                stroke={PURPLE}
                strokeWidth={2.4}
                fill={`url(#rec-trend-${gradId})`}
                dot={{ r: 3.5, fill: "#fff", stroke: PURPLE, strokeWidth: 2 }}
                activeDot={{ r: 5, fill: PURPLE, stroke: "#fff", strokeWidth: 2 }}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  );
}
