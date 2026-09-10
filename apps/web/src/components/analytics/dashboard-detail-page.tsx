"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  ModuleDetailGrid,
  ModuleDetailPage,
  ModuleDetailSection,
  ModuleWorkflowActions,
  textOrDash,
} from "@/components/module/module-detail-ui";
import { FinanceStatusBadge } from "@/components/finance/finance-status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiClientError } from "@/services/api-client";
import { WidgetRenderer } from "@/components/analytics/WidgetRenderer";
import {
  analyticsDashboardAction,
  createDashboardWidget,
  getAnalyticsDashboard,
  listAnalyticsKpis,
  listDashboardWidgets,
  type AnalyticsDashboard,
  type AnalyticsKpi,
  type AnalyticsWidget,
} from "@/services/analytics-service";

export function DashboardDetailPage({ dashboardId }: { dashboardId: string }) {
  const [dashboard, setDashboard] = useState<AnalyticsDashboard | null>(null);
  const [widgets, setWidgets] = useState<AnalyticsWidget[]>([]);
  const [kpis, setKpis] = useState<AnalyticsKpi[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [workflowError, setWorkflowError] = useState<string | null>(null);
  const [kpiId, setKpiId] = useState("");
  const [widgetTitle, setWidgetTitle] = useState("");
  const [widgetType, setWidgetType] = useState("kpi_tile");

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    setError(null);
    try {
      const [d, w, kpiRows] = await Promise.all([
        getAnalyticsDashboard(dashboardId),
        listDashboardWidgets(dashboardId),
        listAnalyticsKpis(),
      ]);
      setDashboard(d);
      setWidgets(w.sort((a, b) => a.sequence_no - b.sequence_no));
      setKpis(kpiRows);
    } catch (err) {
      setDashboard(null);
      setError(err instanceof ApiClientError ? err.message : "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }, [dashboardId]);

  useEffect(() => {
    void load();
  }, [load]);

  const actions = useMemo(() => {
    if (!dashboard) return [];
    const s = dashboard.status.toLowerCase();
    if (s === "draft") return [{ key: "submit", label: "Submit" }];
    if (s === "submitted") return [{ key: "approve", label: "Approve" }];
    if (s === "approved") return [{ key: "publish", label: "Publish" }];
    return [];
  }, [dashboard]);

  async function onWorkflow(action: string) {
    if (!dashboard) return;
    setBusy(true);
    setWorkflowError(null);
    try {
      const updated = await analyticsDashboardAction(
        dashboard.id,
        action as "submit" | "approve" | "publish",
      );
      setDashboard(updated);
      await load({ silent: true });
    } catch (err) {
      setWorkflowError(err instanceof ApiClientError ? err.message : "Workflow failed");
    } finally {
      setBusy(false);
    }
  }

  async function onAddKpi() {
    if (!kpiId) {
      setWorkflowError("Select a KPI to add");
      return;
    }
    const selected = kpis.find((row) => row.id === kpiId);
    const title = widgetTitle.trim() || selected?.kpi_name || "KPI";
    setBusy(true);
    setWorkflowError(null);
    try {
      await createDashboardWidget({
        dashboard_id: dashboardId,
        widget_title: title,
        widget_type: widgetType,
        kpi_id: kpiId,
      });
      setWidgetTitle("");
      setKpiId("");
      await load({ silent: true });
    } catch (err) {
      setWorkflowError(err instanceof ApiClientError ? err.message : "Failed to add KPI");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModuleDetailPage
      title={dashboard?.dashboard_name ?? "Dashboard"}
      subtitle={`${dashboard?.dashboard_type ?? ""} dashboard — FRD-18 §4–5`}
      backHref="/analytics/dashboards"
      backLabel="Back to dashboards"
      status={dashboard?.status}
      loading={loading}
      error={error}
      onRefresh={() => void load()}
      busy={busy}
      actions={
        <ModuleWorkflowActions actions={actions} busy={busy} onAction={(a) => void onWorkflow(a)} />
      }
    >
      {dashboard ? (
        <div className="space-y-6">
          {workflowError ? (
            <p className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {workflowError}
            </p>
          ) : null}
          <ModuleDetailSection title="Dashboard Info">
            <ModuleDetailGrid
              items={[
                { label: "Number", value: textOrDash(dashboard.dashboard_number) },
                { label: "Type", value: textOrDash(dashboard.dashboard_type) },
                { label: "Published", value: textOrDash(dashboard.published_at) },
                { label: "Status", value: <FinanceStatusBadge status={dashboard.status} /> },
              ]}
            />
          </ModuleDetailSection>

          <ModuleDetailSection title="Add KPI to dashboard">
            <div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4">
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-muted-foreground">KPI *</span>
                <select
                  value={kpiId}
                  onChange={(e) => setKpiId(e.target.value)}
                  className="flex h-9 w-full cursor-pointer rounded-md border border-input bg-background px-3 text-sm shadow-none"
                >
                  <option value="">Select…</option>
                  {kpis.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.kpi_name} ({row.kpi_code})
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-muted-foreground">Widget type</span>
                <select
                  value={widgetType}
                  onChange={(e) => setWidgetType(e.target.value)}
                  className="flex h-9 w-full cursor-pointer rounded-md border border-input bg-background px-3 text-sm shadow-none"
                >
                  <option value="kpi_tile">KPI tile</option>
                  <option value="chart">Chart</option>
                </select>
              </label>
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-muted-foreground">Title</span>
                <Input
                  value={widgetTitle}
                  onChange={(e) => setWidgetTitle(e.target.value)}
                  placeholder="Defaults to KPI name"
                  className="shadow-none"
                />
              </label>
              <div className="flex items-end">
                <Button
                  type="button"
                  className="cursor-pointer transition-colors duration-200"
                  disabled={busy}
                  onClick={() => void onAddKpi()}
                >
                  Add to dashboard
                </Button>
              </div>
            </div>
          </ModuleDetailSection>

          <ModuleDetailSection title="Widgets">
            {widgets.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">No widgets configured.</p>
            ) : (
              <div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3">
                {widgets.map((w) => (
                  <WidgetRenderer key={w.id} widget={w} />
                ))}
              </div>
            )}
          </ModuleDetailSection>
        </div>
      ) : null}
    </ModuleDetailPage>
  );
}
