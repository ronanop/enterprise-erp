"use client";

import { useCallback, useMemo } from "react";
import {
  CalendarRange,
  FolderKanban,
  IndianRupee,
  MapPin,
  Users,
} from "lucide-react";

import {
  BILLING_TYPES,
  HEALTH_STATUSES,
  PROJECT_STATUSES,
  PROJECT_TYPES,
  SITE_DELIVERY_TYPES,
} from "@/components/projects/projects-domain";
import {
  orNull,
  ProjectsRecordForm,
  type FormSection,
  type FormValues,
} from "@/components/projects/projects-record-form";
import {
  createProject,
  getProject,
  listBranchOptions,
  listCustomerOptions,
  listDepartmentOptions,
  listEmployeeOptions,
  updateProject,
  type ProjectFormInput,
} from "@/services/projects-portal-service";

const EMPTY_CREATE: FormValues = {
  branch_id: "",
  customer_id: "",
  delivery_type: "server_os_rack",
  site_name: "",
  power_requirements: "",
  rfai_request_done: "",
  rfai_number: "",
};

const EMPTY_EDIT: FormValues = {
  project_code: "",
  branch_id: "",
  project_name: "",
  project_type: "implementation",
  customer_id: "",
  department_id: "",
  project_manager_employee_id: "",
  sponsor_employee_id: "",
  planned_start_date: "",
  planned_end_date: "",
  actual_start_date: "",
  actual_end_date: "",
  budget_amount: "",
  currency_code: "INR",
  billing_type: "",
  health_status: "",
  description: "",
  status: "draft",
};

