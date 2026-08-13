import { FolderKanban } from "lucide-react";

import { siteDeliveryTypeLabel } from "@/components/projects/projects-domain";
import type { FormSection, FormValues } from "@/components/projects/projects-record-form";
import type { Project, SiteInstallation } from "@/services/projects-portal-service";
import {
  listBranchOptions,
  listCustomerOptions,
  listEmployeeOptions,
} from "@/services/projects-portal-service";

/** Read-only Step 1 (Intake) fields shown on every later stage form. */
export const INTAKE_SUMMARY_EMPTY: FormValues = {
  intake_project_label: "",
  intake_branch_label: "",
  intake_customer_label: "",
  intake_site_name: "",
  intake_delivery_type_label: "",
  intake_pm_label: "",
  intake_rfai_request: "",
  intake_rfai_number: "",
  intake_power_requirements: "",
};

function optionLabel(
  options: Array<{ id: string; label: string }>,
  id: string | null | undefined,
): string {
  if (!id) return "—";
  return options.find((o) => o.id === id)?.label ?? id;
}

export function intakeSummaryValues(input: {
  project: Project;
  site: SiteInstallation;
  branches?: Array<{ id: string; label: string }>;
  customers?: Array<{ id: string; label: string }>;
  employees?: Array<{ id: string; label: string }>;
}): FormValues {
  const { project, site, branches = [], customers = [], employees = [] } = input;
  const rfaiYes = Boolean(site.rfai_request_done);

  return {
    intake_project_label: `${project.project_name} (${project.project_code})`,
    intake_branch_label: optionLabel(branches, project.branch_id),
    intake_customer_label: optionLabel(customers, project.customer_id),
    intake_site_name: site.site_name?.trim() || "—",
    intake_delivery_type_label: siteDeliveryTypeLabel(site.delivery_type),
    intake_pm_label: optionLabel(employees, project.project_manager_employee_id),
    intake_rfai_request: rfaiYes ? "Yes" : "No",
    intake_rfai_number: rfaiYes ? site.rfai_number?.trim() || "—" : "—",
    intake_power_requirements: rfaiYes
      ? site.power_requirements?.trim() || "—"
      : "—",
  };
}

/** Load branch / customer / employee labels for the intake summary. */
export async function loadIntakeSummaryLookups(): Promise<{
  branches: Array<{ id: string; label: string }>;
  customers: Array<{ id: string; label: string }>;
  employees: Array<{ id: string; label: string }>;
}> {
  const [branches, customers, employees] = await Promise.all([
    listBranchOptions().catch(() => []),
    listCustomerOptions().catch(() => []),
    listEmployeeOptions().catch(() => []),
  ]);
  return { branches, customers, employees };
}

export function intakeSummarySection(): FormSection {
  return {
    title: "Project details (Step 1)",
    subtitle: "Intake details captured when the site request was created — read only.",
    icon: FolderKanban,
    fields: [
      { name: "intake_project_label", label: "Project", type: "readonly" },
      { name: "intake_branch_label", label: "Circle Name", type: "readonly" },
      { name: "intake_customer_label", label: "Customer", type: "readonly" },
      { name: "intake_site_name", label: "Site Name", type: "readonly" },
      {
        name: "intake_delivery_type_label",
        label: "Delivery Type",
        type: "readonly",
      },
      {
        name: "intake_pm_label",
        label: "Project Manager",
        type: "readonly",
      },
      { name: "intake_rfai_request", label: "RFAI Request", type: "readonly" },
      {
        name: "intake_rfai_number",
        label: "RFAI Number",
        type: "readonly",
        visibleWhen: (v) => v.intake_rfai_request === "Yes",
      },
      {
        name: "intake_power_requirements",
        label: "Power Requirements",
        type: "readonly",
        full: true,
        visibleWhen: (v) => v.intake_rfai_request === "Yes",
      },
    ],
  };
}
