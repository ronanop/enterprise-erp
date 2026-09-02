"use client";

import { useCallback, useMemo } from "react";
import Link from "next/link";
import { GitPullRequestArrow } from "lucide-react";

import { FinanceStatusBadge } from "@/components/finance/finance-status-badge";
import { changeTypeLabel } from "@/components/projects/projects-domain";
import {
  ProjectsRecordList,
  type RecordColumn,
} from "@/components/projects/projects-record-list";
import { useProjectsLookups } from "@/components/projects/use-projects-lookups";
import {
  formatDate,
  formatInr,
  listChangeRequests,
  type ChangeRequest,
} from "@/services/projects-portal-service";

const LOOKUPS = ["projects", "employees"] as const;

export function ChangeRequestListPage() {
  const { loadLookups, labels } = useProjectsLookups(LOOKUPS);

  const load = useCallback(async () => {
    const [rows] = await Promise.all([listChangeRequests(), loadLookups()]);
    return rows;
  }, [loadLookups]);

  const columns = useMemo<RecordColumn<ChangeRequest>[]>(
    () => [
      {
        key: "change_title",
        label: "Change",
        sort: (r) => r.change_title,
        className: "font-medium text-foreground",
        cell: (r) => (
          <Link
            href={`/projects/change-requests/${r.id}/edit`}
            className="cursor-pointer hover:underline"
          >
            {r.change_title}
          </Link>
        ),
      },
      {
        key: "document_number",
        label: "CR No.",
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
        key: "change_type",
        label: "Type",
        sort: (r) => r.change_type,
        cell: (r) => changeTypeLabel(r.change_type),
      },
      {
        key: "requested_by_employee_id",
        label: "Requested By",
        sort: (r) => labels.employeeName(r.requested_by_employee_id),
        cell: (r) => labels.employeeName(r.requested_by_employee_id),
      },
      {
        key: "budget_impact_amount",
        label: "Budget Impact",
        align: "right",
        sort: (r) => Number(r.budget_impact_amount ?? 0),
        className: "text-right tabular-nums text-foreground",
        cell: (r) =>
          r.budget_impact_amount == null ? "—" : formatInr(r.budget_impact_amount),
      },
      {
        key: "schedule_impact_days",
        label: "Schedule Impact",
        align: "right",
        sort: (r) => r.schedule_impact_days ?? 0,
        className: "text-right tabular-nums",
        cell: (r) =>
          r.schedule_impact_days == null ? "—" : `${r.schedule_impact_days} d`,
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
      title="Change Requests"
      description="Scope, schedule, budget, and resource changes with their quantified impact. Routes through Project Manager → Department Head → Finance."
      panelTitle="Change control"
      panelSubtitle="Impact-assessed changes"
      icon={GitPullRequestArrow}
      newHref="/projects/change-requests/new"
      newLabel="New Change Request"
      searchPlaceholder="Search change requests…"
      loadingMessage="Loading change requests…"
      emptyMessage="No change requests yet. Raise one when scope, schedule, or budget shifts."
      errorMessage="Failed to load change requests"
      minWidth={1300}
      columns={columns}
      defaultSortKey="created_at"
      defaultSortDir="desc"
      load={load}
      matches={(r, q) =>
        r.change_title.toLowerCase().includes(q) ||
        r.document_number.toLowerCase().includes(q) ||
        labels.projectName(r.project_id).toLowerCase().includes(q)
      }
    />
  );
}
