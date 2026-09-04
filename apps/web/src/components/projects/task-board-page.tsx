"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { LayoutGrid, Plus, RefreshCw } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { PriorityBadge } from "@/components/projects/projects-badges";
import { TASK_STATUSES } from "@/components/projects/projects-domain";
import {
  ProjectsErrorBanner,
  ProjectsPage,
  ProjectsSection,
} from "@/components/projects/projects-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiClientError } from "@/services/api-client";
import {
  formatDate,
  listProjectOptions,
  listProjectTasks,
  num,
  type Option,
  type ProjectTask,
} from "@/services/projects-portal-service";

/** Board columns follow the task lifecycle; terminal states sit at the right. */
const COLUMNS = TASK_STATUSES.filter((s) => s.value !== "cancelled");

const COLUMN_ACCENT: Record<string, string> = {
  open: "bg-slate-400",
  in_progress: "bg-sky-600",
  blocked: "bg-red-500",
  submitted: "bg-amber-500",
  approved: "bg-teal-600",
  completed: "bg-emerald-600",
};

export function TaskBoardPage() {
  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [projects, setProjects] = useState<Option[]>([]);
  const [projectFilter, setProjectFilter] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [taskRows, projectRows] = await Promise.all([
        listProjectTasks(),
        listProjectOptions().catch(() => [] as Option[]),
      ]);
      setTasks(taskRows);
      setProjects(projectRows);
    } catch (err) {
      setTasks([]);
      setError(err instanceof ApiClientError ? err.message : "Failed to load tasks");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const projectName = useMemo(() => {
    const map = new Map(projects.map((p) => [p.id, p.label]));
    return (id: string) => map.get(id) ?? "—";
  }, [projects]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tasks.filter((t) => {
      if (projectFilter && t.project_id !== projectFilter) return false;
      if (!q) return true;
      return (
        t.task_name.toLowerCase().includes(q) ||
        (t.document_number ?? "").toLowerCase().includes(q) ||
        projectName(t.project_id).toLowerCase().includes(q)
      );
    });
  }, [tasks, projectFilter, query, projectName]);

  const byStatus = useMemo(() => {
    const map = new Map<string, ProjectTask[]>();
    for (const col of COLUMNS) map.set(col.value, []);
    for (const task of filtered) {
      const bucket = map.get(task.status);
      if (bucket) bucket.push(task);
    }
    for (const bucket of map.values()) {
      bucket.sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999"));
    }
    return map;
  }, [filtered]);

  return (
    <ProjectsPage>
      <PageHeader
        title="Task Board"
        description="Delivery work across every project, grouped by task state. Open a task to update progress or reassign it."
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
              href="/projects/project-tasks/new"
              className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground shadow-sm transition-opacity duration-200 hover:opacity-90"
            >
              <Plus className="size-3.5" />
              New Task
            </Link>
          </div>
        }
      />

      {error ? <ProjectsErrorBanner>{error}</ProjectsErrorBanner> : null}

      <ProjectsSection
        title="Board filters"
        subtitle={`${filtered.length} of ${tasks.length} tasks shown`}
        icon={LayoutGrid}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1.5 text-xs">
            <span className="font-medium text-muted-foreground">Project</span>
            <select
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              className="h-9 cursor-pointer rounded-lg border border-input bg-background px-2.5 text-sm shadow-xs transition-colors duration-200 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <option value="">All projects</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1.5 text-xs">
            <span className="font-medium text-muted-foreground">Search</span>
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Task name, number, or project…"
            />
          </label>
        </div>
      </ProjectsSection>

      <div className="erp-scroll overflow-x-auto pb-2">
        <div className="flex min-w-max gap-3">
          {COLUMNS.map((col) => {
            const rows = byStatus.get(col.value) ?? [];
            return (
              <section
                key={col.value}
                className="flex w-72 shrink-0 flex-col rounded-xl border border-border/80 bg-card shadow-sm"
              >
                <header className="flex items-center justify-between gap-2 border-b border-border/70 px-3 py-2.5">
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className={`size-2 shrink-0 rounded-full ${COLUMN_ACCENT[col.value] ?? "bg-muted-foreground"}`}
                      aria-hidden
                    />
                    <h2 className="truncate text-xs font-semibold tracking-wide text-foreground uppercase">
                      {col.label}
                    </h2>
                  </div>
                  <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-muted-foreground">
                    {loading ? "—" : rows.length}
                  </span>
                </header>

                <ul className="flex flex-1 flex-col gap-2 p-2.5">
                  {loading ? (
                    Array.from({ length: 3 }).map((_, i) => (
                      <li key={i} className="h-20 animate-pulse rounded-lg bg-muted/60" />
                    ))
                  ) : rows.length === 0 ? (
                    <li className="rounded-lg border border-dashed border-border/70 px-3 py-6 text-center text-[11px] text-muted-foreground">
                      Nothing here
                    </li>
                  ) : (
                    rows.map((task) => (
                      <li key={task.id}>
                        <Link
                          href={`/projects/project-tasks/${task.id}/edit`}
                          className="block cursor-pointer rounded-lg border border-border/70 bg-background p-2.5 transition-[border-color,box-shadow] duration-200 hover:border-primary/30 hover:shadow-sm"
                        >
                          <p className="line-clamp-2 text-[13px] font-medium text-foreground">
                            {task.task_name}
                          </p>
                          <p className="mt-1 truncate text-[11px] text-muted-foreground">
                            {projectName(task.project_id)}
                          </p>
                          <div className="mt-2 flex items-center justify-between gap-2">
                            <PriorityBadge value={task.priority} />
                            <span className="text-[11px] tabular-nums text-muted-foreground">
                              {formatDate(task.due_date)}
                            </span>
                          </div>
                          <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-sky-600 transition-[width] duration-300"
                              style={{
                                width: `${Math.min(100, Math.max(2, num(task.percent_complete)))}%`,
                              }}
                              role="presentation"
                            />
                          </div>
                        </Link>
                      </li>
                    ))
                  )}
                </ul>
              </section>
            );
          })}
        </div>
      </div>
    </ProjectsPage>
  );
}
