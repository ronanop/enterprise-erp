"use client";

import { useCallback, useMemo } from "react";
import { FileText } from "lucide-react";

import { DOCUMENT_STATUSES, DOCUMENT_TYPES } from "@/components/projects/projects-domain";
import {
  orNull,
  ProjectsRecordForm,
  type FormSection,
  type FormValues,
} from "@/components/projects/projects-record-form";
import {
  createProjectDocument,
  getProjectDocument,
  listEmployeeOptions,
  listMilestoneOptions,
  listProjectOptions,
  listTaskOptions,
  updateProjectDocument,
  type ProjectDocumentFormInput,
} from "@/services/projects-portal-service";

const EMPTY: FormValues = {
  project_id: "",
  task_id: "",
  milestone_id: "",
  document_type: "other",
  document_name: "",
  storage_uri: "",
  uploaded_by_employee_id: "",
  status: "active",
};

export function ProjectDocumentFormPage({
  documentId,
  presetProjectId,
}: {
  documentId?: string;
  presetProjectId?: string;
}) {
  const isEdit = Boolean(documentId);

  const load = useCallback(async () => {
    const [projects, tasks, milestones, employees, record] = await Promise.all([
      listProjectOptions().catch(() => []),
      listTaskOptions().catch(() => []),
      listMilestoneOptions().catch(() => []),
      listEmployeeOptions().catch(() => []),
      documentId ? getProjectDocument(documentId) : Promise.resolve(null),
    ]);

    const values: FormValues = record
      ? {
          project_id: record.project_id,
          task_id: record.task_id ?? "",
          milestone_id: record.milestone_id ?? "",
          document_type: record.document_type,
          document_name: record.document_name,
          storage_uri: record.storage_uri ?? "",
          uploaded_by_employee_id: record.uploaded_by_employee_id ?? "",
          status: record.status,
        }
      : { project_id: presetProjectId ?? "" };

    return { values, lookups: { projects, tasks, milestones, employees } };
  }, [documentId, presetProjectId]);

  const onSave = useCallback(
    async (v: FormValues) => {
      const payload: ProjectDocumentFormInput = {
        project_id: v.project_id,
        task_id: orNull(v.task_id),
        milestone_id: orNull(v.milestone_id),
        document_type: v.document_type || "other",
        document_name: v.document_name.trim(),
        storage_uri: orNull(v.storage_uri),
        uploaded_by_employee_id: orNull(v.uploaded_by_employee_id),
        status: v.status || "active",
      };

      const saved =
        isEdit && documentId
          ? await updateProjectDocument(documentId, payload)
          : await createProjectDocument(payload);

      return `/projects/projects/${saved.project_id}`;
    },
    [isEdit, documentId],
  );

  const sections = useMemo<FormSection[]>(
    () => [
      {
        title: "Document Information",
        subtitle: "Attach deliverables and reference material to a project, task, or milestone",
        icon: FileText,
        fields: [
          {
            name: "project_id",
            label: "Project",
            type: "select",
            required: true,
            optionsKey: "projects",
          },
          { name: "document_name", label: "Document Name", type: "text", required: true },
          {
            name: "document_type",
            label: "Document Type",
            type: "select",
            required: true,
            options: DOCUMENT_TYPES,
          },
          {
            name: "status",
            label: "Status",
            type: "select",
            required: true,
            options: DOCUMENT_STATUSES,
          },
          {
            name: "task_id",
            label: "Task",
            type: "select",
            optionsKey: "tasks",
            placeholder: "Not task specific",
          },
          {
            name: "milestone_id",
            label: "Milestone",
            type: "select",
            optionsKey: "milestones",
            placeholder: "Not milestone specific",
          },
          {
            name: "uploaded_by_employee_id",
            label: "Uploaded By",
            type: "select",
            optionsKey: "employees",
          },
          {
            name: "storage_uri",
            label: "Storage URI",
            type: "text",
            full: true,
            placeholder: "s3://bucket/path/to/file.pdf",
          },
        ],
      },
    ],
    [],
  );

  return (
    <ProjectsRecordForm
      title={isEdit ? "Edit Document" : "New Document"}
      description="Documents are versioned — mark the old record superseded rather than deleting it."
      backHref="/projects/project-documents"
      backLabel="Back to documents"
      submitLabel={isEdit ? "Save changes" : "Create Document"}
      sections={sections}
      emptyValues={EMPTY}
      load={load}
      onSave={onSave}
    />
  );
}
