"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { findKpiById, useAnalyticsKpis } from "@/components/analytics/executive/use-analytics-kpis";
import { getAnalyticsKpiDetail, type AnalyticsWidget } from "@/services/analytics-service";

const CHART_GRID = "#E2E8F0";
const CHART_BAR = "#0369A1";

function formatValue(value: number | null | undefined): string {
  if (value == null) return "—";
  return String(value);
}

function KpiTileWidget({ widget }: { widget: AnalyticsWidget }) {
  const { kpis, loading, error } = useAnalyticsKpis();
  const kpi = findKpiById(kpis, widget.kpi_id);

  return (
    <article className="rounded-xl border border-border/80 bg-card p-4 shadow-sm transition-[box-shadow,border-color] duration-200 hover:border-border hover:shadow-md">
      <p className="text-sm font-medium text-foreground">{widget.widget_title}</p>
      <p className="mt-1 text-[11px] tracking-wide text-muted-foreground uppercase">{widget.widget_type}</p>
      {loading ? (
        <p className="mt-3 text-sm text-muted-foreground">Loading…</p>
      ) : error ? (
        <p className="mt-3 text-sm text-destructive">{error}</p>
      ) : !widget.kpi_id ? (
        <p className="mt-3 text-sm text-muted-foreground">No KPI linked</p>
      ) : !kpi ? (
        <p className="mt-3 text-sm text-muted-foreground">No matching KPI for this widget</p>
      ) : (
        <>
          <p className="mt-3 font-mono text-2xl font-medium tracking-tight text-foreground tabular-nums">
            {formatValue(kpi.current_value)}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {kpi.target_value != null ? `Target: ${kpi.target_value}` : "No target"}
          </p>
        </>
      )}
    </article>
  );
}

function ChartWidget({ widget }: { widget: AnalyticsWidget }) {
  const { kpis, loading, error } = useAnalyticsKpis();
  const kpi = findKpiById(kpis, widget.kpi_id);
  const [bars, setBars] = useState<{ name: string; value: number }[]>([]);
  const [detailError, setDetailError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!widget.kpi_id) {
      setBars([]);
      return;
    }
    void getAnalyticsKpiDetail(widget.kpi_id)
      .then((detail) => {
        if (cancelled) return;
        if (detail.breakdown.length > 0) {
          setBars(
            detail.breakdown.map((row) => ({
              name: row.dimension_label,
              value: row.value,
            })),
          );
        } else if (detail.current_value != null) {
          setBars([{ name: detail.kpi_code, value: detail.current_value }]);
        } else {
          setBars([]);
        }
        setDetailError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setDetailError(err instanceof Error ? err.message : "Failed to load chart data");
        setBars([]);
      });
    return () => {
      cancelled = true;
    };
  }, [widget.kpi_id]);

  const reducedMotion = useMemo(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  return (
    <article className="rounded-xl border border-border/80 bg-card p-4 shadow-sm">
      <p className="text-sm font-medium text-foreground">{widget.widget_title}</p>
      <p className="mt-1 text-[11px] tracking-wide text-muted-foreground uppercase">{widget.widget_type}</p>
      {loading ? (
        <p className="mt-3 text-sm text-muted-foreground">Loading…</p>
      ) : error || detailError ? (
        <p className="mt-3 text-sm text-destructive">{error ?? detailError}</p>
      ) : bars.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          {kpi ? "No chart data for this KPI yet" : "No matching KPI for this widget"}
        </p>
      ) : (
        <div className="mt-3 h-44 w-full min-w-0" role="img" aria-label={`${widget.widget_title} bar chart`}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={bars} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="value" fill={CHART_BAR} isAnimationActive={!reducedMotion} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      <p className="mt-2 text-[11px] text-muted-foreground">Time-series not available yet</p>
    </article>
  );
}

function PlaceholderWidget({ widget }: { widget: AnalyticsWidget }) {
  // TODO Phase 5+: real renderers for table / gauge / map / text / iframe
  return (
    <article className="rounded-xl border border-border/80 bg-muted/20 p-4 shadow-sm">
      <p className="text-sm font-medium">{widget.widget_title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{widget.widget_type}</p>
      <p className="mt-3 text-sm text-muted-foreground">Renderer not implemented yet</p>
    </article>
  );
}

export function WidgetRenderer({ widget }: { widget: AnalyticsWidget }) {
  if (widget.widget_type === "kpi_tile") return <KpiTileWidget widget={widget} />;
  if (widget.widget_type === "chart") return <ChartWidget widget={widget} />;
  return <PlaceholderWidget widget={widget} />;
}
