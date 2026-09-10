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
import { ANALYTICS_SOURCE_KPI_KEYS } from "@/config/analytics-source-keys";
import { ApiClientError } from "@/services/api-client";
import {
  analyticsKpiAction,
  getAnalyticsKpi,
  updateAnalyticsKpi,
  type AnalyticsKpi,
} from "@/services/analytics-service";

function variance(target: number | null, actual: number | null): string {
  if (target == null || actual == null) return "—";
  const diff = actual - target;
  const pct = target !== 0 ? ((diff / target) * 100).toFixed(1) : "—";
  return `${diff >= 0 ? "+" : ""}${diff.toFixed(2)} (${pct}%)`;
}

export function KpiDetailPage({ kpiId }: { kpiId: string }) {
  const [kpi, setKpi] = useState<AnalyticsKpi | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [kpiName, setKpiName] = useState("");
  const [sourceKey, setSourceKey] = useState("");
  const [targetValue, setTargetValue] = useState("");
  const [direction, setDirection] = useState("higher_better");
  const [periodGrain, setPeriodGrain] = useState("month");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const row = await getAnalyticsKpi(kpiId);
      setKpi(row);
      setKpiName(row.kpi_name);
      setSourceKey(row.source_kpi_key ?? "");
      setTargetValue(row.target_value == null ? "" : String(row.target_value));
      setDirection(row.direction ?? "higher_better");
      setPeriodGrain(row.period_grain ?? "month");
    } catch (err) {
      setKpi(null);
      setError(err instanceof ApiClientError ? err.message : "Failed to load KPI");
    } finally {
      setLoading(false);
    }
  }, [kpiId]);

  useEffect(() => {
    void load();
  }, [load]);

  const actions = useMemo(() => {
    if (!kpi) return [];
    const s = kpi.status.toLowerCase();
    if (s === "draft") return [{ key: "submit", label: "Submit KPI" }];
    if (s === "submitted") return [{ key: "approve", label: "Activate" }];
    return [];
  }, [kpi]);

  const health = useMemo(() => {
    if (!kpi || kpi.current_value == null || kpi.target_value == null) return "unknown";
    const v = kpi.current_value ?? 0;
    if (kpi.critical_threshold != null && v <= kpi.critical_threshold) return "critical";
    if (kpi.warning_threshold != null && v <= kpi.warning_threshold) return "warning";
    return "healthy";
  }, [kpi]);

  async function onWorkflow(action: string) {
    if (!kpi) return;
    setBusy(true);
    try {
      await analyticsKpiAction(kpi.id, action as "submit" | "approve");
      await load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Workflow failed");
    } finally {
      setBusy(false);
    }
  }

  async function onSave() {
    if (!kpi || !kpiName.trim()) {
      setError("KPI name is required");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await updateAnalyticsKpi(kpi.id, {
        kpi_name: kpiName.trim(),
        source_kpi_key: sourceKey || null,
        target_value: targetValue.trim() === "" ? null : Number(targetValue),
        direction,
        period_grain: periodGrain,
      });
      setEditing(false);
      await load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to save KPI");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModuleDetailPage
      title={kpi?.kpi_name ?? "KPI"}
      subtitle="KPI engine — FRD-18 §6"
      backHref="/analytics/kpis"
      backLabel="Back to KPIs"
      status={kpi?.status}
      loading={loading}
      error={error}
      onRefresh={() => void load()}
      busy={busy}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="cursor-pointer shadow-none transition-colors duration-200"
            disabled={busy}
            onClick={() => setEditing((open) => !open)}
          >
            {editing ? "Cancel edit" : "Edit KPI"}
          </Button>
          <ModuleWorkflowActions actions={actions} busy={busy} onAction={(a) => void onWorkflow(a)} />
        </div>
      }
    >
      {kpi ? (
        <div className="space-y-6">
          {editing ? (
            <ModuleDetailSection title="Edit KPI">
              <div className="grid gap-4 p-4 sm:grid-cols-2">
                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-muted-foreground">Name *</span>
                  <Input value={kpiName} onChange={(e) => setKpiName(e.target.value)} className="shadow-none" />
                </label>
                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-muted-foreground">Source key</span>
                  <select
                    value={sourceKey}
                    onChange={(e) => setSourceKey(e.target.value)}
                    className="flex h-9 w-full cursor-pointer rounded-md border border-input bg-background px-3 text-sm shadow-none"
                  >
                    <option value="">None</option>
                    {ANALYTICS_SOURCE_KPI_KEYS.map((key) => (
                      <option key={key} value={key}>
                        {key}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-muted-foreground">Target</span>
                  <Input
                    type="number"
                    value={targetValue}
                    onChange={(e) => setTargetValue(e.target.value)}
                    className="shadow-none"
                  />
                </label>
                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-muted-foreground">Direction</span>
                  <select
                    value={direction}
                    onChange={(e) => setDirection(e.target.value)}
                    className="flex h-9 w-full cursor-pointer rounded-md border border-input bg-background px-3 text-sm shadow-none"
                  >
                    <option value="higher_better">Higher is better</option>
                    <option value="lower_better">Lower is better</option>
                  </select>
                </label>
                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-muted-foreground">Period</span>
                  <select
                    value={periodGrain}
                    onChange={(e) => setPeriodGrain(e.target.value)}
                    className="flex h-9 w-full cursor-pointer rounded-md border border-input bg-background px-3 text-sm shadow-none"
                  >
                    <option value="day">Day</option>
                    <option value="week">Week</option>
                    <option value="month">Month</option>
                    <option value="quarter">Quarter</option>
                    <option value="year">Year</option>
                  </select>
                </label>
                <div className="flex items-end">
                  <Button
                    type="button"
                    className="cursor-pointer transition-colors duration-200"
                    disabled={busy}
                    onClick={() => void onSave()}
                  >
                    Save changes
                  </Button>
                </div>
              </div>
            </ModuleDetailSection>
          ) : null}
          <ModuleDetailSection title="KPI Performance">
            <ModuleDetailGrid
              items={[
                { label: "Code", value: textOrDash(kpi.kpi_code) },
                { label: "Source", value: textOrDash(kpi.source_kpi_key) },
                { label: "Target", value: textOrDash(kpi.target_value) },
                { label: "Actual", value: textOrDash(kpi.current_value) },
                { label: "Variance", value: variance(kpi.target_value, kpi.current_value) },
                { label: "Direction", value: textOrDash(kpi.direction) },
                { label: "Health", value: <FinanceStatusBadge status={health} /> },
              ]}
            />
          </ModuleDetailSection>
        </div>
      ) : null}
    </ModuleDetailPage>
  );
}
