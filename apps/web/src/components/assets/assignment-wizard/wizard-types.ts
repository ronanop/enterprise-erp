export type WizardStepMeta = {
  id: string;
  label: string;
};

/** Section anchors for the single-page Issue Asset form (not a gated wizard). */
export const ASSIGNMENT_FORM_SECTIONS: WizardStepMeta[] = [
  { id: "allocation", label: "Allocation & Employee" },
  { id: "asset", label: "Asset" },
  { id: "issued-items", label: "Issued Items" },
  { id: "delivery", label: "Delivery (DC paperwork)" },
  { id: "review", label: "Review & Submit" },
];

/** @deprecated Use ASSIGNMENT_FORM_SECTIONS. Kept for Return wizard stepper tests. */
export const ASSIGNMENT_WIZARD_STEPS: WizardStepMeta[] = ASSIGNMENT_FORM_SECTIONS;

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

export type DcChallanWizardMode = "later" | "create_now" | "link_existing";

export type EmployeeSource = "MASTER_DATA" | "MANUAL_ENTRY";

export type AssignmentWizardState = {
  allocationType: string;
  employeeSource: EmployeeSource;
  employeeId: string;
  manualEmployeeName: string;
  manualEmployeePhone: string;
  manualEmployeeEmail: string;
  manualEmployeeDeployedTo: string;
  departmentId: string;
  projectId: string;
  assetId: string;
  branchId: string;
  draftId: string;
  version: number;
  issuedItemIds: string[];
  deliveryReferenceStatus: DeliveryReferenceStatus;
  deliveryReferenceNumber: string;
  deliveryChallanSignatureStatus: DeliveryChallanSignatureStatus;
  assignmentRemarks: string;
  dcChallanMode: DcChallanWizardMode;
  dcChallanId: string;
};

export type ReturnWizardState = {
  returnCondition: ReturnCondition;
  returnRemarks: string;
  reason: string;
  componentReturns: ComponentReturnLineState[];
};

export const EMPTY_ASSIGNMENT_WIZARD_STATE: AssignmentWizardState = {
  allocationType: "employee",
  employeeSource: "MASTER_DATA",
  employeeId: "",
  manualEmployeeName: "",
  manualEmployeePhone: "",
  manualEmployeeEmail: "",
  manualEmployeeDeployedTo: "",
  departmentId: "",
  projectId: "",
  assetId: "",
  branchId: "",
  draftId: "",
  version: 1,
  issuedItemIds: [],
  deliveryReferenceStatus: "pending",
  deliveryReferenceNumber: "",
  deliveryChallanSignatureStatus: "not_signed",
  assignmentRemarks: "",
  dcChallanMode: "later",
  dcChallanId: "",
};

export const EMPTY_RETURN_WIZARD_STATE: ReturnWizardState = {
  returnCondition: "good",
  returnRemarks: "",
  reason: "",
  componentReturns: [],
};
