"use client";

import { useCallback, useEffect, useState } from "react";
import { Activity, AlertTriangle, Gauge, RefreshCw, Users } from "lucide-react";

import { FinanceKpiCard } from "@/components/finance/finance-kpi-card";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { loadWorkloadOverview, type WorkloadOverview } from "@/services/marketing-service";

const EMPTY: WorkloadOverview = {
  company: {
    active_tasks: 0,
    pending_reviews: 0,
    delayed_tasks: 0,
    workload_score: 0,
    utilization_pct: 0,
  },
  me: {
    active_tasks: 0,
    pending_reviews: 0,
    delayed_tasks: 0,
    workload_score: 0,
    utilization_pct: 0,
    completed_tasks: 0,
    actual_hours: 0,
  },
  people: [],
  overloaded: [],
  underutilized: [],
  campaign_health: [],
};

export function MarketingOperationsBoard() {
  const [data, setData] = useState<WorkloadOverview>(EMPTY);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await loadWorkloadOverview());
    } catch {
      setData(EMPTY);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Marketing Operations"
        description="Campaign health, resource utilization, delayed work, and executive bottlenecks."
        actions={
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="cursor-pointer transition-colors duration-200"
            onClick={() => void load()}
          >
            <RefreshCw className="size-3.5" aria-hidden />
            Refresh
          </Button>
        }
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <FinanceKpiCard
          label="Workload score"
          value={loading ? "—" : String(data.company.workload_score)}
          icon={Gauge}
        />
        <FinanceKpiCard
          label="Active tasks"
          value={loading ? "—" : String(data.company.active_tasks)}
          icon={Activity}
        />
        <FinanceKpiCard
          label="Delayed"
          value={loading ? "—" : String(data.company.delayed_tasks)}
          tone={data.company.delayed_tasks > 0 ? "warning" : "default"}
          icon={AlertTriangle}
        />
        <FinanceKpiCard
          label="Utilization"
          value={loading ? "—" : `${data.company.utilization_pct}%`}
          icon={Users}
        />
      </div>
      <section className="rounded-md border border-border/70 bg-card">
        <header className="border-b border-border/60 px-3 py-2">
          <h2 className="text-sm font-semibold">Campaign health</h2>
        </header>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-xs">
            <thead className="border-b border-border/60 text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Campaign</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Priority</th>
                <th className="px-3 py-2 font-medium">Tasks</th>
                <th className="px-3 py-2 font-medium">Done</th>
                <th className="px-3 py-2 font-medium">Delayed</th>
              </tr>
            </thead>
            <tbody>
              {data.campaign_health.length === 0 ? (
                <tr>
                  <td className="px-3 py-4 text-muted-foreground" colSpan={6}>
                    No campaigns yet.
                  </td>
                </tr>
              ) : (
                data.campaign_health.map((row) => (
                  <tr key={row.campaign_id} className="border-b border-border/40 last:border-0">
                    <td className="px-3 py-2 font-medium">{row.campaign_name}</td>
                    <td className="px-3 py-2">
                      <Badge variant="secondary" className="text-[10px] uppercase">
                        {row.status}
                      </Badge>
                    </td>
                    <td className="px-3 py-2">{row.priority ?? "medium"}</td>
                    <td className="px-3 py-2 font-mono tabular-nums">{row.task_count}</td>
                    <td className="px-3 py-2 font-mono tabular-nums">{row.completed}</td>
                    <td className="px-3 py-2 font-mono tabular-nums">{row.delayed}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
