"use client";

import { useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { MapPin } from "lucide-react";

import { SITE_DELIVERY_TYPES } from "@/components/projects/projects-domain";
import {
  orNull,
  ProjectsRecordForm,
  type FormSection,
  type FormValues,
  type Lookups,
} from "@/components/projects/projects-record-form";
import {
  advanceSiteInstallation,
  createProject,
  getProject,
  getProjectPoPrefill,
  getSiteInstallationByProject,
  listBranchOptions,
  listCustomerOptions,
  listProjectManagementTeamOptions,
  updateProject,
  updateSiteInstallationByProject,
  type ProjectFormInput,
} from "@/services/projects-portal-service";

const EMPTY_CREATE: FormValues = {
  branch_id: "",
  circle: "",
  company_po_number: "",
  customer_id: "",
  customer_label: "",
  delivery_type: "server_os_rack",
  site_name: "",
  project_manager_employee_id: "",
  rfai_request_done: "",
  rfai_number: "",
};

const EMPTY_EDIT: FormValues = {
  ...EMPTY_CREATE,
  project_code: "",
  project_name: "",
  status: "draft",
};

export function ProjectFormPage({ projectId }: { projectId?: string }) {
  const isEdit = Boolean(projectId);
  const searchParams = useSearchParams();
  const poId = searchParams.get("po_id");

  const load = useCallback(async (): Promise<{ values?: FormValues; lookups?: Lookups }> => {
    const [branches, team, customers, record, prefill] = await Promise.all([
      listBranchOptions().catch(() => []),
      listProjectManagementTeamOptions().catch(() => []),
      listCustomerOptions().catch(() => []),
      projectId ? getProject(projectId) : Promise.resolve(null),
      !projectId && poId ? getProjectPoPrefill(poId).catch(() => null) : Promise.resolve(null),
    ]);
    const resolvedCustomerLabel =
      prefill?.customer_name?.trim() ||
      (prefill?.customer_id
        ? customers.find((c) => c.id === prefill.customer_id)?.label
        : undefined) ||
      "";

    const lookups: Lookups = {
      branches,
      employees: team,
      pmTeam: team,
      customers,
    };

    if (record) {
      const site = await getSiteInstallationByProject(projectId!).catch(() => null);
      const customerLabel =
        customers.find((c) => c.id === record.customer_id)?.label ?? "";

      const values: FormValues = {
        project_code: record.project_code,
        project_name: record.project_name,
        status: record.status,
        branch_id: record.branch_id,
        circle: site?.circle ?? "",
        company_po_number: "",
        customer_id: record.customer_id ?? "",
        customer_label: customerLabel,
        delivery_type: site?.delivery_type || "server_os_rack",
        site_name: site?.site_name ?? "",
        project_manager_employee_id: record.project_manager_employee_id,
        rfai_request_done: site?.rfai_request_done ? "true" : "false",
        rfai_number: site?.rfai_number ?? "",
      };
      return { values, lookups };
    }

    return {
      values: {
        branch_id: prefill?.branch_id || branches[0]?.id || "",
        // Circle shows the lead entity state (GST / address), falling back to entity name.
        circle:
          prefill?.entity_state?.trim() ||
          prefill?.circle_name?.trim() ||
          "",
        company_po_number: prefill?.company_po_number?.trim() || "",
        customer_id: prefill?.customer_id || "",
        customer_label: resolvedCustomerLabel,
        site_name: prefill?.site_name || "",
        project_manager_employee_id: team[0]?.id ?? "",
        rfai_request_done: "false",
      },
      lookups,
    };
  }, [projectId, poId]);

  const onSave = useCallback(
    async (v: FormValues) => {
      if (!isEdit) {
        const siteName = v.site_name.trim();
        const rfaiYes = v.rfai_request_done === "true";
        const saved = await createProject({
          branch_id: v.branch_id,
          customer_id: orNull(v.customer_id),
          project_manager_employee_id: v.project_manager_employee_id || undefined,
          proc_order_id: poId || undefined,
          site_installation: {
            delivery_type: v.delivery_type || "server_os_rack",
            site_name: orNull(siteName),
            circle: orNull(v.circle),
            rfai_request_done: rfaiYes,
            rfai_number: rfaiYes ? orNull(v.rfai_number) : null,
          },
        });
        // Intake was captured on create — move to Survey so admin assigns Survey from Project Tracking.
        if (siteName) {
          try {
            await advanceSiteInstallation(saved.id, "complete_intake");
          } catch {
            // Stay on intake if gates fail; admin can still assign Survey from tracking.
          }
        }
        return `/projects/projects/${saved.id}`;
      }

      const rfaiYes = v.rfai_request_done === "true";
      const siteName = v.site_name.trim();
      const projectPayload: ProjectFormInput = {
        project_name: v.project_name.trim() || siteName || "Site Installation Request",
        customer_id: orNull(v.customer_id),
        project_manager_employee_id: v.project_manager_employee_id,
        status: v.status || "draft",
      };

      await Promise.all([
        updateProject(projectId!, projectPayload),
        updateSiteInstallationByProject(projectId!, {
          delivery_type: v.delivery_type || "server_os_rack",
          site_name: orNull(siteName),
          rfai_request_done: rfaiYes,
          rfai_number: rfaiYes ? orNull(v.rfai_number) : null,
          circle: orNull(v.circle),
        }),
      ]);

      return `/projects/projects/${projectId}`;
    },
    [isEdit, projectId, poId],
  );

  const sections = useMemo<FormSection[]>(() => {
    const intakeFields: FormSection["fields"] = [
      ...(isEdit
        ? [
          {
            name: "project_code",
            label: "Project Code",
            type: "readonly" as const,
          },
        ]
        : []),
      {
        name: "circle",
        label: "Circle",
        type: "text" as const,
        placeholder: "Telecom circle…",
      },
      {
        name: "delivery_type",
        label: "Delivery Type",
        type: "select",
        required: true,
        options: SITE_DELIVERY_TYPES,
      },
      ...(!isEdit && poId
        ? [
          {
            name: "company_po_number",
            label: "PO Number",
            type: "readonly" as const,
          },
          {
            name: "customer_label",
            label: "Customer",
            type: "readonly" as const,
          },
          {
            name: "site_name",
            label: "Site Name",
            type: "readonly" as const,
            full: true as const,
          },
        ]
        : [
          {
            name: "customer_id",
            label: "Customer",
            type: "select" as const,
            required: true,
            optionsKey: "customers" as const,
            placeholder: "Select customer…",
            creatable: "customer" as const,
            createNewLabel: "New Customer…",
          },
          {
            name: "site_name",
            label: "Site Name",
            type: "textarea" as const,
            required: true,
            full: true as const,
            placeholder: "Site name / site list entry…",
          },
        ]),
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
        clearFieldsOnChange: ["rfai_number"],
      },
      {
        name: "rfai_number",
        label: "RFAI Number",
        type: "text",
        required: true,
        placeholder: "RFAI reference number…",
        visibleWhen: (vals) => vals.rfai_request_done === "true",
      },
    ];

    return [
      {
        title: "Intake / Site request",
        subtitle: isEdit
          ? "Same intake fields as create — Circle, Delivery Type, Customer, Site, PM, and RFAI are editable."
          : poId
            ? "Step 1 — Customer, site and circle prefilled from the CRM lead via SCM PO / OVF."
            : "Step 1 — Customer → Site → Project Manager → RFAI",
        icon: MapPin,
        fields: intakeFields,
      },
    ];
  }, [isEdit, poId]);

  return (
    <ProjectsRecordForm
      title={isEdit ? "Edit Project" : "New Project"}
      description={
        isEdit
          ? "Update intake / site request fields. Schedule is managed from the project timeline."
          : poId
            ? "Step 1 — Intake / Site request prefilled from the SCM purchase order. After create you continue to Assign Survey owner."
            : "Step 1 — Intake / Site request. After create you continue to Assign Survey owner."
      }
      backHref={poId ? "/projects/purchase-orders" : "/projects/projects"}
      backLabel={poId ? "Back to PO queue" : "Back to projects"}
      submitLabel={isEdit ? "Save changes" : "Create project"}
      sections={sections}
      emptyValues={isEdit ? EMPTY_EDIT : EMPTY_CREATE}
      load={load}
      onSave={onSave}
    />
  );
}
