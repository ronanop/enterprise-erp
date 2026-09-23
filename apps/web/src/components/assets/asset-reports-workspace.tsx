"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  Boxes,
  FileStack,
  GitBranch,
  Layers3,
  Loader2,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";

import {
  ASSETS_SURFACE_CARD,
  StatCard,
} from "@/components/assets/shared";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { isAuthenticated } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { ApiClientError } from "@/services/api-client";
import { type ReportDashboard, reportService } from "@/services/assets-service";

/** Cool progressive report palette — no purple; matches assets design override. */
const CHART = {
  sky: "#0369A1",
  teal: "#0F766E",
  emerald: "#047857",
  amber: "#B45309",
  slate: "#475569",
  rose: "#BE123C",
  skySoft: "#7DD3FC",
  tealSoft: "#5EEAD4",
  amberSoft: "#FCD34D",
  track: "#E2E8F0",
  tick: "#64748B",
} as const;

const STATUS_COLORS = [
  CHART.sky,
  CHART.teal,
  CHART.emerald,
  CHART.amber,
  CHART.slate,
  CHART.rose,
  CHART.skySoft,
] as const;

const DOC_TYPE_COLORS: Record<string, string> = {
  invoice: CHART.sky,
  warranty: CHART.teal,
  insurance: CHART.emerald,
  manual: CHART.amber,
  photo: CHART.slate,
  other: CHART.rose,
};

function titleCase(value: string): string {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
}

function formatMonthLabel(month: string): string {
  const [year, mon] = month.split("-");
  if (!year || !mon) return month;
  const date = new Date(Number(year), Number(mon) - 1, 1);
  return date.toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
}

function asCountRows(
  rows: Array<Record<string, unknown>> | undefined,
  key: "status" | "document_type" | "component_type" | "stage" | "month" | "name",
): Array<{ name: string; count: number; fill: string; raw: string }> {
  if (!rows?.length) return [];
  return rows.map((row, index) => {
    const raw = String(row[key] ?? row.name ?? "—");
    const count = Number(row.count ?? 0);
    return {
      name: key === "month" ? formatMonthLabel(raw) : titleCase(raw),
      count,
      fill: STATUS_COLORS[index % STATUS_COLORS.length],
      raw,
    };
  });
}

function ChartTooltip({
  active,
  payload,
  label,
  unit = "items",
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number; color?: string; payload?: { fill?: string } }>;
  label?: string;
  unit?: string;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0];
  const color = row.color ?? row.payload?.fill;
  return (
    <div className="rounded-lg border border-border/80 bg-card px-3 py-2 text-xs shadow-md">
      <div className="flex items-center gap-2">
        {color ? (
          <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
        ) : null}
        <p className="font-medium text-foreground">{label ?? row.name}</p>
      </div>
      <p className="mt-1 font-mono text-[11px] tabular-nums text-muted-foreground">
        {Number(row.value ?? 0).toLocaleString("en-IN")} {unit}
      </p>
    </div>
  );
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex h-full min-h-[200px] items-center justify-center rounded-lg border border-dashed border-border/70 bg-muted/20 px-4 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}

function SectionHeading({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="space-y-0.5">
      <h3 className="text-sm font-semibold tracking-tight text-foreground">{title}</h3>
      <p className="text-xs text-muted-foreground">{description}</p>
    </div>
  );
}