export function ProjectFormPage({ projectId }: { projectId?: string }) {
  const isEdit = Boolean(projectId);

  const load = useCallback(async () => {
    const [branches, employees, customers, departments, record] = await Promise.all([
      listBranchOptions().catch(() => []),
      listEmployeeOptions().catch(() => []),
      listCustomerOptions().catch(() => []),
      listDepartmentOptions().catch(() => []),
      projectId ? getProject(projectId) : Promise.resolve(null),
    ]);

    if (record) {
      return {
        values: {
          project_code: record.project_code,
          branch_id: record.branch_id,
          project_name: record.project_name,
          project_type: record.project_type,
          customer_id: record.customer_id ?? "",
          department_id: record.department_id ?? "",
          project_manager_employee_id: record.project_manager_employee_id,
          sponsor_employee_id: record.sponsor_employee_id ?? "",
          planned_start_date: record.planned_start_date,
          planned_end_date: record.planned_end_date,
          actual_start_date: record.actual_start_date ?? "",
          actual_end_date: record.actual_end_date ?? "",
          budget_amount: record.budget_amount ?? "",
          currency_code: record.currency_code,
          billing_type: record.billing_type ?? "",
          health_status: record.health_status ?? "",
          description: record.description ?? "",
          status: record.status,
        } satisfies FormValues,
        lookups: { branches, employees, customers, departments },
      };
    }

    return {
      values: { branch_id: branches[0]?.id ?? "" },
      lookups: { branches, employees, customers, departments },
    };
  }, [projectId]);

  const onSave = useCallback(
    async (v: FormValues) => {
      if (!isEdit) {
        const siteName = v.site_name.trim();
        const rfaiYes = v.rfai_request_done === "true";
        const saved = await createProject({
          branch_id: v.branch_id,
          customer_id: orNull(v.customer_id),
          site_installation: {
            delivery_type: v.delivery_type || "server_os_rack",
            site_name: orNull(siteName),
            power_requirements: rfaiYes ? orNull(v.power_requirements) : null,
            rfai_request_done: rfaiYes,
            rfai_number: rfaiYes ? orNull(v.rfai_number) : null,
          },
        });
        return `/projects/projects/${saved.id}/survey`;
      }

      const payload: ProjectFormInput = {
        project_name: v.project_name.trim(),
        project_type: v.project_type,
        customer_id: orNull(v.customer_id),
        department_id: orNull(v.department_id),
        project_manager_employee_id: v.project_manager_employee_id,
        sponsor_employee_id: orNull(v.sponsor_employee_id),
        planned_start_date: v.planned_start_date,
        planned_end_date: v.planned_end_date,
        actual_start_date: orNull(v.actual_start_date),
        actual_end_date: orNull(v.actual_end_date),
        budget_amount: orNull(v.budget_amount),
        currency_code: v.currency_code.trim() || "INR",
        billing_type: orNull(v.billing_type),
        health_status: orNull(v.health_status),
        description: orNull(v.description),
        status: v.status || "draft",
      };

      const saved = await updateProject(projectId!, payload);
      return `/projects/projects/${saved.id}`;
    },
    [isEdit, projectId],
  );

  const sections = useMemo<FormSection[]>(() => {
    if (!isEdit) {
      return [
        {
          title: "Intake / Site request",
          subtitle: "Step 1 — Customer → Site → RFAI → Power (when RFAI is Yes)",
          icon: MapPin,
          fields: [
            {
              name: "branch_id",
              label: "Branch",
              type: "select",
              required: true,
              optionsKey: "branches",
              placeholder: "Select branch…",
              hint: "Your org office — not the telecom customer.",
            },
            {
              name: "delivery_type",
              label: "Delivery Type",
              type: "select",
              required: true,
              options: SITE_DELIVERY_TYPES,
            },
            {
              name: "customer_id",
              label: "Customer",
              type: "select",
              required: true,
              optionsKey: "customers",
              placeholder: "Select customer…",
              creatable: "customer",
              createNewLabel: "New Customer…",
              hint: "e.g. Airtel — pick existing or create new.",
            },
            {
              name: "site_name",
              label: "Site",
              type: "text",
              required: true,
              placeholder: "Site name / site list entry…",
            },
            {
              name: "rfai_request_done",
              label: "RFAI Request",
              type: "yesno",
              required: true,
              hint: "If No, Power Requirements and RFAI Number are hidden.",
              clearFieldsOnChange: ["rfai_number", "power_requirements"],
            },
            {
              name: "rfai_number",
              label: "RFAI Number",
              type: "text",
              required: true,
              placeholder: "RFAI reference number…",
              visibleWhen: (vals) => vals.rfai_request_done === "true",
            },
            {
              name: "power_requirements",
              label: "Power Requirements",
              type: "textarea",
              required: true,
              full: true,
              placeholder: "Power load, feed, redundancy…",
              visibleWhen: (vals) => vals.rfai_request_done === "true",
            },
          ],
        },
      ];
    }

    return [
      {
        title: "Project Information",
        subtitle: "Identity, type, and ownership",
        icon: FolderKanban,
        fields: [
          { name: "project_code", label: "Project Code", type: "readonly" },
          { name: "project_name", label: "Project Name", type: "text", required: true },
          {
            name: "project_type",
            label: "Project Type",
            type: "select",
            required: true,
            options: PROJECT_TYPES,
          },
          {
            name: "status",
            label: "Status",
            type: "select",
            required: true,
            options: PROJECT_STATUSES,
          },
          {
            name: "customer_id",
            label: "Customer",
            type: "select",
            optionsKey: "customers",
            placeholder: "Internal / no customer",
            creatable: "customer",
            createNewLabel: "New Customer…",
          },
          {
            name: "department_id",
            label: "Department",
            type: "select",
            optionsKey: "departments",
          },
          {
            name: "health_status",
            label: "Health",
            type: "select",
            options: HEALTH_STATUSES,
          },
        ],
      },
      {
        title: "Ownership",
        subtitle: "Delivery accountability",
        icon: Users,
        fields: [
          {
            name: "project_manager_employee_id",
            label: "Project Manager",
            type: "select",
            required: true,
            optionsKey: "employees",
          },
          {
            name: "sponsor_employee_id",
            label: "Sponsor",
            type: "select",
            optionsKey: "employees",
          },
        ],
      },
      {
        title: "Schedule",
        subtitle: "Planned window and actual execution dates",
        icon: CalendarRange,
        fields: [
          {
            name: "planned_start_date",
            label: "Planned Start Date",
            type: "date",
            required: true,
          },
          {
            name: "planned_end_date",
            label: "Planned End Date",
            type: "date",
            required: true,
            hint: "Must be on or after the planned start date.",
          },
          { name: "actual_start_date", label: "Actual Start Date", type: "date" },
          { name: "actual_end_date", label: "Actual End Date", type: "date" },
        ],
      },
      {
        title: "Commercials",
        subtitle: "Budget and billing model",
        icon: IndianRupee,
        fields: [
          { name: "budget_amount", label: "Budget Amount", type: "number", step: "0.01" },
          { name: "currency_code", label: "Currency", type: "text" },
          { name: "billing_type", label: "Billing Type", type: "select", options: BILLING_TYPES },
          {
            name: "description",
            label: "Description",
            type: "textarea",
            full: true,
            placeholder: "Scope summary, deliverables, and key assumptions…",
          },
        ],
      },
    ];
  }, [isEdit]);

  return (
    <ProjectsRecordForm
      title={isEdit ? "Edit Project" : "New Site Request"}
      description={
        isEdit
          ? "Update project scope, schedule, and commercials."
          : "Step 1 — Intake / Site request. After create you continue to Survey."
      }
      backHref={isEdit && projectId ? `/projects/projects/${projectId}` : "/projects/projects"}
      backLabel={isEdit ? "Back to project" : "Back to projects"}
      submitLabel={isEdit ? "Save changes" : "Create Project"}
      sections={sections}
      emptyValues={isEdit ? EMPTY_EDIT : EMPTY_CREATE}
      load={load}
      onSave={onSave}
    />
  );
}
