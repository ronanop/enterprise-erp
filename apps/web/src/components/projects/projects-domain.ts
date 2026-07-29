/**
 * Projects domain option lists.
 *
 * Values mirror the CHECK constraints on the `project.prj_*` tables
 * (ERD_14 §6) — labels are the FRD-11 display names.
 */

export type Choice = { value: string; label: string };

const choice = (value: string, label: string): Choice => ({ value, label });

export const PROJECT_TYPES: Choice[] = [
  choice("internal", "Internal"),
  choice("customer", "Customer Project"),
  choice("rnd", "R&D Project"),
  choice("implementation", "Implementation Project"),
  choice("support", "Support Project"),
];

export const PROJECT_STATUSES: Choice[] = [
  choice("draft", "Draft"),
  choice("submitted", "Submitted"),
  choice("approved", "Approved"),
  choice("in_progress", "In Progress"),
  choice("on_hold", "On Hold"),
  choice("completed", "Completed"),
  choice("cancelled", "Cancelled"),
  choice("closed", "Closed"),
];

export const BILLING_TYPES: Choice[] = [
  choice("fixed_price", "Fixed Price"),
  choice("time_material", "Time & Material"),
  choice("milestone", "Milestone Based"),
  choice("retainer", "Retainer Based"),
];

export const HEALTH_STATUSES: Choice[] = [
  choice("green", "Green"),
  choice("amber", "Amber"),
  choice("red", "Red"),
];

export const PHASE_STATUSES: Choice[] = [
  choice("planned", "Planned"),
  choice("active", "Active"),
  choice("completed", "Completed"),
  choice("cancelled", "Cancelled"),
];

export const MILESTONE_STATUSES: Choice[] = [
  choice("planned", "Planned"),
  choice("achieved", "Achieved"),
  choice("delayed", "Delayed"),
  choice("cancelled", "Cancelled"),
];

export const TASK_PRIORITIES: Choice[] = [
  choice("low", "Low"),
  choice("medium", "Medium"),
  choice("high", "High"),
  choice("critical", "Critical"),
];

export const TASK_STATUSES: Choice[] = [
  choice("open", "Open"),
  choice("in_progress", "In Progress"),
  choice("blocked", "Blocked"),
  choice("submitted", "Submitted"),
  choice("approved", "Approved"),
  choice("completed", "Completed"),
  choice("cancelled", "Cancelled"),
];

export const TIMESHEET_STATUSES: Choice[] = [
  choice("draft", "Draft"),
  choice("submitted", "Submitted"),
  choice("approved", "Approved"),
  choice("rejected", "Rejected"),
  choice("cancelled", "Cancelled"),
];

export const TIMESHEET_ENTRY_STATUSES: Choice[] = [
  choice("draft", "Draft"),
  choice("locked", "Locked"),
  choice("cancelled", "Cancelled"),
];

export const RESOURCE_PLAN_STATUSES: Choice[] = [
  choice("draft", "Draft"),
  choice("active", "Active"),
  choice("closed", "Closed"),
  choice("cancelled", "Cancelled"),
];

export const RESOURCE_TYPES: Choice[] = [
  choice("employee", "Employee"),
  choice("contractor", "Contractor"),
  choice("consultant", "Consultant"),
  choice("vendor", "Vendor Resource"),
];

export const ALLOCATION_STATUSES: Choice[] = [
  choice("planned", "Planned"),
  choice("active", "Active"),
  choice("completed", "Completed"),
  choice("cancelled", "Cancelled"),
];

export const BUDGET_TYPES: Choice[] = [
  choice("labor", "Labor"),
  choice("materials", "Materials"),
  choice("travel", "Travel"),
  choice("software", "Software"),
  choice("hardware", "Hardware"),
  choice("other", "Other"),
];

export const BUDGET_STATUSES: Choice[] = [
  choice("draft", "Draft"),
  choice("submitted", "Submitted"),
  choice("approved", "Approved"),
  choice("active", "Active"),
  choice("closed", "Closed"),
  choice("rejected", "Rejected"),
  choice("cancelled", "Cancelled"),
];

export const COST_SOURCES: Choice[] = [
  choice("payroll", "Payroll"),
  choice("procurement", "Procurement"),
  choice("expense", "Expenses"),
  choice("asset", "Assets"),
  choice("vendor_bill", "Vendor Bills"),
  choice("manual", "Manual"),
];

export const SEVERITY_LEVELS: Choice[] = [
  choice("low", "Low"),
  choice("medium", "Medium"),
  choice("high", "High"),
  choice("critical", "Critical"),
];

export const ISSUE_STATUSES: Choice[] = [
  choice("open", "Open"),
  choice("in_progress", "In Progress"),
  choice("resolved", "Resolved"),
  choice("closed", "Closed"),
  choice("cancelled", "Cancelled"),
];

export const RISK_STATUSES: Choice[] = [
  choice("identified", "Identified"),
  choice("mitigating", "Mitigating"),
  choice("accepted", "Accepted"),
  choice("closed", "Closed"),
  choice("cancelled", "Cancelled"),
];

