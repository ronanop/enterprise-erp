"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowUpRight,
  ClipboardList,
  FolderKanban,
  RefreshCw,
  Timer,
} from "lucide-react";

import { FinanceKpiCard } from "@/components/finance/finance-kpi-card";
import { FinanceStatusBadge } from "@/components/finance/finance-status-badge";
import { PageHeader } from "@/components/layout/page-header";
import { ProjectsPipelineFunnel } from "@/components/projects/projects-pipeline-funnel";
import { Badge } from "@/components/ui/badge";
import {
  projectsQuickLinks,
  projectsWorkspaceGroups,
  resolveProjectsGroupResources,
} from "@/config/projects";
import { isAuthenticated } from "@/lib/auth";
import {
  asNumber,
  asStatus,
  countByStatus,
  countOpenDocs,
  formatInr,
  loadProjectsOverview,
  sumField,
  type ProjectsOverview,
  type ProjectsRow,
} from "@/services/projects-service";

function recentProjects(rows: ProjectsRow[], limit = 6): ProjectsRow[] {
  return [...rows]
    .sort((a, b) =>
      String(b.project_code ?? b.project_name ?? "").localeCompare(
        String(a.project_code ?? a.project_name ?? ""),
      ),
    )
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
    if (!data) {
      return {
        activeProjects: 0,
        openTasks: 0,
        pendingTimesheets: 0,
        openIssues: 0,
        budgetTotal: 0,
        hoursTotal: 0,
      };
    }
    return {
      activeProjects: countByStatus(data.projects, [
        "in_progress",
        "approved",
        "submitted",
      ]),
      openTasks: countByStatus(data.tasks, ["open", "in_progress", "blocked", "submitted"]),
      pendingTimesheets: countByStatus(data.timesheets, ["submitted", "draft"]),
      openIssues: countOpenDocs(data.issues, ["resolved", "closed", "cancelled"]),
      budgetTotal: sumField(data.budgets, "budget_amount"),
      hoursTotal: sumField(data.timesheets, "total_hours"),
    };
  }, [data]);

  const pipelineCounts = useMemo(
    () => ({
      projects: data?.projects.length ?? 0,
      "project-phases": data?.phases.length ?? 0,
      "project-milestones": data?.milestones.length ?? 0,
      "project-tasks": data?.tasks.length ?? 0,
      timesheets: data?.timesheets.length ?? 0,
      "project-budgets": data?.budgets.length ?? 0,
    }),
    [data],
  );

  const recent = useMemo(() => recentProjects(data?.projects ?? []), [data]);

  const taskWatch = useMemo(() => {
    const rows = data?.tasks ?? [];
    return [...rows]
      .sort((a, b) => asNumber(b.estimated_hours) - asNumber(a.estimated_hours))
      .slice(0, 5);
  }, [data]);

  const projectStatusMix = useMemo(() => {
    const rows = data?.projects ?? [];
    const stages = [
      { key: "draft", label: "Draft", barClass: "bg-slate-400" },
      { key: "submitted", label: "Submitted", barClass: "bg-sky-600" },
      { key: "approved", label: "Approved", barClass: "bg-teal-600" },
      { key: "in_progress", label: "In progress", barClass: "bg-emerald-600" },
      { key: "on_hold", label: "On hold", barClass: "bg-amber-500" },
      { key: "completed", label: "Completed", barClass: "bg-slate-600" },
    ] as const;
    const total = rows.length || 1;
    return stages.map((s) => {
      const count = countByStatus(rows, [s.key]);
      return { ...s, count, pct: Math.round((count / total) * 100) };
    });
  }, [data]);

  const authBlocked =
    Boolean(data?.statusCodes.includes(401)) ||
    (!authenticated && Boolean(data?.errors.length));

  return (
    <div className="space-y-5">
      <PageHeader
        title="Projects"
        description="PMO workspace — portfolio, WBS, tasks, timesheets, resources, budgets, issues, risks, and change control."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-border/80 bg-card px-3 text-sm font-medium shadow-sm transition-colors duration-200 hover:bg-muted disabled:opacity-60"
            >
              <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
            <Link
              href="/projects/project-tasks"
              className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground shadow-sm transition-opacity duration-200 hover:opacity-90"
            >
              <ClipboardList className="size-3.5" />
              Tasks
            </Link>
            <Link
              href="/projects/timesheets"
              className="inline-flex h-8 cursor-pointer items-center rounded-lg border border-border/80 bg-card px-3 text-sm font-medium shadow-sm transition-colors duration-200 hover:bg-muted"
            >
              Timesheets
            </Link>
          </div>
        }
      />

      {authBlocked ? (
        <div className="rounded-xl border border-dashed border-amber-300/80 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Sign in to load live project data.{" "}
          <Link href="/login" className="cursor-pointer font-medium underline underline-offset-2">
            Go to login
          </Link>
        </div>
      ) : null}

      {data?.partial && !authBlocked ? (
        <div className="rounded-xl border border-border/80 bg-muted/40 px-4 py-2.5 text-xs text-muted-foreground">
          Some project endpoints returned errors. Showing available records.
        </div>
      ) : null}

      <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
        <FinanceKpiCard
          label="Active projects"
          value={loading ? "—" : String(kpis.activeProjects)}
          hint={`${formatInr(sumField(data?.projects ?? [], "budget_amount"))} portfolio · ${data?.projects.length ?? 0} total`}
          icon={FolderKanban}
          tone={kpis.activeProjects > 0 ? "default" : "success"}
        />
        <FinanceKpiCard
          label="Open tasks"
          value={loading ? "—" : String(kpis.openTasks)}
          hint={`${countByStatus(data?.tasks ?? [], ["blocked"])} blocked · ${data?.tasks.length ?? 0} tasks`}
          icon={ClipboardList}
          tone={kpis.openTasks > 0 ? "warning" : "success"}
        />
        <FinanceKpiCard
          label="Pending timesheets"
          value={loading ? "—" : String(kpis.pendingTimesheets)}
          hint={`${kpis.hoursTotal} hrs · ${data?.timesheets.length ?? 0} sheets`}
          icon={Timer}
          tone={kpis.pendingTimesheets > 0 ? "warning" : "success"}
        />
        <FinanceKpiCard
          label="Open issues"
          value={loading ? "—" : String(kpis.openIssues)}
          hint={`${formatInr(kpis.budgetTotal)} budgets · ${countOpenDocs(data?.risks ?? [], ["closed", "cancelled", "accepted"])} risks open`}
          icon={AlertTriangle}
          tone={kpis.openIssues > 0 ? "danger" : "success"}
        />
      </div>

      <ProjectsPipelineFunnel counts={pipelineCounts} loading={loading} />

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {projectsQuickLinks.map((link) => {
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              className="group flex cursor-pointer items-center gap-3 rounded-xl border border-border/80 bg-card px-3.5 py-3 shadow-sm transition-[border-color,box-shadow] duration-200 hover:border-primary/25 hover:shadow-md"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                <Icon className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1 text-sm font-medium tracking-tight">
                  {link.title}
                  <ArrowUpRight className="size-3 text-muted-foreground opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
                </span>
                <span className="block text-[11px] text-muted-foreground">
                  {link.description}
                </span>
              </span>
            </Link>
          );
        })}
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-medium tracking-tight">Workspace</h2>
          <Badge variant="secondary">{projectsWorkspaceGroups.length} areas</Badge>
        </div>
        <div className="grid gap-3 lg:grid-cols-3">
          {projectsWorkspaceGroups.map((group) => {
            const Icon = group.icon;
            const resources = resolveProjectsGroupResources(group);
            return (
              <div
                key={group.key}
                className="rounded-xl border border-border/80 bg-card p-4 shadow-sm"
              >
                <div className="mb-3 flex items-start gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
                    <Icon className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-sm font-medium tracking-tight">{group.title}</h3>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                      {group.description}
                    </p>
                  </div>
                </div>
                <ul className="space-y-1">
                  {resources.map((resource) => (
                    <li key={resource.key}>
                      <Link
                        href={`/projects/${resource.key}`}
                        className="flex cursor-pointer items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-xs transition-colors duration-200 hover:bg-accent/50"
                      >
                        <span className="font-medium text-foreground">{resource.title}</span>
                        <span className="truncate text-[10px] text-muted-foreground">
                          {resource.description}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </section>

      <div className="grid gap-3 xl:grid-cols-[1.3fr_1fr_1fr]">
        <div className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm">
          <div className="flex items-center justify-between gap-2 border-b border-border/70 px-4 py-3">
            <div>
              <h2 className="text-sm font-medium tracking-tight">Recent projects</h2>
              <p className="text-[11px] text-muted-foreground">Portfolio register</p>
            </div>
            <Link
              href="/projects/projects"
              className="cursor-pointer text-xs font-medium text-primary transition-opacity duration-200 hover:opacity-80"
            >
              View all
            </Link>
          </div>
          <div className="erp-scroll overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead>
                <tr className="border-b border-border/70 bg-muted/40 text-[11px] tracking-wide text-muted-foreground uppercase">
                  <th className="px-4 py-2.5 font-medium">Project</th>
                  <th className="px-4 py-2.5 font-medium">Type</th>
                  <th className="px-4 py-2.5 font-medium">Budget</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">
                      Loading…
                    </td>
                  </tr>
                ) : recent.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">
                      No projects yet.
                    </td>
                  </tr>
                ) : (
                  recent.map((row, idx) => (
                    <tr
                      key={String(row.id ?? idx)}
                      className="border-b border-border/50 transition-colors duration-150 last:border-0 hover:bg-accent/30"
                    >
                      <td className="max-w-[200px] truncate px-4 py-2.5">
                        <p className="font-medium text-foreground">
                          {String(row.project_name ?? "—")}
                        </p>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {String(row.project_code ?? "")}
                        </p>
                      </td>
                      <td className="px-4 py-2.5 text-xs capitalize text-muted-foreground">
                        {String(row.project_type ?? "—").replaceAll("_", " ")}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs tabular-nums text-foreground">
                        {formatInr(asNumber(row.budget_amount))}
                      </td>
                      <td className="px-4 py-2.5">
                        <FinanceStatusBadge
                          status={asStatus(row.status) || String(row.status ?? "")}
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm">
          <div className="flex items-center justify-between gap-2 border-b border-border/70 px-4 py-3">
            <div>
              <h2 className="text-sm font-medium tracking-tight">Task watch</h2>
              <p className="text-[11px] text-muted-foreground">Highest estimated hours</p>
            </div>
            <Link
              href="/projects/project-tasks"
              className="cursor-pointer text-xs font-medium text-primary transition-opacity duration-200 hover:opacity-80"
            >
              View all
            </Link>
          </div>
          <ul className="divide-y divide-border/60">
            {loading ? (
              <li className="px-4 py-8 text-center text-sm text-muted-foreground">Loading…</li>
            ) : taskWatch.length === 0 ? (
              <li className="px-4 py-8 text-center text-sm text-muted-foreground">
                No tasks yet.
              </li>
            ) : (
              taskWatch.map((row, idx) => (
                <li
                  key={String(row.id ?? idx)}
                  className="px-4 py-2.5 transition-colors duration-150 hover:bg-accent/30"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium">
                      {String(row.task_name ?? row.document_number ?? "—")}
                    </p>
                    <FinanceStatusBadge
                      status={asStatus(row.status) || String(row.status ?? "")}
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {String(row.document_number ?? "")} · Est{" "}
                    {asNumber(row.estimated_hours)}h · Actual{" "}
                    {asNumber(row.actual_hours)}h
                  </p>
                </li>
              ))
            )}
          </ul>
        </div>

        <div className="rounded-xl border border-border/80 bg-card p-4 shadow-sm">
          <div className="mb-3">
            <h2 className="text-sm font-medium tracking-tight">Project status mix</h2>
            <p className="text-[11px] text-muted-foreground">Portfolio lifecycle</p>
          </div>
          {loading ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>
          ) : (
            <div className="space-y-3">
              {projectStatusMix.map((s) => (
                <div key={s.key}>
                  <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                    <span className="font-medium text-foreground">{s.label}</span>
                    <span className="font-mono tabular-nums text-muted-foreground">
                      {s.count} · {s.pct}%
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full transition-[width] duration-300 ${s.barClass}`}
                      style={{ width: `${Math.max(4, s.pct)}%` }}
                      role="presentation"
                    />
                  </div>
                </div>
              ))}
              <p className="pt-1 text-[11px] text-muted-foreground">
                Milestones achieved{" "}
                {countByStatus(data?.milestones ?? [], ["achieved"])} · Changes open{" "}
                {countOpenDocs(data?.changeRequests ?? [], [
                  "implemented",
                  "rejected",
                  "cancelled",
                ])}{" "}
                · Costs posted {countByStatus(data?.costs ?? [], ["posted"])}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
