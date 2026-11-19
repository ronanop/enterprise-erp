"use client";

import Link from "next/link";
import { Boxes } from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { cn } from "@/lib/utils";
import type { ProcurementInventoryStockSummary } from "@/utils/procurement-inventory-report";

const CHART_SIZE = 84;
const DONUT_INNER = 22;
const DONUT_OUTER = 36;
const SLICE_COLORS = [
  "#0369A1",
  "#0F766E",
  "#047857",
  "#B45309",
  "#475569",
  "#0E7490",
] as const;

const MAX_SLICES = 5;

type PieSlice = { name: string; value: number; color: string };

function buildPieSlices(
  byProduct: ProcurementInventoryStockSummary["byProduct"],
): PieSlice[] {
  if (byProduct.length === 0) return [];

  const top = byProduct.slice(0, MAX_SLICES);
  const restUnits = byProduct
    .slice(MAX_SLICES)
    .reduce((sum, row) => sum + row.units, 0);

  const slices: PieSlice[] = top.map((row, index) => ({
    name: row.productName,
    value: row.units,
    color: SLICE_COLORS[index % SLICE_COLORS.length],
  }));

  if (restUnits > 0) {
    slices.push({
      name: "Other products",
      value: restUnits,
      color: SLICE_COLORS[SLICE_COLORS.length - 1],
    });
  }

  return slices.filter((s) => s.value > 0);
}

function InventoryPieTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { name?: string; value?: number; payload?: PieSlice }[];
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0];
  const name = row.payload?.name ?? row.name ?? "Product";
  const value = Number(row.value ?? 0);
  return (
    <div className="rounded-lg border border-border/80 bg-card px-2.5 py-1.5 text-xs shadow-md">
      <p className="max-w-[14rem] truncate font-medium text-foreground">{name}</p>
      <p className="tabular-nums text-muted-foreground">
        {value.toLocaleString("en-IN")} units
      </p>
    </div>
  );
}

export function ProcurementInventoryStockCard({
  loading,
  summary,
}: {
  loading: boolean;
  summary: ProcurementInventoryStockSummary | null;
}) {
  const totalUnits = summary?.totalUnits ?? 0;
  const slices = summary ? buildPieSlices(summary.byProduct) : [];
  const tone =
    totalUnits > 0 ? "bg-emerald-100 text-emerald-800" : "bg-accent text-accent-foreground";
  const showChart = !loading && slices.length > 0;

  return (
    <Link
      href="/procurement/inventory"
      className={cn(
        "flex h-full min-h-[11rem] cursor-pointer flex-col rounded-xl border border-border/80 bg-card p-3.5 shadow-sm",
        "transition-[box-shadow,border-color] duration-200 hover:border-primary/30 hover:shadow-md",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Inventory / stock
        </p>
        <span
          className={cn("flex size-8 items-center justify-center rounded-lg", tone)}
        >
          <Boxes className="size-3.5" aria-hidden />
        </span>
      </div>

      <div className="mt-2 flex min-h-[5.25rem] items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-mono text-xl font-medium tracking-tight text-foreground tabular-nums">
            {loading ? "—" : String(totalUnits)}
          </p>
          {loading ? (
            <p className="mt-2 text-xs text-muted-foreground">Loading…</p>
          ) : totalUnits === 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">No GRN stock on hand.</p>
          ) : null}
        </div>

        {showChart ? (
          <div
            className="relative shrink-0 -translate-x-2"
            style={{ width: CHART_SIZE, height: CHART_SIZE }}
            role="img"
            aria-label="Stock mix by product"
          >
            <ResponsiveContainer width="100%" height="100%">
              <PieChart margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
                <Pie
                  data={slices}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={DONUT_INNER}
                  outerRadius={DONUT_OUTER}
                  paddingAngle={slices.length > 1 ? 2 : 0}
                  strokeWidth={0}
                  startAngle={90}
                  endAngle={-270}
                >
                  {slices.map((slice) => (
                    <Cell key={slice.name} fill={slice.color} />
                  ))}
                </Pie>
                <Tooltip content={<InventoryPieTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        ) : null}
      </div>
    </Link>
  );
}
