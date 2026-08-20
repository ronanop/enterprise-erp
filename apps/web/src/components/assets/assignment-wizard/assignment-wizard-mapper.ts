import type { OrgOption } from "@/lib/org-options";
import type {
  AssignmentWizardState,
  ReturnWizardState,
} from "@/components/assets/assignment-wizard/wizard-types";

export type WizardSelectOption = { id: string; label: string };

export type WizardEmployeeOption = WizardSelectOption & {
  employeeCode?: string;
  name?: string;
  department?: string;
  departmentId?: string;
  designation?: string;
  branch?: string;
  phone?: string;
  email?: string;
  manager?: string;
  employmentStatus?: string;
};

export type WizardAssetOption = WizardSelectOption & {
  code: string;
  operationalStatus: string;
  branchLabel: string;
  branchId: string;
  serialNumber?: string;
  make?: string;
  model?: string;
  configuration?: string;
  currentLocation?: string;
  earlierUsedBy?: string;
};

export type WizardIssuedItemOption = WizardSelectOption & { status: string };

/** Fixed accessory checklist for Issued Items (stored via assignment_remarks). */
export const STANDARD_ISSUED_ACCESSORIES: WizardIssuedItemOption[] = [
  { id: "charger", label: "Charger", status: "accessory" },
  { id: "mouse", label: "Mouse", status: "accessory" },
  { id: "keyboard", label: "Keyboard", status: "accessory" },
  { id: "laptop-bag", label: "Laptop Bag", status: "accessory" },
  { id: "dock", label: "Dock", status: "accessory" },
  { id: "hdmi-cable", label: "HDMI Cable", status: "accessory" },
  { id: "adapter", label: "Adapter", status: "accessory" },
  { id: "headset", label: "Headset", status: "accessory" },
  { id: "other", label: "Other Items", status: "accessory" },
];


export type AssignmentApiRow = {
  id: string;
  document_number: string;
  asset_id: string;
  allocation_type: string;
  employee_id?: string | null;
  department_id?: string | null;
  project_id?: string | null;
  expected_return_at?: string | null;
  allocated_at?: string | null;
  returned_at?: string | null;
  status: string;
  version: number;
  branch_id: string;
  delivery_reference_number?: string | null;
  delivery_reference_status?: string;
  assignment_remarks?: string | null;
};

export type ReturnSummaryView = {
  assetCode: string;
  assetName: string;
  serialNumber: string;
  operationalStatus: string;
  documentNumber: string;
  assigneeLabel: string;
  allocatedAt: string;
  deliveryReferenceNumber: string;
};

export type AssignmentWizardQuery = {
  assetId?: string;
  draftId?: string;
  employeeId?: string;
  submit?: boolean;
};

export type ReturnWizardQuery = {
  assetId?: string;
  assignmentId?: string;
  intent?: string;
};

export function orgOptionsToWizard(options: OrgOption[]): WizardSelectOption[] {
  return options.map((o) => ({ id: o.id, label: o.label }));
}

const ISSUED_PREFIX_RE = /^\[Issued:([^\]]*)\]\s*/;

export function splitIssuedFromRemarks(remarks: string | null | undefined): {
  issuedLabels: string[];
  assignmentRemarks: string;
} {
  if (!remarks?.trim()) return { issuedLabels: [], assignmentRemarks: "" };
  const match = remarks.match(ISSUED_PREFIX_RE);
  if (!match) return { issuedLabels: [], assignmentRemarks: remarks.trim() };
  const issuedLabels = match[1]
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return { issuedLabels, assignmentRemarks: remarks.slice(match[0].length).trim() };
}

export function assignmentRowToWizardState(
  row: AssignmentApiRow,
  issuedItemIds: string[],
  issuedItems: WizardIssuedItemOption[],
): AssignmentWizardState {
  const { issuedLabels, assignmentRemarks } = splitIssuedFromRemarks(row.assignment_remarks);
  const ids =
    issuedItemIds.length > 0
      ? issuedItemIds
      : issuedItems
          .filter((i) => issuedLabels.some((l) => i.label.includes(l) || l.includes(i.label)))
          .map((i) => i.id);

  return {
    allocationType: row.allocation_type,
    employeeId: row.employee_id ?? "",
    departmentId: row.department_id ?? "",
    projectId: row.project_id ?? "",
    expectedReturnAt: row.expected_return_at?.slice(0, 10) ?? "",
    issuedAt: row.allocated_at?.slice(0, 10) ?? "",
    assetId: row.asset_id,
    branchId: row.branch_id,
    draftId: row.id,
    version: row.version,
    issuedItemIds: ids,
    deliveryReferenceStatus:
      (row.delivery_reference_status as AssignmentWizardState["deliveryReferenceStatus"]) ||
      "pending",
    deliveryReferenceNumber: row.delivery_reference_number ?? "",
    assignmentRemarks,
  };
}

export function buildAssignmentRemarks(
  state: AssignmentWizardState,
  issuedItems: WizardIssuedItemOption[],
): string {
  const labels = issuedItems
    .filter((i) => state.issuedItemIds.includes(i.id))
    .map((i) => i.label);
  const parts: string[] = [];
  if (labels.length) parts.push(`[Issued: ${labels.join(", ")}]`);
  if (state.assignmentRemarks.trim()) parts.push(state.assignmentRemarks.trim());
  return parts.join("\n").trim();
}

export function wizardStateToCreateBody(
  state: AssignmentWizardState,
  issuedItems: WizardIssuedItemOption[],
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    asset_id: state.assetId,
    branch_id: state.branchId,
    allocation_type: state.allocationType,
    expected_return_at: state.expectedReturnAt || undefined,
    delivery_reference_number: state.deliveryReferenceNumber.trim() || undefined,
    delivery_reference_status: state.deliveryReferenceStatus,
    assignment_remarks: buildAssignmentRemarks(state, issuedItems) || undefined,
  };
  if (state.allocationType === "employee") body.employee_id = state.employeeId || undefined;
  if (state.allocationType === "department") body.department_id = state.departmentId || undefined;
  if (state.allocationType === "project") body.project_id = state.projectId || undefined;
  return body;
}

export function wizardStateToUpdateBody(
  state: AssignmentWizardState,
  issuedItems: WizardIssuedItemOption[],
): Record<string, unknown> {
  return {
    ...wizardStateToCreateBody(state, issuedItems),
    version: state.version,
  };
}

export function returnWizardStateToBody(state: ReturnWizardState): Record<string, unknown> {
  return {
    return_condition: state.returnCondition,
    return_remarks: state.returnRemarks.trim() || undefined,
    reason: state.reason.trim() || undefined,
  };
}

export function buildReturnSummary(
  assignment: AssignmentApiRow,
  asset: { asset_code?: string; asset_name?: string; serial_number?: string; operational_status?: string },
  assigneeLabel: string,
): ReturnSummaryView {
  return {
    assetCode: asset.asset_code ?? "—",
    assetName: asset.asset_name ?? "—",
    serialNumber: asset.serial_number ?? "—",
    operationalStatus: asset.operational_status ?? assignment.status,
    documentNumber: assignment.document_number,
    assigneeLabel,
    allocatedAt: assignment.allocated_at?.slice(0, 10) ?? "—",
    deliveryReferenceNumber: assignment.delivery_reference_number ?? "—",
  };
}
