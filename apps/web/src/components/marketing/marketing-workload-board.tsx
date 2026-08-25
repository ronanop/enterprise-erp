"use client";

import { useCallback, useEffect, useState } from "react";
import { Gauge, RefreshCw, Users } from "lucide-react";

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

export function MarketingWorkloadBoard() {
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
        title="Workload & resources"
        description="Capacity, utilization, overload, and reassignment signals across the marketing team."
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
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <FinanceKpiCard
          label="Overloaded"
          value={loading ? "—" : String(data.overloaded.length)}
          tone={data.overloaded.length ? "warning" : "success"}
          icon={Users}
        />
        <FinanceKpiCard
          label="Underutilized"
          value={loading ? "—" : String(data.underutilized.length)}
          icon={Gauge}
        />
        <FinanceKpiCard
          label="My utilization"
          value={loading ? "—" : `${data.me.utilization_pct}%`}
          hint={`${data.me.active_tasks} active tasks`}
          icon={Gauge}
        />
      </div>
      <div className="overflow-x-auto rounded-md border border-border/70">
        <table className="w-full min-w-[560px] text-left text-xs">
          <thead className="border-b border-border/60 bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">User</th>
              <th className="px-3 py-2 font-medium">Score</th>
              <th className="px-3 py-2 font-medium">Utilization</th>
              <th className="px-3 py-2 font-medium">Active</th>
              <th className="px-3 py-2 font-medium">Balance</th>
            </tr>
          </thead>
          <tbody>
            {data.people.length === 0 ? (
              <tr>
                <td className="px-3 py-4 text-muted-foreground" colSpan={5}>
                  No assigned work yet.
                </td>
              </tr>
            ) : (
              data.people.map((row) => (
                <tr key={row.user_id} className="border-b border-border/40 last:border-0">
                  <td className="px-3 py-2 font-mono text-[11px]">{row.user_id.slice(0, 8)}</td>
                  <td className="px-3 py-2 font-mono tabular-nums">{row.workload_score}</td>
                  <td className="px-3 py-2 font-mono tabular-nums">{row.utilization_pct}%</td>
                  <td className="px-3 py-2 font-mono tabular-nums">{row.active_tasks}</td>
                  <td className="px-3 py-2">
                    <Badge variant="secondary" className="text-[10px] uppercase">
                      {row.reassignment}
                    </Badge>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
