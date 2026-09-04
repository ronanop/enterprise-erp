"use client";

import { useMemo } from "react";
import { BarChart3, PieChart as PieChartIcon } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  Exploded3dPieChart,
  type Exploded3dPieSlice,
} from "@/components/procurement/exploded-3d-pie";
import { formatInr } from "@/services/procurement-service";
import { WrappedYAxisTick } from "@/utils/chart-axis-label";
import type { ProcurementInventoryStockSummary } from "@/utils/procurement-inventory-report";

const STOCK_BAR_TOP = "#0369A1";
const STOCK_BAR_REST = ["#0EA5E9", "#0D9488", "#14B8A6", "#64748B", "#94A3B8"];
const MIX_PIE_COLORS = [
  "#0369A1",
  "#0D9488",
  "#0284C7",
  "#0F766E",
  "#475569",
  "#38BDF8",
  "#2DD4BF",
];

export function ProcurementInventoryCharts({
  summary,
  loading,
}: {
  summary: ProcurementInventoryStockSummary;
  loading?: boolean;
}) {
  const topProducts = useMemo(() => {
    const rows = [...summary.byProduct].sort(
      (a, b) =>
        b.units - a.units ||
        b.stockValue - a.stockValue ||
        a.productName.localeCompare(b.productName),
    );
    return rows.slice(0, 6).map((row) => ({
      name: row.productName,
      fullName: row.productName,
      units: row.units,
      stockValue: row.stockValue,
      avgUnitCost: row.avgUnitCost,
    }));
  }, [summary]);

  const productSlices = useMemo((): Exploded3dPieSlice[] => {
    const rows = [...summary.byProduct].sort(
      (a, b) =>
        b.stockValue - a.stockValue ||
        b.units - a.units ||
        a.productName.localeCompare(b.productName),
    );
    const top = rows.slice(0, 5);
    const rest = rows.slice(5);
    const slices: Exploded3dPieSlice[] = top.map((row, index) => ({
      key: `product-${index}-${row.productName}`,
      label: row.productName,
      value: Math.max(row.stockValue, row.units),
      color: MIX_PIE_COLORS[index % MIX_PIE_COLORS.length],
    }));
    if (rest.length > 0) {
      const otherValue = rest.reduce(
        (sum, row) => sum + Math.max(row.stockValue, row.units),
        0,
      );
      if (otherValue > 0) {
        slices.push({
          key: "other-products",
          label: "Other products",
          value: otherValue,
          color: MIX_PIE_COLORS[MIX_PIE_COLORS.length - 1],
        });
      }
    }
    return slices.filter((s) => s.value > 0);
  }, [summary]);

  if (!loading && summary.byProduct.length === 0) {
    return null;
  }

  return (
    <div className="grid items-stretch gap-3 lg:grid-cols-[58fr_42fr]">
      <section
        aria-label="Top products by units"
        className="rounded-xl border border-sky-200/70 bg-gradient-to-b from-white via-sky-50/40 to-white px-2 py-3 shadow-sm"
      >
        <div className="mb-1 flex items-center justify-between gap-2 px-2">
          <div className="flex min-w-0 items-center gap-1.5">
            <BarChart3 className="size-3.5 shrink-0 text-sky-700" aria-hidden />
            <p className="text-[11px] font-semibold uppercase tracking-wide text-sky-800/80">
              Top products by units
            </p>
          </div>
          <p className="text-[11px] tabular-nums font-medium text-sky-900/70">
            {loading ? "—" : `${summary.totalUnits.toLocaleString("en-IN")} units`}
          </p>
        </div>
        {loading ? (
          <div className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">
            Loading stock…
          </div>
        ) : topProducts.length === 0 ? (
          <div className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">
            No stock units on hand
          </div>
        ) : (
          <div
            className="h-[260px] w-full"
            role="img"
            aria-label="Top products by inventory units"
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={topProducts}
                layout="vertical"
                margin={{ top: 8, right: 36, left: 8, bottom: 8 }}
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
                  width={168}
                  interval={0}
                  tick={<WrappedYAxisTick maxCharsPerLine={16} maxLines={3} />}
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
      </section>

      <section
        aria-label="Stock value mix"
        className="rounded-xl border border-teal-200/70 bg-gradient-to-b from-white via-teal-50/35 to-white px-3 py-3 shadow-sm"
      >
        <div className="mb-2 flex items-center gap-1.5 px-1">
          <PieChartIcon className="size-3.5 shrink-0 text-teal-700" aria-hidden />
          <p className="text-[11px] font-semibold uppercase tracking-wide text-teal-800/80">
            Stock value mix
          </p>
        </div>
        {loading ? (
          <div className="flex min-h-[210px] items-center justify-center text-sm text-muted-foreground">
            Loading mix…
          </div>
        ) : productSlices.length === 0 ? (
          <div className="flex min-h-[210px] items-center justify-center text-sm text-muted-foreground">
            No stock mix yet
          </div>
        ) : (
          <Exploded3dPieChart
            slices={productSlices}
            ariaLabel="Stock value mix by product"
            size={128}
            layout="compact"
          />
        )}
      </section>
    </div>
  );
}
