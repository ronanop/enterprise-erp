"use client";

import { useCallback, useMemo } from "react";
import Link from "next/link";
import { FileText } from "lucide-react";

import { FinanceStatusBadge } from "@/components/finance/finance-status-badge";
import { documentTypeLabel } from "@/components/projects/projects-domain";
import {
  ProjectsRecordList,
  type RecordColumn,
} from "@/components/projects/projects-record-list";
import { useProjectsLookups } from "@/components/projects/use-projects-lookups";
import {
  formatDate,
  listProjectDocuments,
  type ProjectDocument,
} from "@/services/projects-portal-service";

const LOOKUPS = ["projects", "tasks", "milestones", "employees"] as const;

export function ProjectDocumentListPage() {
  const { loadLookups, labels } = useProjectsLookups(LOOKUPS);

  const load = useCallback(async () => {
    const [rows] = await Promise.all([listProjectDocuments(), loadLookups()]);
    return rows;
  }, [loadLookups]);

  const columns = useMemo<RecordColumn<ProjectDocument>[]>(
    () => [
      {
        key: "document_name",
        label: "Document",
        sort: (r) => r.document_name,
        className: "font-medium text-foreground",
        cell: (r) => (
          <Link
            href={`/projects/project-documents/${r.id}/edit`}
            className="cursor-pointer hover:underline"
          >
            {r.document_name}
          </Link>
        ),
      },
      {
        key: "document_type",
        label: "Type",
        sort: (r) => r.document_type,
        cell: (r) => documentTypeLabel(r.document_type),
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
        key: "milestone_id",
        label: "Milestone",
        sort: (r) => labels.milestoneName(r.milestone_id),
        cell: (r) => labels.milestoneName(r.milestone_id),
      },
      {
        key: "uploaded_by_employee_id",
        label: "Uploaded By",
        sort: (r) => labels.employeeName(r.uploaded_by_employee_id),
        cell: (r) => labels.employeeName(r.uploaded_by_employee_id),
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
      title="Documents"
      description="Project artefacts — BRDs, designs, reports, and contracts linked to a project, task, or milestone."
      panelTitle="Document registry"
      panelSubtitle="Project artefacts"
      icon={FileText}
      newHref="/projects/project-documents/new"
      newLabel="New Document"
      searchPlaceholder="Search documents…"
      loadingMessage="Loading documents…"
      emptyMessage="No documents registered against any project yet."
      errorMessage="Failed to load project documents"
      minWidth={1250}
      columns={columns}
      defaultSortKey="document_name"
      load={load}
      matches={(r, q) =>
        r.document_name.toLowerCase().includes(q) ||
        r.document_type.toLowerCase().includes(q) ||
        labels.projectName(r.project_id).toLowerCase().includes(q)
      }
    />
  );
}
