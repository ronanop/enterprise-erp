"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  ModuleDetailGrid,
  ModuleDetailPage,
  ModuleDetailSection,
  ModuleTimeline,
  ModuleWorkflowActions,
  textOrDash,
} from "@/components/module/module-detail-ui";
import { FinanceStatusBadge } from "@/components/finance/finance-status-badge";
import { ApiClientError } from "@/services/api-client";
import {
  analyticsReportAction,
  getAnalyticsReport,
  listReportExecutions,
  type AnalyticsReport,
} from "@/services/analytics-service";

export function ReportDetailPage({ reportId }: { reportId: string }) {
  const [report, setReport] = useState<AnalyticsReport | null>(null);
  const [executions, setExecutions] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [r, e] = await Promise.all([getAnalyticsReport(reportId), listReportExecutions(reportId)]);
      setReport(r);
      setExecutions(e);
    } catch (err) {
      setReport(null);
      setError(err instanceof ApiClientError ? err.message : "Failed to load report");
    } finally {
      setLoading(false);
    }
  }, [reportId]);

  useEffect(() => {
    void load();
  }, [load]);

  const actions = useMemo(() => {
    if (!report) return [];
    const s = report.status.toLowerCase();
    const base: { key: string; label: string; variant?: "default" | "outline" }[] = [];
    if (s === "draft") base.push({ key: "submit", label: "Submit" });
    if (s === "submitted") base.push({ key: "approve", label: "Approve" });
    if (s === "approved") base.push({ key: "publish", label: "Publish" });
    base.push({ key: "run", label: "Run now", variant: "outline" });
    return base;
  }, [report]);

  async function onWorkflow(action: string) {
    if (!report) return;
    setBusy(true);
    try {
      await analyticsReportAction(report.id, action as "submit" | "approve" | "publish" | "run");
      await load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModuleDetailPage
      title={report?.report_name ?? "Report"}
      subtitle={`${report?.report_type ?? ""} report — cross-module data (FRD-18 §7)`}
      backHref="/analytics/reports"
      backLabel="Back to reports"
      status={report?.status}
      loading={loading}
      error={error}
      onRefresh={() => void load()}
      busy={busy}
      actions={
        <ModuleWorkflowActions actions={actions} busy={busy} onAction={(a) => void onWorkflow(a)} />
      }
    >
      {report ? (
        <div className="space-y-6">
          <ModuleDetailSection title="Report Definition">
            <ModuleDetailGrid
              items={[
                { label: "Number", value: textOrDash(report.report_number) },
                { label: "Type", value: textOrDash(report.report_type) },
                { label: "Format", value: textOrDash(report.output_format) },
                { label: "Status", value: <FinanceStatusBadge status={report.status} /> },
              ]}
            />
          </ModuleDetailSection>

          <ModuleDetailSection title="Execution History">
            <ModuleTimeline
              items={executions.map((e) => ({
                id: String(e.id),
                title: String(e.execution_number ?? e.status ?? "Run"),
                subtitle: String(e.output_format ?? ""),
                at: e.completed_at ? String(e.completed_at) : undefined,
              }))}
            />
          </ModuleDetailSection>
        </div>
      ) : null}
    </ModuleDetailPage>
  );
}
