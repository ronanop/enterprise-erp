"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { QmFormShell, QmSelectField, QmTextField } from "@/components/quality/quality-form-fields";
import { useQmSubmit } from "@/components/quality/use-qm-submit";
import { ANALYTICS_SOURCE_KPI_KEYS } from "@/config/analytics-source-keys";
import { createAnalyticsDashboard, createAnalyticsKpi } from "@/services/analytics-service";

const SOURCE_OPTIONS = ANALYTICS_SOURCE_KPI_KEYS.map((key) => ({ id: key, label: key }));

export function KpiCreatePage() {
  const router = useRouter();
  const { saving, statusMessage, error, setError, run } = useQmSubmit();
  const [kpiName, setKpiName] = useState("");
  const [kpiCode, setKpiCode] = useState("");
  const [sourceKey, setSourceKey] = useState("");
  const [targetValue, setTargetValue] = useState("");
  const [direction, setDirection] = useState("higher_better");
  const [periodGrain, setPeriodGrain] = useState("month");

  async function onSubmit() {
    if (!kpiName.trim()) {
      setError("KPI name is required");
      return;
    }
    const ok = await run("Creating KPI…", async () => {
      const created = await createAnalyticsKpi({
        kpi_name: kpiName.trim(),
        kpi_code: kpiCode.trim() || undefined,
        source_kpi_key: sourceKey || null,
        target_value: targetValue.trim() === "" ? null : Number(targetValue),
        direction,
        period_grain: periodGrain,
      });
      router.push(`/analytics/kpis/${created.id}`);
    });
    if (!ok) return;
  }

  return (
    <QmFormShell
      title="New KPI"
      description="Define a KPI and optionally bind it to a live source key."
      backHref="/analytics/kpis"
      backLabel="Back to KPIs"
      onSubmit={onSubmit}
      saving={saving}
      statusMessage={statusMessage}
      error={error}
      submitLabel="Create KPI"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <QmTextField label="Name" value={kpiName} onChange={setKpiName} required />
        <QmTextField
          label="Code"
          value={kpiCode}
          onChange={setKpiCode}
          placeholder="Auto from name if empty"
        />
        <QmSelectField
          label="Source key"
          value={sourceKey}
          onChange={setSourceKey}
          options={SOURCE_OPTIONS}
        />
        <QmTextField
          label="Target"
          value={targetValue}
          onChange={setTargetValue}
          type="number"
          placeholder="Optional"
        />
        <QmSelectField
          label="Direction"
          value={direction}
          onChange={setDirection}
          options={[
            { id: "higher_better", label: "Higher is better" },
            { id: "lower_better", label: "Lower is better" },
          ]}
          required
        />
        <QmSelectField
          label="Period"
          value={periodGrain}
          onChange={setPeriodGrain}
          options={[
            { id: "day", label: "Day" },
            { id: "week", label: "Week" },
            { id: "month", label: "Month" },
            { id: "quarter", label: "Quarter" },
            { id: "year", label: "Year" },
          ]}
          required
        />
      </div>
    </QmFormShell>
  );
}

export function DashboardCreatePage() {
  const router = useRouter();
  const { saving, statusMessage, error, setError, run } = useQmSubmit();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [dashboardType, setDashboardType] = useState("operational");
  const [audienceRole, setAudienceRole] = useState("");

  async function onSubmit() {
    if (!name.trim()) {
      setError("Dashboard name is required");
      return;
    }
    await run("Creating dashboard…", async () => {
      const created = await createAnalyticsDashboard({
        dashboard_name: name.trim(),
        dashboard_code: code.trim() || undefined,
        dashboard_type: dashboardType,
        audience_role: audienceRole.trim() || null,
      });
      router.push(`/analytics/dashboards/${created.id}`);
    });
  }

  return (
    <QmFormShell
      title="New dashboard"
      description="Create an operational, executive, or self-service dashboard."
      backHref="/analytics/dashboards"
      backLabel="Back to dashboards"
      onSubmit={onSubmit}
      saving={saving}
      statusMessage={statusMessage}
      error={error}
      submitLabel="Create dashboard"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <QmTextField label="Name" value={name} onChange={setName} required />
        <QmTextField
          label="Code"
          value={code}
          onChange={setCode}
          placeholder="Auto from name if empty"
        />
        <QmSelectField
          label="Type"
          value={dashboardType}
          onChange={setDashboardType}
          options={[
            { id: "operational", label: "Operational" },
            { id: "executive", label: "Executive" },
            { id: "self_service", label: "Self-service" },
          ]}
          required
        />
        <QmTextField
          label="Audience role"
          value={audienceRole}
          onChange={setAudienceRole}
          placeholder="Optional, e.g. ceo"
        />
      </div>
    </QmFormShell>
  );
}
