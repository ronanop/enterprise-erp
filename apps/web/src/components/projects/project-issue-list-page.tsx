"use client";

import { useCallback, useMemo } from "react";
import Link from "next/link";
import { CircleAlert } from "lucide-react";

import { FinanceStatusBadge } from "@/components/finance/finance-status-badge";
import { SeverityBadge } from "@/components/projects/projects-badges";
import {
  ProjectsRecordList,
  type RecordColumn,
} from "@/components/projects/projects-record-list";
import { useProjectsLookups } from "@/components/projects/use-projects-lookups";
import {
  formatDate,
  listProjectIssues,
  type ProjectIssue,
} from "@/services/projects-portal-service";

const LOOKUPS = ["projects", "tasks", "employees"] as const;

export function ProjectIssueListPage() {
  const { loadLookups, labels } = useProjectsLookups(LOOKUPS);

  const load = useCallback(async () => {
    const [rows] = await Promise.all([listProjectIssues(), loadLookups()]);
    return rows;
  }, [loadLookups]);

  const columns = useMemo<RecordColumn<ProjectIssue>[]>(
    () => [
      {
        key: "issue_title",
        label: "Issue",
        sort: (r) => r.issue_title,
        className: "font-medium text-foreground",
        cell: (r) => (
          <Link
            href={`/projects/project-issues/${r.id}/edit`}
            className="cursor-pointer hover:underline"
          >
            {r.issue_title}
          </Link>
        ),
      },
      {
        key: "document_number",
        label: "Issue No.",
        sort: (r) => r.document_number,
        className: "font-mono text-xs text-muted-foreground",
        cell: (r) => r.document_number,
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
        key: "task_id",
        label: "Task",
        sort: (r) => labels.taskName(r.task_id),
        cell: (r) => labels.taskName(r.task_id),
      },
      {
        key: "severity",
        label: "Severity",
        sort: (r) => r.severity,
        className: "",
        cell: (r) => <SeverityBadge value={r.severity} />,
      },
      {
        key: "owner_employee_id",
        label: "Owner",
        sort: (r) => labels.employeeName(r.owner_employee_id),
        cell: (r) => labels.employeeName(r.owner_employee_id),
      },
      {
        key: "opened_at",
        label: "Opened",
        sort: (r) => r.opened_at,
        cell: (r) => formatDate(r.opened_at),
      },
      {
        key: "resolved_at",
        label: "Resolved",
        sort: (r) => r.resolved_at,
        cell: (r) => formatDate(r.resolved_at),
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
      title="Issues"
      description="Blockers and defects raised against a project or a specific task, tracked from open through resolution."
      panelTitle="Issue log"
      panelSubtitle="Blockers and defects"
      icon={CircleAlert}
      newHref="/projects/project-issues/new"
      newLabel="New Issue"
      searchPlaceholder="Search issues…"
      loadingMessage="Loading issues…"
      emptyMessage="No issues logged. Raise one when delivery hits a blocker."
      errorMessage="Failed to load project issues"
      minWidth={1250}
      columns={columns}
      defaultSortKey="opened_at"
      defaultSortDir="desc"
      load={load}
      matches={(r, q) =>
        r.issue_title.toLowerCase().includes(q) ||
        r.document_number.toLowerCase().includes(q) ||
        labels.projectName(r.project_id).toLowerCase().includes(q)
      }
    />
  );
}
