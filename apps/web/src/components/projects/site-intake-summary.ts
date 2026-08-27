import { FolderKanban } from "lucide-react";

import { siteDeliveryTypeLabel } from "@/components/projects/projects-domain";
import type { FormSection, FormValues } from "@/components/projects/projects-record-form";
import type { Project, SiteInstallation } from "@/services/projects-portal-service";
import {
  listBranchOptions,
  listCustomerOptions,
  listEmployeeOptions,
} from "@/services/projects-portal-service";

/** Older SCM shares stored type/qty only in remarks text. */
function valueFromRemarks(remarks: string | null | undefined, label: string): string {
  if (!remarks?.trim()) return "";
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = remarks.match(new RegExp(`${escaped}:\\s*(.+)`, "i"));
  return match?.[1]?.trim().split(/\r?\n/)[0]?.trim() || "";
}

function displayQty(
  value: number | null | undefined,
  remarks: string | null | undefined,
  remarkLabel: string,
): string {
  if (value != null && Number.isFinite(Number(value))) return String(value);
  const fromRemarks = valueFromRemarks(remarks, remarkLabel);
  return fromRemarks || "—";
}

function displayText(
  value: string | null | undefined,
  remarks: string | null | undefined,
  remarkLabel: string,
): string {
  if (value?.trim()) return value.trim();
  const fromRemarks = valueFromRemarks(remarks, remarkLabel);
  return fromRemarks || "—";
}

function labelOrDash(
  id: string | null | undefined,
  resolve: (id: string | null | undefined) => string,
): string {
  if (!id) return "—";
  const label = resolve(id);
  return label && label !== "—" ? label : "—";
}

/** Read-only intake rows for the project detail page (admin overview). */
export function intakeAdminDetailRows(input: {
  project: Project;
  site: SiteInstallation | null;
  branchLabel?: string | null;
  customerName: (id: string | null | undefined) => string;
  employeeName: (id: string | null | undefined) => string;
  companyPoNumber?: string | null;
}): Array<{ label: string; value: string }> {
  const { project, site, branchLabel, customerName, employeeName, companyPoNumber } = input;
  const rfaiYes = Boolean(site?.rfai_request_done);
  const circle = site?.circle?.trim() || branchLabel?.trim() || "—";

  const rows: Array<{ label: string; value: string }> = [
    { label: "Project Title", value: project.project_name?.trim() || "—" },
    { label: "Circle Name", value: circle },
    {
      label: "Delivery Type",
      value: site?.delivery_type ? siteDeliveryTypeLabel(site.delivery_type) : "—",
    },
    {
      label: "Rack Quantity",
      value: displayQty(site?.rack_qty, site?.remarks, "Rack quantity"),
    },
    {
      label: "Server Quantity",
      value: displayQty(site?.server_qty, site?.remarks, "Server quantity"),
    },
    {
      label: "Server Type",
      value: displayText(site?.application, site?.remarks, "Server type"),
    },
  ];

  if (companyPoNumber?.trim()) {
    rows.push({ label: "PO Number", value: companyPoNumber.trim() });
  }

  rows.push(
    { label: "Customer", value: labelOrDash(project.customer_id, customerName) },
    { label: "Site Name", value: site?.site_name?.trim() || "—" },
    {
      label: "Project Manager",
      value: labelOrDash(project.project_manager_employee_id, employeeName),
    },
    { label: "RFAI Request", value: site ? (rfaiYes ? "Yes" : "No") : "—" },
  );

  if (rfaiYes) {
    rows.push({ label: "RFAI Number", value: site?.rfai_number?.trim() || "—" });
  }

  return rows;
}

/** Read-only Step 1 (Intake) fields shown on every later stage form. */
export const INTAKE_SUMMARY_EMPTY: FormValues = {
  intake_project_label: "",
  intake_branch_label: "",
  intake_customer_label: "",
  intake_site_name: "",
  intake_delivery_type_label: "",
  intake_project_title: "",
  intake_rack_qty: "",
  intake_server_qty: "",
  intake_server_type: "",
  intake_pm_label: "",
  intake_rfai_request: "",
  intake_rfai_number: "",
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
    intake_branch_label: site.circle?.trim() || optionLabel(branches, project.branch_id),
    intake_customer_label: optionLabel(customers, project.customer_id),
    intake_site_name: site.site_name?.trim() || "—",
    intake_delivery_type_label: siteDeliveryTypeLabel(site.delivery_type),
    intake_project_title: project.project_name?.trim() || "—",
    intake_rack_qty: displayQty(site.rack_qty, site.remarks, "Rack quantity"),
    intake_server_qty: displayQty(site.server_qty, site.remarks, "Server quantity"),
    intake_server_type: displayText(site.application, site.remarks, "Server type"),
    intake_pm_label: optionLabel(employees, project.project_manager_employee_id),
    intake_rfai_request: rfaiYes ? "Yes" : "No",
    intake_rfai_number: rfaiYes ? site.rfai_number?.trim() || "—" : "—",
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
        name: "intake_project_title",
        label: "Project Title",
        type: "readonly",
      },
      {
        name: "intake_rack_qty",
        label: "Rack Quantity",
        type: "readonly",
      },
      {
        name: "intake_server_qty",
        label: "Server Quantity",
        type: "readonly",
      },
      {
        name: "intake_server_type",
        label: "Server Type",
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
    ],
  };
}
