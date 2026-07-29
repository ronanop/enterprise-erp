"use client";

import { useCallback, useMemo } from "react";
import { CalendarRange, FolderKanban, MapPin } from "lucide-react";

import {
  PROJECT_STATUSES,
  SITE_DELIVERY_TYPES,
  siteWorkflowStageLabel,
} from "@/components/projects/projects-domain";
import {
  orNull,
  ProjectsRecordForm,
  type FormSection,
  type FormValues,
  type Lookups,
} from "@/components/projects/projects-record-form";
import {
  createProject,
  getProject,
  getSiteInstallationByProject,
  listBranchOptions,
  listCustomerOptions,
  listEmployeeOptions,
  listProjectManagementTeamOptions,
  updateProject,
  updateSiteInstallationByProject,
  type ProjectFormInput,
} from "@/services/projects-portal-service";

const EMPTY_CREATE: FormValues = {
  branch_id: "",
  customer_id: "",
  delivery_type: "server_os_rack",
  site_name: "",
  project_manager_employee_id: "",
  power_requirements: "",
  rfai_request_done: "",
  rfai_number: "",
};

const EMPTY_EDIT: FormValues = {
  project_code: "",
  workflow_stage_label: "",
  branch_id: "",
  branch_label: "",
  project_name: "",
  customer_id: "",
  delivery_type: "server_os_rack",
  site_name: "",
  project_manager_employee_id: "",
  rfai_request_done: "false",
  rfai_number: "",
  power_requirements: "",
  circle: "",
  cloud_name: "",
  fabric_partner: "",
  application: "",
  remarks: "",
  planned_start_date: "",
  planned_end_date: "",
  status: "draft",
};

