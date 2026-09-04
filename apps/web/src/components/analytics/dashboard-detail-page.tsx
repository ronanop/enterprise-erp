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
import { ApiClientError } from "@/services/api-client";
import { WidgetRenderer } from "@/components/analytics/WidgetRenderer";
import {
  analyticsDashboardAction,
  getAnalyticsDashboard,
  listDashboardWidgets,
  type AnalyticsDashboard,
  type AnalyticsWidget,
} from "@/services/analytics-service";

export function DashboardDetailPage({ dashboardId }: { dashboardId: string }) {
  const [dashboard, setDashboard] = useState<AnalyticsDashboard | null>(null);
  const [widgets, setWidgets] = useState<AnalyticsWidget[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [workflowError, setWorkflowError] = useState<string | null>(null);

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    setError(null);
    try {
      const [d, w] = await Promise.all([
        getAnalyticsDashboard(dashboardId),
        listDashboardWidgets(dashboardId),
      ]);
      setDashboard(d);
      setWidgets(w.sort((a, b) => a.sequence_no - b.sequence_no));
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

          <ModuleDetailSection title="Widgets">
            {widgets.length === 0 ? (
              <p className="text-sm text-muted-foreground">No widgets configured.</p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
