"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  BarChart3,
  CalendarDays,
  ClipboardList,
  FileText,
  FolderKanban,
  GitPullRequestArrow,
  PieChart,
  RefreshCw,
  Scale,
  Target,
  Timer,
  Users,
} from "lucide-react";

import { HealthDot } from "@/components/projects/projects-badges";
import {
  PROJECTS_CHART_COLORS,
  ProjectsActivityTile,
  ProjectsCountBarChart,
  ProjectsDonutChart,
  ProjectsHeadlineBand,
  ProjectsHeadlineStat,
  ProjectsIconBadge,
  ProjectsKpiCard,
  ProjectsListPanel,
  ProjectsPage,
  ProjectsSection,
  ProjectsValueBarChart,
  ProjectsViewAllLink,
  ProjectsWarnBanner,
} from "@/components/projects/projects-ui";
import { FinanceStatusBadge } from "@/components/finance/finance-status-badge";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { projectsPipelineStages } from "@/config/projects";
import { isAuthenticated } from "@/lib/auth";
import {
  countIn,
  countNotIn,
  formatDate,
  formatInr,
  humanizeStatus,
  loadProjectsOverview,
  num,
  sumBy,
  type Project,
  type ProjectsOverview,
} from "@/services/projects-portal-service";

/** Portfolio lifecycle stages — FRD-11 §4 project statuses. */
const LIFECYCLE = [
  { key: "draft", label: "Draft" },
  { key: "submitted", label: "Submitted" },
  { key: "approved", label: "Approved" },
  { key: "in_progress", label: "In progress" },
  { key: "on_hold", label: "On hold" },
  { key: "completed", label: "Completed" },
] as const;

const STAGE_COLORS = [
  PROJECTS_CHART_COLORS.sky,
  PROJECTS_CHART_COLORS.skyDark,
  PROJECTS_CHART_COLORS.teal,
  PROJECTS_CHART_COLORS.emerald,
  PROJECTS_CHART_COLORS.slate,
] as const;

const ACTIVE_STATUSES = ["approved", "in_progress"];

function newestProjects(rows: Project[], limit = 6): Project[] {
  return [...rows]
    .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""))
    .slice(0, limit);
}

