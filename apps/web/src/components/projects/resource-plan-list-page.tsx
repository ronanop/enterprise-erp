"use client";

import { useCallback, useMemo } from "react";
import Link from "next/link";
import { CalendarRange } from "lucide-react";

import { FinanceStatusBadge } from "@/components/finance/finance-status-badge";
import {
  ProjectsRecordList,
  type RecordColumn,
} from "@/components/projects/projects-record-list";
import { useProjectsLookups } from "@/components/projects/use-projects-lookups";
import {
  formatDate,
  listResourcePlans,
  type ResourcePlan,
} from "@/services/projects-portal-service";

const LOOKUPS = ["projects"] as const;

export function ResourcePlanListPage() {
  const { loadLookups, labels } = useProjectsLookups(LOOKUPS);

  const load = useCallback(async () => {
    const [rows] = await Promise.all([listResourcePlans(), loadLookups()]);
    return rows;
  }, [loadLookups]);

  const columns = useMemo<RecordColumn<ResourcePlan>[]>(
    () => [
      {
        key: "plan_name",
        label: "Plan",
        sort: (r) => r.plan_name,
        className: "font-medium text-foreground",
        cell: (r) => (
          <Link
            href={`/projects/resource-plans/${r.id}/edit`}
            className="cursor-pointer hover:underline"
          >
            {r.plan_name}
          </Link>
        ),
      },
      {
        key: "document_number",
        label: "Plan No.",
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
        key: "planned_from",
        label: "From",
        sort: (r) => r.planned_from,
        cell: (r) => formatDate(r.planned_from),
      },
      {
        key: "planned_to",
        label: "To",
        sort: (r) => r.planned_to,
        cell: (r) => formatDate(r.planned_to),
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
      title="Resource Plans"
      description="Staffing windows per project. Allocations hang off a plan and are validated so no resource exceeds 100%."
      panelTitle="Resource plans"
      panelSubtitle="Staffing windows"
      icon={CalendarRange}
      newHref="/projects/resource-plans/new"
      newLabel="New Plan"
      searchPlaceholder="Search plans…"
      loadingMessage="Loading resource plans…"
      emptyMessage="No resource plans yet. Create one before allocating people to a project."
      errorMessage="Failed to load resource plans"
      minWidth={1000}
      columns={columns}
      defaultSortKey="planned_from"
      defaultSortDir="desc"
      load={load}
      matches={(r, q) =>
        r.plan_name.toLowerCase().includes(q) ||
        r.document_number.toLowerCase().includes(q) ||
        labels.projectName(r.project_id).toLowerCase().includes(q)
      }
    />
  );
}
