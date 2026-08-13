"use client";

import { useCallback, useMemo } from "react";
import Link from "next/link";
import { ClipboardList } from "lucide-react";

import { FinanceStatusBadge } from "@/components/finance/finance-status-badge";
import { PriorityBadge } from "@/components/projects/projects-badges";
import {
  ProjectsRecordList,
  type RecordColumn,
} from "@/components/projects/projects-record-list";
import { useProjectsLookups } from "@/components/projects/use-projects-lookups";
import {
  formatDate,
  formatHours,
  listProjectTasks,
  type ProjectTask,
} from "@/services/projects-portal-service";

const LOOKUPS = ["projects", "phases", "milestones"] as const;

export function ProjectTaskListPage() {
  const { loadLookups, labels } = useProjectsLookups(LOOKUPS);

  const load = useCallback(async () => {
    const [rows] = await Promise.all([listProjectTasks(), loadLookups()]);
    return rows;
  }, [loadLookups]);

  const columns = useMemo<RecordColumn<ProjectTask>[]>(
    () => [
      {
        key: "task_name",
        label: "Task",
        sort: (r) => r.task_name,
        className: "font-medium text-foreground",
        cell: (r) => (
          <Link
            href={`/projects/project-tasks/${r.id}/edit`}
            className="cursor-pointer hover:underline"
          >
            {r.task_name}
          </Link>
        ),
      },
      {
        key: "document_number",
        label: "Task No.",
        sort: (r) => r.document_number,
        className: "font-mono text-xs text-muted-foreground",
        cell: (r) => r.document_number ?? "—",
      },
      {
        key: "project_id",
        label: "Project",
        sort: (r) => labels.projectName(r.project_id),
        cell: (r) => (
          <Link
            href={`/projects/projects/${r.project_id}`}
            className="cursor-pointer hover:underline"
          >
            {labels.projectName(r.project_id)}
          </Link>
        ),
      },
      {
        key: "phase_id",
        label: "Phase",
        sort: (r) => labels.phaseName(r.phase_id),
        cell: (r) => labels.phaseName(r.phase_id),
      },
      {
        key: "priority",
        label: "Priority",
        sort: (r) => r.priority,
        className: "",
        cell: (r) => <PriorityBadge value={r.priority} />,
      },
      {
        key: "due_date",
        label: "Due Date",
        sort: (r) => r.due_date,
        cell: (r) => formatDate(r.due_date),
      },
      {
        key: "estimated_hours",
        label: "Est. Hours",
        align: "right",
        sort: (r) => Number(r.estimated_hours ?? 0),
        className: "text-right tabular-nums",
        cell: (r) => (r.estimated_hours == null ? "—" : formatHours(r.estimated_hours)),
      },
      {
        key: "percent_complete",
        label: "Progress",
        sort: (r) => Number(r.percent_complete ?? 0),
        cell: (r) => <ProgressBar value={Number(r.percent_complete ?? 0)} />,
      },
      {
        key: "created_at",
        label: "Date Created",
        sort: (r) => r.created_at,
        cell: (r) => formatDate(r.created_at),
      },
      {
        key: "status",
        label: "Status",
        sort: (r) => r.status,
        className: "",
        cell: (r) => <FinanceStatusBadge status={r.status} />,
      },
    ],
    [labels],
  );

  return (
    <ProjectsRecordList
      title="Tasks"
      description="Work items across the WBS. Track assignment, priority, due dates, and effort against every project."
      panelTitle="Work items"
      panelSubtitle="Project tasks"
      icon={ClipboardList}
      newHref="/projects/project-tasks/new"
      newLabel="New Task"
      searchPlaceholder="Search tasks…"
      loadingMessage="Loading tasks…"
      emptyMessage="No tasks yet. Create one against a project phase or milestone."
      errorMessage="Failed to load tasks"
      minWidth={1260}
      columns={columns}
      defaultSortKey="due_date"
      load={load}
      matches={(r, q) =>
        r.task_name.toLowerCase().includes(q) ||
        (r.document_number ?? "").toLowerCase().includes(q) ||
        labels.projectName(r.project_id).toLowerCase().includes(q)
      }
    />
  );
}

function ProgressBar({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <span className="flex items-center gap-2">
      <span className="h-1.5 w-16 overflow-hidden rounded-full bg-muted" aria-hidden>
        <span className="block h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </span>
      <span className="tabular-nums text-xs">{pct.toFixed(0)}%</span>
    </span>
  );
}
