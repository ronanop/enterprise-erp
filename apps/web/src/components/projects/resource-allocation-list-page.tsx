"use client";

import { useCallback, useMemo } from "react";
import Link from "next/link";
import { Users } from "lucide-react";

import { FinanceStatusBadge } from "@/components/finance/finance-status-badge";
import { resourceTypeLabel } from "@/components/projects/projects-domain";
import {
  ProjectsRecordList,
  type RecordColumn,
} from "@/components/projects/projects-record-list";
import { useProjectsLookups } from "@/components/projects/use-projects-lookups";
import {
  formatDate,
  listResourceAllocations,
  type ResourceAllocation,
} from "@/services/projects-portal-service";

const LOOKUPS = ["projects", "employees", "plans"] as const;

export function ResourceAllocationListPage() {
  const { loadLookups, labels } = useProjectsLookups(LOOKUPS);

  const load = useCallback(async () => {
    const [rows] = await Promise.all([listResourceAllocations(), loadLookups()]);
    return rows;
  }, [loadLookups]);

  const columns = useMemo<RecordColumn<ResourceAllocation>[]>(
    () => [
      {
        key: "employee_id",
        label: "Resource",
        sort: (r) => labels.employeeName(r.employee_id),
        className: "font-medium text-foreground",
        cell: (r) => (
          <Link
            href={`/projects/resource-allocations/${r.id}/edit`}
            className="cursor-pointer hover:underline"
          >
            {labels.employeeName(r.employee_id)}
          </Link>
        ),
      },
      {
        key: "resource_type",
        label: "Type",
        sort: (r) => r.resource_type,
        cell: (r) => resourceTypeLabel(r.resource_type),
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
        key: "resource_plan_id",
        label: "Plan",
        sort: (r) => labels.planName(r.resource_plan_id),
        cell: (r) => labels.planName(r.resource_plan_id),
      },
      {
        key: "allocation_percent",
        label: "Allocation",
        align: "right",
        sort: (r) => Number(r.allocation_percent ?? 0),
        className: "text-right tabular-nums text-foreground",
        cell: (r) => `${Number(r.allocation_percent ?? 0).toFixed(2)}%`,
      },
      {
        key: "start_date",
        label: "Start",
        sort: (r) => r.start_date,
        cell: (r) => formatDate(r.start_date),
      },
      {
        key: "end_date",
        label: "End",
        sort: (r) => r.end_date,
        cell: (r) => formatDate(r.end_date),
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
      title="Allocations"
      description="Who is booked on what, and for how much of their capacity. Combined allocation for a resource cannot exceed 100%."
      panelTitle="Resource allocations"
      panelSubtitle="Capacity bookings"
      icon={Users}
      newHref="/projects/resource-allocations/new"
      newLabel="New Allocation"
      searchPlaceholder="Search allocations…"
      loadingMessage="Loading allocations…"
      emptyMessage="No allocations yet. Assign resources to a project through a resource plan."
      errorMessage="Failed to load resource allocations"
      minWidth={1150}
      columns={columns}
      defaultSortKey="start_date"
      defaultSortDir="desc"
      load={load}
      matches={(r, q) =>
        labels.employeeName(r.employee_id).toLowerCase().includes(q) ||
        labels.projectName(r.project_id).toLowerCase().includes(q) ||
        r.resource_type.toLowerCase().includes(q)
      }
    />
  );
}
