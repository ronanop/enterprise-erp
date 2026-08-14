export type WizardStepMeta = {
  id: string;
  label: string;
};

export const ASSIGNMENT_WIZARD_STEPS: WizardStepMeta[] = [
  { id: "employee", label: "Employee" },
  { id: "asset", label: "Asset" },
  { id: "issued-items", label: "Issued items" },
  { id: "delivery", label: "Delivery" },
  { id: "review", label: "Review" },
];

export const RETURN_WIZARD_STEPS: WizardStepMeta[] = [
  { id: "summary", label: "Asset summary" },
  { id: "condition", label: "Return condition" },
  { id: "components", label: "Components" },
  { id: "remarks", label: "Return remarks" },
  { id: "review", label: "Review" },
];

export type DeliveryReferenceStatus = "pending" | "issued" | "received";

export type DeliveryChallanSignatureStatus = "not_signed" | "signed";

export type ReturnCondition = "good" | "outdated" | "dead";

export type ComponentReturnOutcome = "RETURNED" | "MISSING" | "DAMAGED" | "RETAINED";

export type ComponentReturnLineState = {
  componentId: string;
  label: string;
  serialNumber: string;
  issueStatus: ComponentReturnOutcome;
  returnRemarks: string;
};

export type AssignmentWizardState = {
  allocationType: string;
  employeeId: string;
  departmentId: string;
  projectId: string;
  expectedReturnAt: string;
  assetId: string;
  branchId: string;
  draftId: string;
  version: number;
  issuedItemIds: string[];
  deliveryReferenceStatus: DeliveryReferenceStatus;
  deliveryReferenceNumber: string;
  deliveryChallanSignatureStatus: DeliveryChallanSignatureStatus;
  assignmentRemarks: string;
};

export type ReturnWizardState = {
  returnCondition: ReturnCondition;
  returnRemarks: string;
  reason: string;
  componentReturns: ComponentReturnLineState[];
};

export const EMPTY_ASSIGNMENT_WIZARD_STATE: AssignmentWizardState = {
  allocationType: "employee",
  employeeId: "",
  departmentId: "",
  projectId: "",
  expectedReturnAt: "",
  assetId: "",
  branchId: "",
  draftId: "",
  version: 1,
  issuedItemIds: [],
  deliveryReferenceStatus: "pending",
  deliveryReferenceNumber: "",
  deliveryChallanSignatureStatus: "not_signed",
  assignmentRemarks: "",
};

export const EMPTY_RETURN_WIZARD_STATE: ReturnWizardState = {
  returnCondition: "good",
  returnRemarks: "",
  reason: "",
  componentReturns: [],
};