export function ProjectFormPage({ projectId }: { projectId?: string }) {
  const isEdit = Boolean(projectId);

  const load = useCallback(async (): Promise<{ values?: FormValues; lookups?: Lookups }> => {
    const [branches, employees, pmTeam, customers, record] = await Promise.all([
      listBranchOptions().catch(() => []),
      listEmployeeOptions().catch(() => []),
      listProjectManagementTeamOptions().catch(() => []),
      listCustomerOptions().catch(() => []),
      projectId ? getProject(projectId) : Promise.resolve(null),
    ]);
    const team = pmTeam.length > 0 ? pmTeam : employees;
    const lookups: Lookups = {
      branches,
      employees,
      pmTeam: team,
      customers,
    };

    if (record) {
      const site = await getSiteInstallationByProject(projectId!).catch(() => null);
      const branchLabel =
        branches.find((b) => b.id === record.branch_id)?.label ?? record.branch_id;

      const values: FormValues = {
        project_code: record.project_code,
        workflow_stage_label: site
          ? siteWorkflowStageLabel(site.workflow_stage)
          : "—",
        branch_id: record.branch_id,
        branch_label: branchLabel,
        project_name: record.project_name,
        customer_id: record.customer_id ?? "",
        delivery_type: site?.delivery_type || "server_os_rack",
        site_name: site?.site_name ?? "",
        project_manager_employee_id: record.project_manager_employee_id,
        rfai_request_done: site?.rfai_request_done ? "true" : "false",
        rfai_number: site?.rfai_number ?? "",
        power_requirements: site?.power_requirements ?? "",
        circle: site?.circle ?? "",
        cloud_name: site?.cloud_name ?? "",
        fabric_partner: site?.fabric_partner ?? "",
        application: site?.application ?? "",
        remarks: site?.remarks ?? "",
        planned_start_date: record.planned_start_date,
        planned_end_date: record.planned_end_date,
        status: record.status,
      };
      return { values, lookups };
    }

    return {
      values: {
        branch_id: branches[0]?.id ?? "",
        project_manager_employee_id: team[0]?.id ?? "",
      },
      lookups,
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
          project_manager_employee_id: v.project_manager_employee_id || undefined,
          site_installation: {
            delivery_type: v.delivery_type || "server_os_rack",
            site_name: orNull(siteName),
            power_requirements: rfaiYes ? orNull(v.power_requirements) : null,
            rfai_request_done: rfaiYes,
            rfai_number: rfaiYes ? orNull(v.rfai_number) : null,
          },
        });
        return `/projects/projects/${saved.id}/assign`;
      }

      const rfaiYes = v.rfai_request_done === "true";
      const siteName = v.site_name.trim();
      const projectPayload: ProjectFormInput = {
        project_name: v.project_name.trim() || siteName || "Site Installation Request",
        customer_id: orNull(v.customer_id),
        project_manager_employee_id: v.project_manager_employee_id,
        planned_start_date: v.planned_start_date,
        planned_end_date: v.planned_end_date,
        status: v.status || "draft",
      };

      await Promise.all([
        updateProject(projectId!, projectPayload),
        updateSiteInstallationByProject(projectId!, {
          delivery_type: v.delivery_type || "server_os_rack",
          site_name: orNull(siteName),
          rfai_request_done: rfaiYes,
          rfai_number: rfaiYes ? orNull(v.rfai_number) : null,
          power_requirements: rfaiYes ? orNull(v.power_requirements) : null,
          circle: orNull(v.circle),
          cloud_name: orNull(v.cloud_name),
          fabric_partner: orNull(v.fabric_partner),
          application: orNull(v.application),
          remarks: orNull(v.remarks),
        }),
      ]);

      return `/projects/projects/${projectId}`;
    },
    [isEdit, projectId],
  );

  const sections = useMemo<FormSection[]>(() => {
    if (!isEdit) {
      return [
        {
          title: "Intake / Site request",
          subtitle: "Step 1 — Customer → Site → Project Manager → RFAI → Power (when RFAI is Yes)",
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
              name: "project_manager_employee_id",
              label: "Project Manager",
              type: "select",
              required: true,
              optionsKey: "pmTeam",
              placeholder: "Select project manager…",
              hint: "Owns this site request and assigns stage owners next.",
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
        title: "Site request",
        subtitle: "Delivery scope, customer site, and RFAI — same fields used in the site workflow",
        icon: MapPin,
        fields: [
          { name: "project_code", label: "Project Code", type: "readonly" },
          {
            name: "workflow_stage_label",
            label: "Workflow Stage",
            type: "readonly",
          },
          { name: "branch_label", label: "Branch", type: "readonly" },
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
          },
          {
            name: "site_name",
            label: "Site",
            type: "text",
            required: true,
            placeholder: "Site name / site list entry…",
          },
          {
            name: "project_manager_employee_id",
            label: "Project Manager",
            type: "select",
            required: true,
            optionsKey: "pmTeam",
            placeholder: "Select project manager…",
          },
          {
            name: "rfai_request_done",
            label: "RFAI Request",
            type: "yesno",
            required: true,
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
      {
        title: "Site details",
        subtitle: "Optional intake context used across delivery stages",
        icon: FolderKanban,
        fields: [
          {
            name: "circle",
            label: "Circle",
            type: "text",
            placeholder: "Telecom circle…",
          },
          {
            name: "cloud_name",
            label: "Cloud",
            type: "text",
            placeholder: "Cloud / environment…",
          },
          {
            name: "fabric_partner",
            label: "Fabric Partner",
            type: "text",
          },
          {
            name: "application",
            label: "Application",
            type: "text",
          },
          {
            name: "remarks",
            label: "Remarks",
            type: "textarea",
            full: true,
            placeholder: "Notes for delivery team…",
          },
        ],
      },
      {
        title: "Project plan",
        subtitle: "Name, status, and planned window",
        icon: CalendarRange,
        fields: [
          {
            name: "project_name",
            label: "Project Name",
            type: "text",
            required: true,
            hint: "Defaults from customer + site on create; editable here.",
          },
          {
            name: "status",
            label: "Status",
            type: "select",
            required: true,
            options: PROJECT_STATUSES,
          },
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
        ],
      },
    ];
  }, [isEdit]);

  return (
    <ProjectsRecordForm
      title={isEdit ? "Edit Project" : "New Site Request"}
      description={
        isEdit
          ? "Update site request, delivery scope, project manager, and plan fields."
          : "Step 1 — Intake / Site request. After create you continue to Assign stage owners."
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