export function AssetReportsWorkspace() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<ReportDashboard | null>(null);

  const loadDashboard = useCallback(async () => {
    if (!isAuthenticated()) return;
    setLoading(true);
    setError(null);
    try {
      const dash = await reportService.dashboard();
      setDashboard(dash);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to load reports");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(() => {
      void loadDashboard();
    });
  }, [loadDashboard]);

  const analytics = dashboard?.analytics_kpis ?? {};
  const documents = dashboard?.documents;
  const components = dashboard?.components;
  const lifecycle = dashboard?.lifecycle;
  const usage = dashboard?.usage;

  const statusChart = useMemo(
    () => asCountRows(dashboard?.by_status, "status"),
    [dashboard?.by_status],
  );
  const operationalChart = useMemo(
    () => asCountRows(dashboard?.by_operational_status, "status"),
    [dashboard?.by_operational_status],
  );
  const docTypeChart = useMemo(() => {
    const rows = asCountRows(documents?.by_type, "document_type");
    return rows.map((row) => ({
      ...row,
      fill: DOC_TYPE_COLORS[row.raw.toLowerCase()] ?? row.fill,
    }));
  }, [documents?.by_type]);
  const componentTypeChart = useMemo(
    () => asCountRows(components?.by_type, "component_type"),
    [components?.by_type],
  );
  const lifecycleChart = useMemo(
    () => asCountRows(lifecycle?.stages, "stage"),
    [lifecycle?.stages],
  );
  const registrationTrend = useMemo(
    () => asCountRows(usage?.registrations_by_month, "month"),
    [usage?.registrations_by_month],
  );
  const usageBars = useMemo(
    () => [
      {
        name: "Active",
        count: Number(usage?.active_assignments ?? 0),
        fill: CHART.sky,
      },
      {
        name: "Closed",
        count: Number(usage?.closed_assignments ?? 0),
        fill: CHART.slate,
      },
      {
        name: "Available",
        count: Number(usage?.available_assets ?? 0),
        fill: CHART.emerald,
      },
    ],
    [usage],
  );

  const generatedLabel = useMemo(() => {
    if (!dashboard?.generated_at) return "—";
    const parsed = new Date(dashboard.generated_at);
    if (Number.isNaN(parsed.getTime())) return dashboard.generated_at;
    return parsed.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }, [dashboard?.generated_at]);

  return (
    <div className="space-y-5 p-4 md:p-6" data-testid="asset-reports-workspace">
      <PageHeader
        title="Asset Reports"
        description="Analytics for documents, components, status mix, usage, and lifecycle — distinct from the operational dashboard."
        actions={
          <Button
            type="button"
            variant="outline"
            className="h-9 cursor-pointer transition-colors duration-200"
            onClick={() => void loadDashboard()}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Refresh
          </Button>
        }
      />

      {error ? (
        <p
          className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Documents"
          value={loading ? "—" : String(analytics.document_count ?? documents?.total ?? 0)}
          icon={FileStack}
          tone="sky"
          trend={{
            label: `${analytics.document_coverage_pct ?? documents?.coverage_pct ?? 0}% coverage`,
            direction: "neutral",
          }}
          loading={loading}
        />
        <StatCard
          title="Components"
          value={loading ? "—" : String(analytics.component_count ?? components?.total ?? 0)}
          icon={Boxes}
          tone="slate"
          trend={{
            label: `${analytics.active_components ?? 0} active`,
            direction: "neutral",
          }}
          loading={loading}
        />
        <StatCard
          title="Assignment usage"
          value={
            loading
              ? "—"
              : `${analytics.assignment_utilization_pct ?? usage?.utilization_pct ?? 0}%`
          }
          icon={Activity}
          tone="emerald"
          trend={{
            label: `${analytics.assets_currently_assigned ?? usage?.assets_currently_assigned ?? 0} assigned`,
            direction: "neutral",
          }}
          loading={loading}
        />
        <StatCard
          title="Lifecycle open"
          value={
            loading
              ? "—"
              : String(
                  Number(lifecycle?.open_maintenance ?? 0) +
                    Number(lifecycle?.open_disposals ?? analytics.open_disposals ?? 0),
                )
          }
          icon={GitBranch}
          tone="amber"
          trend={{
            label: `${lifecycle?.open_maintenance ?? 0} maint · ${lifecycle?.open_disposals ?? analytics.open_disposals ?? 0} disposal`,
            direction: "neutral",
          }}
          loading={loading}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-12">
        <Card className={cn(ASSETS_SURFACE_CARD, "xl:col-span-7")}>
          <CardHeader className="flex flex-row items-start justify-between gap-3 pb-2">
            <SectionHeading
              title="Asset status mix"
              description="Register lifecycle status distribution"
            />
            <Layers3 className="size-4 text-muted-foreground" aria-hidden />
          </CardHeader>
          <CardContent className="h-72 pt-0">
            {statusChart.length === 0 ? (
              <EmptyChart message="No status data yet." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={statusChart} barCategoryGap="18%">
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART.track} vertical={false} />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11, fill: CHART.tick }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 11, fill: CHART.tick }}
                    axisLine={false}
                    tickLine={false}
                    width={36}
                  />
                  <Tooltip content={<ChartTooltip unit="assets" />} />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={44}>
                    {statusChart.map((entry) => (
                      <Cell key={entry.name} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className={cn(ASSETS_SURFACE_CARD, "xl:col-span-5")}>
          <CardHeader className="flex flex-row items-start justify-between gap-3 pb-2">
            <SectionHeading
              title="Operational status"
              description="Ready / assigned / in-use / retired"
            />
            <ShieldCheck className="size-4 text-muted-foreground" aria-hidden />
          </CardHeader>
          <CardContent className="h-72 pt-0">
            {operationalChart.length === 0 ? (
              <EmptyChart message="No operational status recorded." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={operationalChart}
                    dataKey="count"
                    nameKey="name"
                    innerRadius={58}
                    outerRadius={88}
                    paddingAngle={2}
                    stroke="transparent"
                  >
                    {operationalChart.map((entry) => (
                      <Cell key={entry.name} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltip unit="assets" />} />
                  <Legend
                    verticalAlign="bottom"
                    height={48}
                    formatter={(value) => (
                      <span className="text-xs text-muted-foreground">{value}</span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-12">
        <Card className={cn(ASSETS_SURFACE_CARD, "xl:col-span-6")}>
          <CardHeader className="pb-2">
            <SectionHeading
              title="Documents by type"
              description={`${analytics.assets_with_documents ?? 0} assets with files · ${analytics.assets_without_documents ?? 0} without`}
            />
          </CardHeader>
          <CardContent className="h-72 pt-0">
            {docTypeChart.length === 0 ? (
              <EmptyChart message="No documents uploaded yet." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={docTypeChart} layout="vertical" margin={{ left: 8, right: 12 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART.track} horizontal={false} />
                  <XAxis
                    type="number"
                    allowDecimals={false}
                    tick={{ fontSize: 11, fill: CHART.tick }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={88}
                    tick={{ fontSize: 11, fill: CHART.tick }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={<ChartTooltip unit="files" />} />
                  <Bar dataKey="count" radius={[0, 6, 6, 0]} maxBarSize={22}>
                    {docTypeChart.map((entry) => (
                      <Cell key={entry.name} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className={cn(ASSETS_SURFACE_CARD, "xl:col-span-6")}>
          <CardHeader className="pb-2">
            <SectionHeading
              title="Components by type"
              description={`${analytics.active_components ?? 0} active of ${analytics.component_count ?? components?.total ?? 0} total`}
            />
          </CardHeader>
          <CardContent className="h-72 pt-0">
            {componentTypeChart.length === 0 ? (
              <EmptyChart message="No components registered yet." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={componentTypeChart} barCategoryGap="16%">
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART.track} vertical={false} />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 10, fill: CHART.tick }}
                    axisLine={false}
                    tickLine={false}
                    interval={0}
                    angle={-18}
                    textAnchor="end"
                    height={56}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 11, fill: CHART.tick }}
                    axisLine={false}
                    tickLine={false}
                    width={32}
                  />
                  <Tooltip content={<ChartTooltip unit="components" />} />
                  <Bar dataKey="count" fill={CHART.teal} radius={[6, 6, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-12">
        <Card className={cn(ASSETS_SURFACE_CARD, "xl:col-span-7")}>
          <CardHeader className="pb-2">
            <SectionHeading
              title="Lifecycle funnel"
              description="Registered → assigned → maintenance → depreciation → disposed"
            />
          </CardHeader>
          <CardContent className="h-72 pt-0">
            {lifecycleChart.every((row) => row.count === 0) ? (
              <EmptyChart message="No lifecycle activity to chart." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={lifecycleChart} barCategoryGap="20%">
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART.track} vertical={false} />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11, fill: CHART.tick }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 11, fill: CHART.tick }}
                    axisLine={false}
                    tickLine={false}
                    width={36}
                  />
                  <Tooltip content={<ChartTooltip unit="assets" />} />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={48}>
                    {lifecycleChart.map((entry, index) => (
                      <Cell
                        key={entry.name}
                        fill={
                          [CHART.sky, CHART.teal, CHART.amber, CHART.emerald, CHART.slate][
                            index % 5
                          ]
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className={cn(ASSETS_SURFACE_CARD, "xl:col-span-5")}>
          <CardHeader className="pb-2">
            <SectionHeading
              title="Assignment usage"
              description={`${usage?.utilization_pct ?? 0}% of register currently assigned`}
            />
          </CardHeader>
          <CardContent className="h-72 pt-0">
            {usageBars.every((row) => row.count === 0) ? (
              <EmptyChart message="No assignment usage yet." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={usageBars}
                    dataKey="count"
                    nameKey="name"
                    innerRadius={54}
                    outerRadius={86}
                    paddingAngle={3}
                    stroke="transparent"
                  >
                    {usageBars.map((entry) => (
                      <Cell key={entry.name} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltip unit="count" />} />
                  <Legend
                    verticalAlign="bottom"
                    height={44}
                    formatter={(value) => (
                      <span className="text-xs text-muted-foreground">{value}</span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className={cn(ASSETS_SURFACE_CARD)}>
        <CardHeader className="flex flex-row items-start justify-between gap-3 pb-2">
          <SectionHeading
            title="Registration trend"
            description="New assets registered over the last 6 months"
          />
          <p className="text-[11px] text-muted-foreground">Generated {generatedLabel}</p>
        </CardHeader>
        <CardContent className="h-64 pt-0">
          {registrationTrend.length === 0 ? (
            <EmptyChart message="No registration history in this window." />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={registrationTrend} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART.track} vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11, fill: CHART.tick }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: CHART.tick }}
                  axisLine={false}
                  tickLine={false}
                  width={32}
                />
                <Tooltip content={<ChartTooltip unit="assets" />} />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke={CHART.sky}
                  strokeWidth={2.5}
                  dot={{ r: 3.5, fill: CHART.sky, strokeWidth: 0 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
