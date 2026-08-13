"use client";

import { useCallback, useMemo } from "react";
import Link from "next/link";
import { GitBranch } from "lucide-react";

import { FinanceStatusBadge } from "@/components/finance/finance-status-badge";
import {
  ProjectsRecordList,
  type RecordColumn,
} from "@/components/projects/projects-record-list";
import { useProjectsLookups } from "@/components/projects/use-projects-lookups";
import {
  formatDate,
  listProjectPhases,
  type ProjectPhase,
} from "@/services/projects-portal-service";

const LOOKUPS = ["projects"] as const;

export function ProjectPhaseListPage() {
  const { loadLookups, labels } = useProjectsLookups(LOOKUPS);

  const load = useCallback(async () => {
    const [rows] = await Promise.all([listProjectPhases(), loadLookups()]);
    return rows;
  }, [loadLookups]);

  const columns = useMemo<RecordColumn<ProjectPhase>[]>(
    () => [
      {
        key: "phase_name",
        label: "Phase",
        sort: (r) => r.phase_name,
        className: "font-medium text-foreground",
        cell: (r) => (
          <Link
            href={`/projects/project-phases/${r.id}/edit`}
            className="cursor-pointer hover:underline"
          >
            {r.phase_name}
          </Link>
        ),
      },
      {
        key: "phase_code",
        label: "Code",
        sort: (r) => r.phase_code,
        className: "font-mono text-xs text-muted-foreground",
        cell: (r) => r.phase_code,
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
        key: "sequence_no",
        label: "Seq",
        align: "right",
        sort: (r) => r.sequence_no,
        className: "text-right tabular-nums",
        cell: (r) => r.sequence_no,
      },
      {
        key: "planned_start_date",
        label: "Planned Start",
        sort: (r) => r.planned_start_date,
        cell: (r) => formatDate(r.planned_start_date),
      },
      {
        key: "planned_end_date",
        label: "Planned End",
        sort: (r) => r.planned_end_date,
        cell: (r) => formatDate(r.planned_end_date),
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
      title="WBS Phases"
      description="Work breakdown structure — phases group milestones and tasks inside a project (Project → Phase → Milestone → Task)."
      panelTitle="Phases"
      panelSubtitle="Work breakdown structure"
      icon={GitBranch}
      newHref="/projects/project-phases/new"
      newLabel="New Phase"
      searchPlaceholder="Search phases…"
      loadingMessage="Loading phases…"
      emptyMessage="No phases yet. Break a project down into phases to start planning."
      errorMessage="Failed to load project phases"
      minWidth={1000}
      columns={columns}
      defaultSortKey="sequence_no"
      load={load}
      matches={(r, q) =>
        r.phase_name.toLowerCase().includes(q) ||
        r.phase_code.toLowerCase().includes(q) ||
        labels.projectName(r.project_id).toLowerCase().includes(q)
      }
    />
  );
}
