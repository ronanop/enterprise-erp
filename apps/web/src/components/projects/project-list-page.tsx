"use client";

import { useCallback, useMemo } from "react";
import Link from "next/link";
import { FolderKanban } from "lucide-react";

import { FinanceStatusBadge } from "@/components/finance/finance-status-badge";
import { projectTypeLabel } from "@/components/projects/projects-domain";
import {
  ProjectsRecordList,
  type RecordColumn,
} from "@/components/projects/projects-record-list";
import { useProjectsLookups } from "@/components/projects/use-projects-lookups";
import { useAuthUser } from "@/hooks/use-auth-user";
import {
  formatDate,
  listProjects,
  type Project,
} from "@/services/projects-portal-service";

const LOOKUPS = ["employees", "customers"] as const;

export function ProjectListPage() {
  const { projectModuleAdmin } = useAuthUser();
  const { loadLookups, labels } = useProjectsLookups(LOOKUPS);

  const load = useCallback(async () => {
    const [rows] = await Promise.all([listProjects(), loadLookups()]);
    return rows;
  }, [loadLookups]);

  const columns = useMemo<RecordColumn<Project>[]>(
    () => [
      {
        key: "project_name",
        label: "Project",
        sort: (r) => r.project_name,
        className: "font-medium text-foreground",
        cell: (r) => (
          <Link href={`/projects/projects/${r.id}`} className="cursor-pointer hover:underline">
            {r.project_name}
          </Link>
        ),
      },
      {
        key: "project_code",
        label: "Code",
        sort: (r) => r.project_code,
        className: "font-mono text-xs text-muted-foreground",
        cell: (r) => r.project_code,
      },
      {
        key: "project_type",
        label: "Type",
        sort: (r) => r.project_type,
        cell: (r) => projectTypeLabel(r.project_type),
      },
      {
        key: "customer_id",
        label: "Customer",
        sort: (r) => r.customer_name || labels.customerName(r.customer_id),
        cell: (r) => r.customer_name || labels.customerName(r.customer_id),
      },
      {
        key: "project_manager_employee_id",
        label: "Manager",
        sort: (r) => labels.employeeName(r.project_manager_employee_id),
        cell: (r) => labels.employeeName(r.project_manager_employee_id),
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
      title="Projects"
      description={
        projectModuleAdmin
          ? "Delivery portfolio — every project from request through approval, execution, and closure. Open a project to manage its WBS, resources, budget, and risks."
          : "Projects you are assigned to. Open My Jobs to complete your delivery steps."
      }
      panelTitle="Portfolio"
      panelSubtitle={projectModuleAdmin ? "Project register" : "Assigned projects"}
      icon={FolderKanban}
      searchPlaceholder="Search projects…"
      loadingMessage="Loading projects…"
      emptyMessage="No projects yet. Create one from the PO Queue to start delivery."
      errorMessage="Failed to load projects"
      minWidth={1200}
      columns={columns}
      defaultSortKey="created_at"
      defaultSortDir="desc"
      load={load}
      matches={(r, q) =>
        r.project_name.toLowerCase().includes(q) ||
        r.project_code.toLowerCase().includes(q) ||
        r.project_type.toLowerCase().includes(q) ||
        (r.customer_name || labels.customerName(r.customer_id)).toLowerCase().includes(q)
      }
    />
  );
}