export const CHANGE_TYPES: Choice[] = [
  choice("scope", "Scope"),
  choice("schedule", "Schedule"),
  choice("budget", "Budget"),
  choice("resource", "Resource"),
  choice("other", "Other"),
];

export const CHANGE_REQUEST_STATUSES: Choice[] = [
  choice("draft", "Draft"),
  choice("submitted", "Submitted"),
  choice("approved", "Approved"),
  choice("rejected", "Rejected"),
  choice("implemented", "Implemented"),
  choice("cancelled", "Cancelled"),
];

export const DOCUMENT_TYPES: Choice[] = [
  choice("brd", "BRD"),
  choice("design", "Design"),
  choice("report", "Report"),
  choice("contract", "Contract"),
  choice("other", "Other"),
];

export const DOCUMENT_STATUSES: Choice[] = [
  choice("active", "Active"),
  choice("superseded", "Superseded"),
  choice("archived", "Archived"),
];

export const SITE_DELIVERY_TYPES: Choice[] = [
  choice("server_os_rack", "Server installation, OS, Rack Installation"),
  choice("server_os", "Server installation, OS"),
  choice("server_bios_rack", "Server installation, BIOS/FW, Rack Installation"),
  choice("rack_only", "Rack Installation"),
  choice("server_bios", "Server installation, BIOS/FW"),
];

export function deliveryIncludesRack(v: string | null | undefined): boolean {
  return (
    v === "server_os_rack" ||
    v === "server_bios_rack" ||
    v === "rack_only"
  );
}

/** Survey material types when delivery includes Rack Installation. */
export const CABLE_TYPES: Choice[] = [
  choice("5cr 10sqmm", "5cr 10sqmm"),
  choice("5 cr 6 sqmm", "5 cr 6 sqmm"),
  choice("25sqmm Green", "25sqmm Green"),
];

export const LUG_TYPES: Choice[] = [
  choice("pin type 6sqmm", "Pin type 6sqmm"),
  choice("pin type 10sqmm", "Pin type 10sqmm"),
  choice("pin type 25 sqmm", "Pin type 25 sqmm"),
  choice("ring type 6 sqmm", "Ring type 6 sqmm"),
  choice("ring type 10 sqmm", "Ring type 10 sqmm"),
  choice("ring type 25 sqmm", "Ring type 25 sqmm"),
];

export const INDUSTRIAL_SOCKET_TYPES: Choice[] = [
  choice("male", "Male"),
  choice("female", "Female"),
];

export function deliveryIsRackOnly(v: string | null | undefined): boolean {
  return v === "rack_only";
}

export function deliveryNeedsConfiguration(v: string | null | undefined): boolean {
  return !deliveryIsRackOnly(v);
}

export function deliveryIncludesOs(v: string | null | undefined): boolean {
  return v === "server_os_rack" || v === "server_os";
}

export function deliveryIncludesBios(v: string | null | undefined): boolean {
  return (
    v === "server_os_rack" ||
    v === "server_os" ||
    v === "server_bios_rack" ||
    v === "server_bios"
  );
}

export function deliveryIncludesServer(v: string | null | undefined): boolean {
  return (
    v === "server_os_rack" ||
    v === "server_os" ||
    v === "server_bios_rack" ||
    v === "server_bios"
  );
}

export function deliveryNeedsHwat(v: string | null | undefined): boolean {
  return !deliveryIsRackOnly(v);
}

export const SITE_WORKFLOW_STAGES: Choice[] = [
  choice("intake", "Intake & RFAI"),
  choice("assignment", "Assign stage owners"),
  choice("survey", "Survey"),
  choice("scm", "SCM / Logistics"),
  choice("installation", "Installation & Configuration"),
  choice("acceptance", "Acceptance"),
  choice("completed", "Completed"),
];

function labelFrom(choices: Choice[], value: string | null | undefined): string {
  if (!value) return "—";
  return choices.find((c) => c.value === value)?.label ?? value;
}

export const projectTypeLabel = (v: string | null | undefined) => labelFrom(PROJECT_TYPES, v);
export const billingTypeLabel = (v: string | null | undefined) => labelFrom(BILLING_TYPES, v);
export const priorityLabel = (v: string | null | undefined) => labelFrom(TASK_PRIORITIES, v);
export const budgetTypeLabel = (v: string | null | undefined) => labelFrom(BUDGET_TYPES, v);
export const costSourceLabel = (v: string | null | undefined) => labelFrom(COST_SOURCES, v);
export const severityLabel = (v: string | null | undefined) => labelFrom(SEVERITY_LEVELS, v);
export const changeTypeLabel = (v: string | null | undefined) => labelFrom(CHANGE_TYPES, v);
export const resourceTypeLabel = (v: string | null | undefined) => labelFrom(RESOURCE_TYPES, v);
export const documentTypeLabel = (v: string | null | undefined) => labelFrom(DOCUMENT_TYPES, v);
export const siteDeliveryTypeLabel = (v: string | null | undefined) =>
  labelFrom(SITE_DELIVERY_TYPES, v);
export const siteWorkflowStageLabel = (v: string | null | undefined) => {
  // Legacy stage before install+config merge
  if (v === "configuration") return "Installation & Configuration";
  return labelFrom(SITE_WORKFLOW_STAGES, v);
};
