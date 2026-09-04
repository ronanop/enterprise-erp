"use client";

import { useCallback, useMemo } from "react";
import Link from "next/link";
import { Flag } from "lucide-react";

import { FinanceStatusBadge } from "@/components/finance/finance-status-badge";
import {
  ProjectsRecordList,
  type RecordColumn,
} from "@/components/projects/projects-record-list";
import { useProjectsLookups } from "@/components/projects/use-projects-lookups";
import {
  formatDate,
  listProjectMilestones,
  type ProjectMilestone,
} from "@/services/projects-portal-service";

const LOOKUPS = ["projects", "phases", "employees"] as const;

export function ProjectMilestoneListPage() {
  const { loadLookups, labels } = useProjectsLookups(LOOKUPS);

  const load = useCallback(async () => {
    const [rows] = await Promise.all([listProjectMilestones(), loadLookups()]);
    return rows;
  }, [loadLookups]);

  const columns = useMemo<RecordColumn<ProjectMilestone>[]>(
    () => [
      {
        key: "milestone_name",
        label: "Milestone",
        sort: (r) => r.milestone_name,
        className: "font-medium text-foreground",
        cell: (r) => (
          <Link
            href={`/projects/project-milestones/${r.id}/edit`}
            className="cursor-pointer hover:underline"
          >
            {r.milestone_name}
          </Link>
        ),
      },
      {
        key: "milestone_code",
        label: "Code",
        sort: (r) => r.milestone_code,
        className: "font-mono text-xs text-muted-foreground",
        cell: (r) => r.milestone_code,
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
        key: "owner_employee_id",
        label: "Owner",
        sort: (r) => labels.employeeName(r.owner_employee_id),
        cell: (r) => labels.employeeName(r.owner_employee_id),
      },
      {
        key: "due_date",
        label: "Due Date",
        sort: (r) => r.due_date,
        cell: (r) => formatDate(r.due_date),
      },
      {
        key: "achieved_at",
        label: "Achieved",
        sort: (r) => r.achieved_at,
        cell: (r) => formatDate(r.achieved_at),
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
      title="Milestones"
      description="Major project checkpoints. A milestone is planned, then marked achieved or delayed as delivery progresses."
      panelTitle="Milestones"
      panelSubtitle="Delivery checkpoints"
      icon={Flag}
      newHref="/projects/project-milestones/new"
      newLabel="New Milestone"
      searchPlaceholder="Search milestones…"
      loadingMessage="Loading milestones…"
      emptyMessage="No milestones yet. Add checkpoints to track delivery progress."
      errorMessage="Failed to load milestones"
      minWidth={1150}
      columns={columns}
      defaultSortKey="due_date"
      load={load}
      matches={(r, q) =>
        r.milestone_name.toLowerCase().includes(q) ||
        r.milestone_code.toLowerCase().includes(q) ||
        labels.projectName(r.project_id).toLowerCase().includes(q)
      }
    />
  );
}
