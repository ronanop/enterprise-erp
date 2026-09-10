"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import { FinanceKpiCard } from "@/components/finance/finance-kpi-card";
import { ModuleDetailPage, ModuleDetailSection } from "@/components/module/module-detail-ui";
import { Target } from "lucide-react";
import {
  loadExecutiveDashboards,
  loadExecutiveKpis,
  type AnalyticsDashboard,
  type AnalyticsKpi,
} from "@/services/analytics-service";

export function ExecutiveDashboardPage() {
  const [kpis, setKpis] = useState<AnalyticsKpi[]>([]);
  const [dashboards, setDashboards] = useState<AnalyticsDashboard[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [k, d] = await Promise.all([loadExecutiveKpis(), loadExecutiveDashboards()]);
      setKpis(k.slice(0, 12));
      setDashboards(d);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <ModuleDetailPage
      title="Executive Dashboard"
      subtitle="Cross-module KPIs — Finance, Sales, Ops, HR (FRD-18 §4)"
      backHref="/analytics"
      backLabel="Analytics home"
      loading={loading}
      onRefresh={() => void load()}
    >
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {kpis.map((kpi) => (
            <Link key={kpi.id} href={`/analytics/kpis/${kpi.id}`}>
              <FinanceKpiCard
                icon={Target}
                label={kpi.kpi_name}
                value={kpi.current_value != null ? String(kpi.current_value) : "—"}
                hint={kpi.target_value != null ? `Target: ${kpi.target_value}` : undefined}
              />
            </Link>
          ))}
        </div>

        <ModuleDetailSection title="Executive Dashboards">
          {dashboards.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No executive dashboards published yet. Create one under Dashboards with type
              &quot;executive&quot;.
            </p>
          ) : (
            <ul className="space-y-2">
              {dashboards.map((d) => (
                <li key={d.id}>
                  <Link
                    href={`/analytics/dashboards/${d.id}`}
                    className="text-sm font-medium text-primary hover:underline"
                  >
                    {d.dashboard_name} · {d.status}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </ModuleDetailSection>

        <ModuleDetailSection title="Data Sources (Upstream)">
          <p className="text-sm text-muted-foreground">
            BI consumes operational data from Finance, CRM, Sales, Procurement, Inventory,
            Manufacturing, HR, Projects, Quality, and Helpdesk modules per FRD-18 cross-references.
            Configure datasets under{" "}
            <Link href="/analytics/datasets" className="text-primary hover:underline">
              Datasets
            </Link>{" "}
            to wire additional sources.
          </p>
        </ModuleDetailSection>
      </div>
    </ModuleDetailPage>
  );
}
