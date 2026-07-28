"use client";

import { useCallback, useMemo } from "react";
import Link from "next/link";
import { CalendarClock } from "lucide-react";

import { FinanceStatusBadge } from "@/components/finance/finance-status-badge";
import {
  ProjectsRecordList,
  type RecordColumn,
} from "@/components/projects/projects-record-list";
import { useProjectsLookups } from "@/components/projects/use-projects-lookups";
import {
  formatDate,
  formatHours,
  listTimesheetEntries,
  type TimesheetEntry,
} from "@/services/projects-portal-service";

const LOOKUPS = ["projects", "employees", "tasks", "timesheets"] as const;

export function TimesheetEntryListPage() {
  const { loadLookups, labels } = useProjectsLookups(LOOKUPS);

  const load = useCallback(async () => {
    const [rows] = await Promise.all([listTimesheetEntries(), loadLookups()]);
    return rows;
  }, [loadLookups]);

  const columns = useMemo<RecordColumn<TimesheetEntry>[]>(
    () => [
      {
        key: "work_date",
        label: "Work Date",
        sort: (r) => r.work_date,
        className: "font-medium text-foreground",
        cell: (r) => (
          <Link
            href={`/projects/timesheet-entries/${r.id}/edit`}
            className="cursor-pointer hover:underline"
          >
            {formatDate(r.work_date)}
          </Link>
        ),
      },
      {
        key: "employee_id",
        label: "Employee",
        sort: (r) => labels.employeeName(r.employee_id),
        cell: (r) => labels.employeeName(r.employee_id),
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
        key: "timesheet_id",
        label: "Timesheet",
        sort: (r) => labels.timesheetLabel(r.timesheet_id),
        className: "font-mono text-xs text-muted-foreground",
        cell: (r) => labels.timesheetLabel(r.timesheet_id),
      },
      {
        key: "hours_worked",
        label: "Hours",
        align: "right",
        sort: (r) => Number(r.hours_worked ?? 0),
        className: "text-right tabular-nums text-foreground",
        cell: (r) => formatHours(r.hours_worked),
      },
      {
        key: "description",
        label: "Description",
        sort: (r) => r.description,
        cell: (r) => r.description ?? "—",
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
      title="Time Entries"
      description="Daily effort lines behind each timesheet. Total hours per employee per day cannot exceed 24."
      panelTitle="Time entries"
      panelSubtitle="Daily effort lines"
      icon={CalendarClock}
      newHref="/projects/timesheet-entries/new"
      newLabel="New Entry"
      searchPlaceholder="Search entries…"
      loadingMessage="Loading time entries…"
      emptyMessage="No time entries yet. Log effort against a task inside a timesheet."
      errorMessage="Failed to load time entries"
      minWidth={1250}
      columns={columns}
      defaultSortKey="work_date"
      defaultSortDir="desc"
      load={load}
      matches={(r, q) =>
        r.work_date.toLowerCase().includes(q) ||
        (r.description ?? "").toLowerCase().includes(q) ||
        labels.employeeName(r.employee_id).toLowerCase().includes(q) ||
        labels.taskName(r.task_id).toLowerCase().includes(q)
      }
    />
  );
}