export function ProjectsDashboard() {
  const [data, setData] = useState<ProjectsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const authenticated = typeof window !== "undefined" ? isAuthenticated() : false;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await loadProjectsOverview());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const kpis = useMemo(() => {
    const projects = data?.projects ?? [];
    const tasks = data?.tasks ?? [];
    const budgets = data?.budgets ?? [];
    const costs = data?.costs ?? [];

    const budgetTotal = sumBy(budgets, (b) => b.budget_amount);
    const costTotal = sumBy(costs, (c) => c.cost_amount);

    return {
      active: countIn(projects, ACTIVE_STATUSES),
      atRisk: projects.filter((p) => p.health_status === "red").length,
      openTasks: countNotIn(tasks, ["completed", "cancelled"]),
      blockedTasks: countIn(tasks, ["blocked"]),
      pendingTimesheets: countIn(data?.timesheets ?? [], ["submitted"]),
      openIssues: countNotIn(data?.issues ?? [], ["resolved", "closed", "cancelled"]),
      openRisks: countNotIn(data?.risks ?? [], ["closed", "cancelled", "accepted"]),
      pendingChanges: countIn(data?.changeRequests ?? [], ["submitted"]),
      portfolioValue: sumBy(projects, (p) => p.budget_amount),
      budgetTotal,
      costTotal,
      burnPct: budgetTotal > 0 ? Math.round((costTotal / budgetTotal) * 100) : 0,
      loggedHours: sumBy(data?.entries ?? [], (e) => e.hours_worked),
      milestonesAchieved: countIn(data?.milestones ?? [], ["achieved"]),
    };
  }, [data]);

  const funnelChart = useMemo(() => {
    const counts: Record<string, number> = {
      projects: data?.projects.length ?? 0,
      "project-phases": data?.phases.length ?? 0,
      "project-milestones": data?.milestones.length ?? 0,
      "project-tasks": data?.tasks.length ?? 0,
      timesheets: data?.timesheets.length ?? 0,
      "project-budgets": data?.budgets.length ?? 0,
    };
    return projectsPipelineStages.map((stage) => ({
      name: stage.title,
      count: counts[stage.resource] ?? 0,
    }));
  }, [data]);

  const lifecycleDonut = useMemo(() => {
    const rows = data?.projects ?? [];
    return LIFECYCLE.map((s) => ({
      name: s.label,
      value: countIn(rows, [s.key]),
    })).filter((d) => d.value > 0);
  }, [data]);

  const budgetByType = useMemo(() => {
    const rows = data?.budgets ?? [];
    const totals = new Map<string, number>();
    for (const row of rows) {
      totals.set(row.budget_type, (totals.get(row.budget_type) ?? 0) + num(row.budget_amount));
    }
    return [...totals.entries()]
      .map(([type, value]) => ({ name: humanizeStatus(type), value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [data]);

  const recent = useMemo(() => newestProjects(data?.projects ?? []), [data]);

  const dueTasks = useMemo(() => {
    const rows = (data?.tasks ?? []).filter(
      (t) => !["completed", "cancelled"].includes(t.status) && t.due_date,
    );
    return rows.sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? "")).slice(0, 6);
  }, [data]);

  const projectNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of data?.projects ?? []) map.set(p.id, p.project_name);
    return map;
  }, [data]);

  const authBlocked =
    Boolean(data?.statusCodes.includes(401)) || (!authenticated && Boolean(data?.partial));

  return (
    <ProjectsPage>
      <PageHeader
        title="Project Delivery Dashboard"
        description="Portfolio health, delivery progress, effort, and cost control across every active project."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="cursor-pointer"
              onClick={() => void load()}
              disabled={loading}
            >
              <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Link
              href="/projects/projects/new"
              className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground shadow-sm transition-opacity duration-200 hover:opacity-90"
            >
              <FolderKanban className="size-3.5" />
              New Project
            </Link>
            <Link
              href="/projects/task-board"
              className="inline-flex h-8 cursor-pointer items-center rounded-lg border border-border/80 bg-card px-3 text-sm font-medium shadow-sm transition-colors duration-200 hover:bg-muted"
            >
              Task Board
            </Link>
          </div>
        }
      />

      {authBlocked ? (
        <ProjectsWarnBanner>
          Sign in to load live project data.{" "}
          <Link href="/login" className="cursor-pointer font-medium underline underline-offset-2">
            Go to login
          </Link>
        </ProjectsWarnBanner>
      ) : null}

      {data?.partial && !authBlocked ? (
        <div className="rounded-xl border border-border/80 bg-muted/40 px-4 py-2.5 text-xs text-muted-foreground">
          Some project endpoints returned errors. Showing available records.
        </div>
      ) : null}

      <ProjectsHeadlineBand>
        <div className="grid divide-y divide-white/10 sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4">
          <ProjectsHeadlineStat
            label="Portfolio value"
            value={formatInr(kpis.portfolioValue)}
            sub={`${data?.projects.length ?? 0} projects · ${kpis.active} active`}
            loading={loading}
          />
          <ProjectsHeadlineStat
            label="Budget approved"
            value={formatInr(kpis.budgetTotal)}
            sub={`${data?.budgets.length ?? 0} budget lines`}
            loading={loading}
          />
          <ProjectsHeadlineStat
            label="Cost booked"
            value={formatInr(kpis.costTotal)}
            sub={`${kpis.burnPct}% of approved budget`}
            loading={loading}
          />
          <ProjectsHeadlineStat
            label="Hours logged"
            value={kpis.loggedHours.toFixed(1)}
            sub={`${data?.entries.length ?? 0} time entries`}
            loading={loading}
          />
        </div>
      </ProjectsHeadlineBand>

      <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
        <ProjectsKpiCard
          label="Active projects"
          value={String(kpis.active)}
          hint={`${kpis.atRisk} flagged red`}
          icon={FolderKanban}
          tone={kpis.atRisk > 0 ? "warning" : "default"}
          href="/projects/projects"
          loading={loading}
        />
        <ProjectsKpiCard
          label="Open tasks"
          value={String(kpis.openTasks)}
          hint={`${kpis.blockedTasks} blocked`}
          icon={ClipboardList}
          tone={kpis.blockedTasks > 0 ? "warning" : "default"}
          href="/projects/project-tasks"
          loading={loading}
        />
        <ProjectsKpiCard
          label="Timesheets to approve"
          value={String(kpis.pendingTimesheets)}
          hint={`${data?.timesheets.length ?? 0} sheets total`}
          icon={Timer}
          tone={kpis.pendingTimesheets > 0 ? "warning" : "success"}
          href="/projects/timesheets"
          loading={loading}
        />
        <ProjectsKpiCard
          label="Open issues"
          value={String(kpis.openIssues)}
          hint={`${kpis.openRisks} risks open · ${kpis.pendingChanges} changes pending`}
          icon={AlertTriangle}
          tone={kpis.openIssues > 0 ? "danger" : "success"}
          href="/projects/project-issues"
          loading={loading}
        />
      </div>

      <div className="grid gap-3 xl:grid-cols-3">
        <ProjectsSection
          title="Delivery funnel"
          subtitle="Project → Budget volume"
          icon={BarChart3}
          badge={<Badge variant="secondary">Counts</Badge>}
        >
          <ProjectsCountBarChart data={funnelChart} loading={loading} />
          <ol className="mt-1 flex flex-wrap gap-x-3 gap-y-1 border-t border-border/60 pt-2">
            {projectsPipelineStages.map((stage, i) => (
              <li key={stage.key}>
                <Link
                  href={stage.href}
                  className="inline-flex cursor-pointer items-center gap-1.5 text-[11px] text-muted-foreground transition-colors duration-200 hover:text-foreground"
                >
                  <span
                    className="size-1.5 rounded-full"
                    style={{ backgroundColor: STAGE_COLORS[i % STAGE_COLORS.length] }}
                  />
                  {stage.title}
                </Link>
              </li>
            ))}
          </ol>
        </ProjectsSection>

        <ProjectsSection
          title="Lifecycle mix"
          subtitle="All projects by status"
          icon={PieChart}
          badge={<Badge variant="secondary">Share</Badge>}
        >
          <ProjectsDonutChart data={lifecycleDonut} loading={loading} />
          <ul className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1 border-t border-border/60 pt-2">
            {LIFECYCLE.map((s, i) => {
              const count = countIn(data?.projects ?? [], [s.key]);
              if (!count && !loading) return null;
              return (
                <li key={s.key} className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="flex min-w-0 items-center gap-1.5 truncate text-muted-foreground">
                    <span
                      className="size-1.5 shrink-0 rounded-full"
                      style={{ backgroundColor: STAGE_COLORS[i % STAGE_COLORS.length] }}
                    />
                    {s.label}
                  </span>
                  <span className="font-medium tabular-nums text-foreground">
                    {loading ? "—" : count}
                  </span>
                </li>
              );
            })}
          </ul>
        </ProjectsSection>

        <ProjectsSection
          title="Budget by category"
          subtitle="Approved spend envelope"
          icon={Target}
          badge={<Badge variant="secondary">INR</Badge>}
        >
          <ProjectsValueBarChart data={budgetByType} loading={loading} formatValue={formatInr} />
        </ProjectsSection>
      </div>

      <div className="grid gap-3 xl:grid-cols-2">
        <ProjectsListPanel>
          <div className="flex items-center justify-between gap-2 border-b border-border/70 px-4 py-3">
            <div className="flex items-center gap-2.5">
              <ProjectsIconBadge icon={FolderKanban} />
              <div>
                <h2 className="text-sm font-medium tracking-tight">Recent projects</h2>
                <p className="text-[11px] text-muted-foreground">Newest in the portfolio</p>
              </div>
            </div>
            <ProjectsViewAllLink href="/projects/projects" />
          </div>
          <div className="erp-scroll overflow-x-auto">
            <table className="w-full min-w-110 text-left text-sm">
              <thead>
                <tr className="border-b border-border/70 bg-muted/40 text-[11px] tracking-wide text-muted-foreground uppercase">
                  <th className="px-4 py-2.5 font-medium">Project</th>
                  <th className="px-4 py-2.5 font-medium">Budget</th>
                  <th className="px-4 py-2.5 font-medium">Health</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b border-border/50 last:border-0">
                      <td className="px-4 py-3">
                        <div className="h-3.5 w-32 animate-pulse rounded bg-muted" />
                        <div className="mt-1.5 h-2.5 w-16 animate-pulse rounded bg-muted/70" />
                      </td>
                      <td className="px-4 py-3">
                        <div className="h-3.5 w-20 animate-pulse rounded bg-muted" />
                      </td>
                      <td className="px-4 py-3">
                        <div className="h-3.5 w-12 animate-pulse rounded bg-muted" />
                      </td>
                      <td className="px-4 py-3">
                        <div className="h-5 w-16 animate-pulse rounded-full bg-muted" />
                      </td>
                    </tr>
                  ))
                ) : recent.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">
                      No projects yet.
                    </td>
                  </tr>
                ) : (
                  recent.map((row) => (
                    <tr
                      key={row.id}
                      className="border-b border-border/50 transition-colors duration-150 last:border-0 hover:bg-accent/30"
                    >
                      <td className="max-w-50 truncate px-4 py-2.5">
                        <Link
                          href={`/projects/projects/${row.id}`}
                          className="cursor-pointer font-medium text-foreground hover:underline"
                        >
                          {row.project_name}
                        </Link>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {row.project_code} · {formatDate(row.planned_end_date)}
                        </p>
                      </td>
                      <td className="px-4 py-2.5 tabular-nums text-foreground">
                        {formatInr(row.budget_amount)}
                      </td>
                      <td className="px-4 py-2.5">
                        <HealthDot health={row.health_status} />
                      </td>
                      <td className="px-4 py-2.5">
                        <FinanceStatusBadge status={row.status} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </ProjectsListPanel>

        <ProjectsListPanel>
          <div className="flex items-center justify-between gap-2 border-b border-border/70 px-4 py-3">
            <div className="flex items-center gap-2.5">
              <ProjectsIconBadge icon={CalendarDays} />
              <div>
                <h2 className="text-sm font-medium tracking-tight">Next due tasks</h2>
                <p className="text-[11px] text-muted-foreground">Open work by due date</p>
              </div>
            </div>
            <ProjectsViewAllLink href="/projects/project-tasks" />
          </div>
          <ul className="divide-y divide-border/60">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <li key={i} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="h-3.5 w-40 animate-pulse rounded bg-muted" />
                    <div className="h-3.5 w-16 animate-pulse rounded bg-muted" />
                  </div>
                  <div className="mt-2 h-2.5 w-28 animate-pulse rounded bg-muted/70" />
                </li>
              ))
            ) : dueTasks.length === 0 ? (
              <li className="px-4 py-8 text-center text-sm text-muted-foreground">
                No dated open tasks.
              </li>
            ) : (
              dueTasks.map((row) => (
                <li
                  key={row.id}
                  className="px-4 py-2.5 transition-colors duration-150 hover:bg-accent/30"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate text-sm font-medium text-foreground">
                      {row.task_name}
                    </span>
                    <span className="shrink-0 text-xs font-semibold tabular-nums text-foreground">
                      {formatDate(row.due_date)}
                    </span>
                  </div>
                  <p className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                    <span className="truncate">
                      {projectNameById.get(row.project_id) ?? row.document_number ?? "—"}
                    </span>
                    <span>·</span>
                    <span>{num(row.percent_complete)}% done</span>
                    <FinanceStatusBadge status={row.status} />
                  </p>
                </li>
              ))
            )}
          </ul>
        </ProjectsListPanel>
      </div>

      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        <ProjectsActivityTile
          label="Allocations"
          value={loading ? "—" : String(data?.allocations.length ?? 0)}
          icon={Users}
          tint="bg-sky-50 text-sky-800"
          href="/projects/resource-allocations"
        />
        <ProjectsActivityTile
          label="Milestones achieved"
          value={loading ? "—" : String(kpis.milestonesAchieved)}
          icon={Scale}
          tint="bg-emerald-50 text-emerald-800"
          href="/projects/project-milestones"
        />
        <ProjectsActivityTile
          label="Change requests"
          value={loading ? "—" : String(data?.changeRequests.length ?? 0)}
          icon={GitPullRequestArrow}
          tint="bg-amber-50 text-amber-900"
          href="/projects/change-requests"
        />
        <ProjectsActivityTile
          label="Documents"
          value={loading ? "—" : String(data?.documents.length ?? 0)}
          icon={FileText}
          tint="bg-slate-100 text-slate-800"
          href="/projects/project-documents"
        />
      </div>
    </ProjectsPage>
  );
}
