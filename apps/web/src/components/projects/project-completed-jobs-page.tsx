"use client";

import { useCallback, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";

import { MyJobOpenStepButton } from "@/components/projects/my-job-open-step-button";
import {
  siteDeliveryTypeLabel,
  siteWorkflowStageLabel,
} from "@/components/projects/projects-domain";
import {
  ProjectsRecordList,
  type RecordColumn,
} from "@/components/projects/projects-record-list";
import { useAuthUser } from "@/hooks/use-auth-user";
import { listProjectCompletedJobs, type ProjectMyJob } from "@/services/projects-portal-service";

export function ProjectCompletedJobsPage() {
  const router = useRouter();
  const { projectModuleAdmin, loading: authLoading } = useAuthUser();
  const load = useCallback(async () => listProjectCompletedJobs(), []);

  useEffect(() => {
    if (authLoading || !projectModuleAdmin) return;
    router.replace("/projects/projects");
  }, [authLoading, projectModuleAdmin, router]);

  const columns = useMemo<RecordColumn<ProjectMyJob>[]>(
    () => [
      {
        key: "stage",
        label: "Step",
        sort: (r) => r.stage_label,
        className: "font-medium text-foreground",
        cell: (r) => r.stage_label,
      },
      {
        key: "document_number",
        label: "Site ID",
        sort: (r) => r.document_number,
        className: "font-mono text-xs text-muted-foreground",
        cell: (r) => r.document_number,
      },
      {
        key: "project_name",
        label: "Project",
        sort: (r) => r.project_name,
        cell: (r) => (
          <Link
            href={`/projects/projects/${r.project_id}`}
            className="cursor-pointer font-medium text-foreground hover:underline"
          >
            {r.project_name}
          </Link>
        ),
      },
      {
        key: "site_name",
        label: "Site",
        sort: (r) => r.site_name ?? "",
        cell: (r) => r.site_name || "—",
      },
      {
        key: "delivery_type",
        label: "Delivery",
        sort: (r) => r.delivery_type,
        cell: (r) => siteDeliveryTypeLabel(r.delivery_type),
      },
      {
        key: "workflow_stage",
        label: "Current stage",
        sort: (r) => r.workflow_stage,
        cell: (r) => siteWorkflowStageLabel(r.workflow_stage),
      },
      {
        key: "action",
        label: "",
        sort: () => "",
        align: "right",
        cell: (r) => <MyJobOpenStepButton job={r} completed />,
      },
    ],
    [],
  );

  if (authLoading || projectModuleAdmin) {
    return (
      <div className="space-y-3">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="h-40 animate-pulse rounded-xl bg-muted/60" />
      </div>
    );
  }

  return (
    <ProjectsRecordList
      title="Completed Jobs"
      description="Steps you finished on assigned projects. Open any row to review your submitted work in read-only mode."
      panelTitle="Completed steps"
      panelSubtitle="Steps where your assignment is done and the workflow has moved forward"
      icon={CheckCircle2}
      searchPlaceholder="Search project, site, or step…"
      emptyMessage="No completed steps yet. Finished work appears here after the site moves to the next stage."
      loadingMessage="Loading completed steps…"
      errorMessage="Failed to load Completed Jobs"
      minWidth={1000}
      columns={columns}
      defaultSortKey="stage"
      load={async () => {
        const rows = await load();
        return rows.map((row) => ({
          ...row,
          id: `${row.site_installation_id}:${row.assigned_stage}`,
        }));
      }}
      matches={(r, q) =>
        r.stage_label.toLowerCase().includes(q) ||
        r.project_name.toLowerCase().includes(q) ||
        r.document_number.toLowerCase().includes(q) ||
        (r.site_name ?? "").toLowerCase().includes(q) ||
        r.workflow_stage.toLowerCase().includes(q)
      }
    />
  );
}
