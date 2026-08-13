"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { RefreshCw, TrendingUp } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import {
  ProjectsErrorBanner,
  ProjectsHeadlineBand,
  ProjectsHeadlineStat,
  ProjectsListPanel,
  ProjectsListToolbar,
  ProjectsPage,
  ProjectsSortableTh,
  sortRows,
  useTableSort,
} from "@/components/projects/projects-ui";
import { Button } from "@/components/ui/button";
import { ApiClientError } from "@/services/api-client";
import {
  formatHours,
  formatInr,
  listProjectBudgets,
  listProjectCosts,
  listProjects,
  listTimesheetEntries,
  num,
  sumBy,
} from "@/services/projects-portal-service";
import { cn } from "@/lib/utils";

type Row = {
  id: string;
  code: string;
  name: string;
  status: string;
  budget: number;
  cost: number;
  variance: number;
  burnPct: number;
  hours: number;
};

const COLUMNS = [
  { key: "code", label: "Project", align: "left" as const },
  { key: "budget", label: "Budget", align: "right" as const },
  { key: "cost", label: "Actual Cost", align: "right" as const },
  { key: "variance", label: "Variance", align: "right" as const },
  { key: "burnPct", label: "Burn", align: "right" as const },
  { key: "hours", label: "Hours", align: "right" as const },
];

export function ProjectProfitabilityPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { sortBy, sortDir, onSort } = useTableSort<string>("variance", "asc");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [projects, budgets, costs, entries] = await Promise.all([
        listProjects(),
        listProjectBudgets().catch(() => []),
        listProjectCosts().catch(() => []),
        listTimesheetEntries().catch(() => []),
      ]);

      const budgetByProject = new Map<string, number>();
      for (const b of budgets) {
        budgetByProject.set(b.project_id, (budgetByProject.get(b.project_id) ?? 0) + num(b.budget_amount));
      }
      const costByProject = new Map<string, number>();
      for (const c of costs) {
        costByProject.set(c.project_id, (costByProject.get(c.project_id) ?? 0) + num(c.cost_amount));
      }
      const hoursByProject = new Map<string, number>();
      for (const e of entries) {
        hoursByProject.set(e.project_id, (hoursByProject.get(e.project_id) ?? 0) + num(e.hours_worked));
      }

      setRows(
        projects.map((p) => {
          // Fall back to the project header budget when no budget lines exist yet.
          const budget = budgetByProject.get(p.id) ?? num(p.budget_amount);
          const cost = costByProject.get(p.id) ?? 0;
          return {
            id: p.id,
            code: p.project_code,
            name: p.project_name,
            status: p.status,
            budget,
            cost,
            variance: budget - cost,
            burnPct: budget > 0 ? Math.round((cost / budget) * 100) : 0,
            hours: hoursByProject.get(p.id) ?? 0,
          };
        }),
      );
    } catch (err) {
      setRows([]);
      setError(err instanceof ApiClientError ? err.message : "Failed to load profitability data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const sorted = useMemo(
    () =>
      sortRows(rows, sortBy, sortDir, {
        code: (r) => r.code,
        budget: (r) => r.budget,
        cost: (r) => r.cost,
        variance: (r) => r.variance,
        burnPct: (r) => r.burnPct,
        hours: (r) => r.hours,
      }),
    [rows, sortBy, sortDir],
  );

  const totals = useMemo(() => {
    const budget = sumBy(rows, (r) => r.budget);
    const cost = sumBy(rows, (r) => r.cost);
    return {
      budget,
      cost,
      variance: budget - cost,
      burnPct: budget > 0 ? Math.round((cost / budget) * 100) : 0,
      overrun: rows.filter((r) => r.variance < 0).length,
      hours: sumBy(rows, (r) => r.hours),
    };
  }, [rows]);

  return (
    <ProjectsPage>
      <PageHeader
        title="Project Profitability"
        description="Budget versus actual cost for every project, with effort logged and overrun exposure."
        actions={
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="cursor-pointer"
            onClick={() => void load()}
            disabled={loading}
          >
            <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
            Refresh
          </Button>
        }
      />

      {error ? <ProjectsErrorBanner>{error}</ProjectsErrorBanner> : null}

      <ProjectsHeadlineBand>
        <div className="grid divide-y divide-white/10 sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4">
          <ProjectsHeadlineStat
            label="Budget"
            value={formatInr(totals.budget)}
            sub={`${rows.length} projects`}
            loading={loading}
          />
          <ProjectsHeadlineStat
            label="Actual cost"
            value={formatInr(totals.cost)}
            sub={`${totals.burnPct}% consumed`}
            loading={loading}
          />
          <ProjectsHeadlineStat
            label="Variance"
            value={formatInr(totals.variance)}
            sub={`${totals.overrun} project(s) over budget`}
            loading={loading}
          />
          <ProjectsHeadlineStat
            label="Hours logged"
            value={totals.hours.toFixed(1)}
            sub="From approved and draft entries"
            loading={loading}
          />
        </div>
      </ProjectsHeadlineBand>

      <ProjectsListPanel>
        <ProjectsListToolbar
          title="Cost control"
          subtitle="Budget vs actual by project"
          icon={TrendingUp}
          count={sorted.length}
        />
        <div className="erp-scroll overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead>
              <tr className="border-b border-border/70 bg-muted/40 text-[11px] tracking-wide text-muted-foreground uppercase">
                {COLUMNS.map((col) => (
                  <ProjectsSortableTh
                    key={col.key}
                    label={col.label}
                    sortKey={col.key}
                    activeKey={sortBy}
                    dir={sortDir}
                    onSort={onSort}
                    align={col.align}
                  />
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={COLUMNS.length} className="px-4 py-10 text-center text-muted-foreground">
                    Loading profitability…
                  </td>
                </tr>
              ) : sorted.length === 0 ? (
                <tr>
                  <td colSpan={COLUMNS.length} className="px-4 py-10 text-center text-muted-foreground">
                    No projects to report on yet.
                  </td>
                </tr>
              ) : (
                sorted.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-border/50 transition-colors last:border-0 hover:bg-accent/30"
                  >
                    <td className="px-4 py-2.5">
                      <Link
                        href={`/projects/projects/${row.id}`}
                        className="cursor-pointer font-medium text-foreground hover:underline"
                      >
                        {row.name}
                      </Link>
                      <p className="font-mono text-[11px] text-muted-foreground">{row.code}</p>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-foreground">
                      {formatInr(row.budget)}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-foreground">
                      {formatInr(row.cost)}
                    </td>
                    <td
                      className={cn(
                        "px-4 py-2.5 text-right font-medium tabular-nums",
                        row.variance < 0 ? "text-destructive" : "text-emerald-700",
                      )}
                    >
                      {formatInr(row.variance)}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-end gap-2">
                        <span className="tabular-nums text-muted-foreground">{row.burnPct}%</span>
                        <span className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                          <span
                            className={cn(
                              "block h-full rounded-full transition-[width] duration-300",
                              row.burnPct > 100
                                ? "bg-red-500"
                                : row.burnPct > 85
                                  ? "bg-amber-500"
                                  : "bg-emerald-600",
                            )}
                            style={{ width: `${Math.min(100, Math.max(2, row.burnPct))}%` }}
                          />
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                      {formatHours(row.hours)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </ProjectsListPanel>
    </ProjectsPage>
  );
}
