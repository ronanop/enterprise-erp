export type WizardStepMeta = {
  id: string;
  label: string;
};

export const ASSIGNMENT_WIZARD_STEPS: WizardStepMeta[] = [
  { id: "employee", label: "Employee Information" },
  { id: "asset", label: "Asset Information" },
  { id: "issued-items", label: "Issued Items" },
  { id: "delivery", label: "Assignment Details" },
  { id: "review", label: "Review & Confirm" },
];

export const PREFILLED_ASSIGNMENT_WIZARD_STEPS: WizardStepMeta[] = [
  { id: "asset", label: "Asset Information" },
  { id: "employee", label: "Employee Information" },
  { id: "issued-items", label: "Issued Items" },
  { id: "delivery", label: "Assignment Details" },
  { id: "review", label: "Review & Confirm" },
];

export const RETURN_WIZARD_STEPS: WizardStepMeta[] = [
  { id: "summary", label: "Asset summary" },
  { id: "condition", label: "Return condition" },
  { id: "remarks", label: "Return remarks" },
  { id: "review", label: "Review" },
];

export type DeliveryReferenceStatus = "pending" | "issued" | "received";

export type ReturnCondition = "good" | "outdated" | "dead";

export type AssignmentWizardState = {
  allocationType: string;
  employeeId: string;
  departmentId: string;
  projectId: string;
  expectedReturnAt: string;
  /** Display / review only — server sets allocated_at on activation. */
  issuedAt: string;
  assetId: string;
  branchId: string;
  draftId: string;
  version: number;
  issuedItemIds: string[];
  deliveryReferenceStatus: DeliveryReferenceStatus;
  deliveryReferenceNumber: string;
  assignmentRemarks: string;
};

export type ReturnWizardState = {
  returnCondition: ReturnCondition;
  returnRemarks: string;
  reason: string;
};

export const EMPTY_ASSIGNMENT_WIZARD_STATE: AssignmentWizardState = {
  allocationType: "employee",
  employeeId: "",
  departmentId: "",
  projectId: "",
  expectedReturnAt: "",
  issuedAt: "",
  assetId: "",
  branchId: "",
  draftId: "",
  version: 1,
  issuedItemIds: [],
  deliveryReferenceStatus: "pending",
  deliveryReferenceNumber: "",
  assignmentRemarks: "",
};

export const EMPTY_RETURN_WIZARD_STATE: ReturnWizardState = {
  returnCondition: "good",
  returnRemarks: "",
  reason: "",
};
