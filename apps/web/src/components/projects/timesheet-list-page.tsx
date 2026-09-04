"use client";

import { useCallback, useMemo } from "react";
import Link from "next/link";
import { Timer } from "lucide-react";

import { FinanceStatusBadge } from "@/components/finance/finance-status-badge";
import {
  ProjectsRecordList,
  type RecordColumn,
} from "@/components/projects/projects-record-list";
import { useProjectsLookups } from "@/components/projects/use-projects-lookups";
import {
  formatDate,
  formatHours,
  listTimesheets,
  type Timesheet,
} from "@/services/projects-portal-service";

const LOOKUPS = ["projects", "employees"] as const;

export function TimesheetListPage() {
  const { loadLookups, labels } = useProjectsLookups(LOOKUPS);

  const load = useCallback(async () => {
    const [rows] = await Promise.all([listTimesheets(), loadLookups()]);
    return rows;
  }, [loadLookups]);

  const columns = useMemo<RecordColumn<Timesheet>[]>(
    () => [
      {
        key: "document_number",
        label: "Timesheet No.",
        sort: (r) => r.document_number,
        className: "font-mono text-xs font-medium text-foreground",
        cell: (r) => (
          <Link
            href={`/projects/timesheets/${r.id}/edit`}
            className="cursor-pointer hover:underline"
          >
            {r.document_number}
          </Link>
        ),
      },
      {
        key: "employee_id",
        label: "Employee",
        sort: (r) => labels.employeeName(r.employee_id),
        className: "font-medium text-foreground",
        cell: (r) => labels.employeeName(r.employee_id),
      },
      {
        key: "project_id",
        label: "Project",
        sort: (r) => labels.projectName(r.project_id),
        cell: (r) =>
          r.project_id ? (
            <Link
              href={`/projects/projects/${r.project_id}`}
              className="cursor-pointer hover:underline"
            >
              {labels.projectName(r.project_id)}
            </Link>
          ) : (
            "—"
          ),
      },
      {
        key: "period_start",
        label: "Period Start",
        sort: (r) => r.period_start,
        cell: (r) => formatDate(r.period_start),
      },
      {
        key: "period_end",
        label: "Period End",
        sort: (r) => r.period_end,
        cell: (r) => formatDate(r.period_end),
      },
      {
        key: "total_hours",
        label: "Total Hours",
        align: "right",
        sort: (r) => Number(r.total_hours ?? 0),
        className: "text-right tabular-nums text-foreground",
        cell: (r) => (r.total_hours == null ? "—" : formatHours(r.total_hours)),
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
      title="Timesheets"
      description="Employee effort capture. A timesheet is drafted for a period, submitted for manager approval, then locks its entries."
      panelTitle="Timesheets"
      panelSubtitle="Effort capture"
      icon={Timer}
      newHref="/projects/timesheets/new"
      newLabel="New Timesheet"
      searchPlaceholder="Search timesheets…"
      loadingMessage="Loading timesheets…"
      emptyMessage="No timesheets yet. Create one to start logging effort against a project."
      errorMessage="Failed to load timesheets"
      minWidth={1100}
      columns={columns}
      defaultSortKey="period_start"
      defaultSortDir="desc"
      load={load}
      matches={(r, q) =>
        r.document_number.toLowerCase().includes(q) ||
        labels.employeeName(r.employee_id).toLowerCase().includes(q) ||
        labels.projectName(r.project_id).toLowerCase().includes(q)
      }
    />
  );
}
