"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { Briefcase } from "lucide-react";

import { MyJobOpenStepButton } from "@/components/projects/my-job-open-step-button";
import { WorkflowStepBlockedDialog } from "@/components/projects/workflow-step-blocked-dialog";
import {
  siteDeliveryTypeLabel,
  siteWorkflowStageLabel,
} from "@/components/projects/projects-domain";
import {
  ProjectsRecordList,
  type RecordColumn,
} from "@/components/projects/projects-record-list";
import { listProjectMyJobs, type ProjectMyJob } from "@/services/projects-portal-service";

export function ProjectMyJobsPage() {
  const [blockedMessage, setBlockedMessage] = useState<string | null>(null);
  const load = useCallback(async () => listProjectMyJobs(), []);

  const columns = useMemo<RecordColumn<ProjectMyJob>[]>(
    () => [
      {
        key: "stage",
        label: "Your step",
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
        cell: (r) => <MyJobOpenStepButton job={r} onBlocked={setBlockedMessage} />,
      },
    ],
    [],
  );

  return (
    <>
      <ProjectsRecordList
        title="My Jobs"
        description="Active delivery steps you own. When a step is finished and the site moves on, it moves to Completed Jobs."
        panelTitle="Assigned steps"
        panelSubtitle="All steps assigned to your employee record across visible projects"
        icon={Briefcase}
        searchPlaceholder="Search project, site, or stage…"
        emptyMessage="No steps assigned to you right now. A project admin assigns owners on the Assign stage screen."
        loadingMessage="Loading your assigned steps…"
        errorMessage="Failed to load My Jobs"
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
      <WorkflowStepBlockedDialog
        open={blockedMessage !== null}
        message={blockedMessage ?? ""}
        onClose={() => setBlockedMessage(null)}
      />
    </>
  );
}
