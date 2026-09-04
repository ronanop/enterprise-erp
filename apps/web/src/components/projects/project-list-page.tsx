"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { Download, FolderKanban } from "lucide-react";

import {
  ProjectsRecordList,
  type RecordColumn,
} from "@/components/projects/projects-record-list";
import { useProjectsLookups } from "@/components/projects/use-projects-lookups";
import { Button } from "@/components/ui/button";
import { useAuthUser } from "@/hooks/use-auth-user";
import { downloadXlsx } from "@/lib/spreadsheet";
import {
  formatDate,
  listProjects,
  type Project,
} from "@/services/projects-portal-service";

const LOOKUPS = ["employees", "customers"] as const;

export function ProjectListPage() {
  const { projectModuleAdmin } = useAuthUser();
  const { loadLookups, labels } = useProjectsLookups(LOOKUPS);
  const [exporting, setExporting] = useState(false);

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
        key: "current_stage",
        label: "Current Step",
        sort: (r) => r.current_stage_label || r.current_stage || "",
        cell: (r) => r.current_stage_label || r.current_stage || "—",
      },
      {
        key: "current_stage_owner_name",
        label: "Step Owner",
        sort: (r) => r.current_stage_owner_name || "",
        cell: (r) => r.current_stage_owner_name || "—",
      },
      {
        key: "created_at",
        label: "Date Created",
        sort: (r) => r.created_at,
        cell: (r) => formatDate(r.created_at),
      },
    ],
    [labels],
  );

  const exportPortfolio = useCallback(
    async (rows: Project[]) => {
      setExporting(true);
      try {
        const sheetRows = rows.map((r) => ({
          Project: r.project_name,
          Code: r.project_code,
          Customer: r.customer_name || labels.customerName(r.customer_id),
          Manager: labels.employeeName(r.project_manager_employee_id),
          "Current Step": r.current_stage_label || r.current_stage || "",
          "Step Owner": r.current_stage_owner_name || "",
          "Date Created": formatDate(r.created_at),
        }));
        const stamp = new Date().toISOString().slice(0, 10);
        await downloadXlsx(`projects-portfolio-${stamp}.xlsx`, [
          { name: "Portfolio", rows: sheetRows },
        ]);
      } finally {
        setExporting(false);
      }
    },
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
        (r.customer_name || labels.customerName(r.customer_id)).toLowerCase().includes(q) ||
        (r.current_stage_label || "").toLowerCase().includes(q) ||
        (r.current_stage_owner_name || "").toLowerCase().includes(q)
      }
      headerActions={({ rows, loading }) => (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="cursor-pointer"
          disabled={loading || exporting || rows.length === 0}
          onClick={() => void exportPortfolio(rows)}
        >
          <Download className="size-3.5" />
          {exporting ? "Exporting…" : "Export Excel"}
        </Button>
      )}
    />
  );
}
