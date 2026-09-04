import { describe, expect, it } from "vitest";

import {
  assignmentRowToWizardState,
  buildAssignmentRemarks,
  buildReturnSummary,
  returnWizardStateToBody,
  splitIssuedFromRemarks,
  wizardStateToCreateBody,
  wizardStateToUpdateBody,
  type AssignmentApiRow,
  type WizardIssuedItemOption,
} from "@/components/assets/assignment-wizard/assignment-wizard-mapper";
import { EMPTY_ASSIGNMENT_WIZARD_STATE } from "@/components/assets/assignment-wizard/wizard-types";

const baseRow: AssignmentApiRow = {
  id: "row-1",
  document_number: "ASN-001",
  asset_id: "asset-1",
  allocation_type: "employee",
  employee_id: "emp-1",
  department_id: null,
  project_id: null,
  expected_return_at: "2026-12-01T00:00:00Z",
  allocated_at: "2026-01-01T00:00:00Z",
  returned_at: null,
  status: "draft",
  version: 2,
  branch_id: "branch-1",
  delivery_reference_number: "DR-9",
  delivery_reference_status: "received",
  assignment_remarks: "[Issued: Keyboard, Mouse] Note here",
};

const issuedItems: WizardIssuedItemOption[] = [
  { id: "c1", label: "Keyboard", status: "active" },
  { id: "c2", label: "Mouse", status: "active" },
  { id: "c3", label: "Dock", status: "spare" },
];

describe("splitIssuedFromRemarks", () => {
  it("parses issued prefix", () => {
    const r = splitIssuedFromRemarks("[Issued: A, B] rest");
    expect(r.issuedLabels).toEqual(["A", "B"]);
    expect(r.assignmentRemarks).toBe("rest");
  });

  it("returns plain remarks when no prefix", () => {
    expect(splitIssuedFromRemarks("only text").assignmentRemarks).toBe("only text");
  });

  it("handles empty", () => {
    expect(splitIssuedFromRemarks(null)).toEqual({ issuedLabels: [], assignmentRemarks: "" });
  });
});

describe("assignmentRowToWizardState", () => {
  it("maps API row to wizard state", () => {
    const state = assignmentRowToWizardState(baseRow, [], issuedItems);
    expect(state.draftId).toBe("row-1");
    expect(state.version).toBe(2);
    expect(state.employeeId).toBe("emp-1");
    expect(state.employeeSource).toBe("MASTER_DATA");
    expect(state.issuedItemIds).toEqual(["c1", "c2"]);
    expect(state.assignmentRemarks).toBe("Note here");
    expect(state.deliveryReferenceNumber).toBe("DR-9");
    expect(state.deliveryChallanSignatureStatus).toBe("not_signed");
  });

  it("maps explicit signature status", () => {
    const state = assignmentRowToWizardState(
      { ...baseRow, delivery_challan_signature_status: "signed" },
      [],
      issuedItems,
    );
    expect(state.deliveryChallanSignatureStatus).toBe("signed");
  });

  it("prefers explicit issuedItemIds", () => {
    const state = assignmentRowToWizardState(baseRow, ["c3"], issuedItems);
    expect(state.issuedItemIds).toEqual(["c3"]);
  });
});

describe("buildAssignmentRemarks", () => {
  it("builds issued prefix and free text", () => {
    const remarks = buildAssignmentRemarks(
      { ...EMPTY_ASSIGNMENT_WIZARD_STATE, issuedItemIds: ["c1"], assignmentRemarks: "Handle with care" },
      issuedItems,
    );
    expect(remarks).toContain("[Issued: Keyboard]");
    expect(remarks).toContain("Handle with care");
  });
});

describe("wizardStateToCreateBody", () => {
  it("maps employee allocation", () => {
    const body = wizardStateToCreateBody(
      {
        ...EMPTY_ASSIGNMENT_WIZARD_STATE,
        assetId: "a1",
        branchId: "b1",
        allocationType: "employee",
        employeeId: "e1",
        deliveryReferenceStatus: "pending",
        deliveryChallanSignatureStatus: "signed",
        deliveryReferenceNumber: "DC-1",
      },
      [],
    );
    expect(body.asset_id).toBe("a1");
    expect(body.employee_id).toBe("e1");
    expect(body.employee_source).toBe("MASTER_DATA");
    expect(body.department_id).toBeUndefined();
    expect(body.expected_return_at).toBeUndefined();
    expect(body.delivery_challan_signature_status).toBe("signed");
    expect(body.delivery_reference_number).toBe("DC-1");
  });

  it("maps department allocation", () => {
    const body = wizardStateToCreateBody(
      {
        ...EMPTY_ASSIGNMENT_WIZARD_STATE,
        assetId: "a1",
        branchId: "b1",
        allocationType: "department",
        departmentId: "d1",
        deliveryReferenceStatus: "pending",
      },
      [],
    );
    expect(body.department_id).toBe("d1");
    expect(body.employee_id).toBeUndefined();
  });

  it("maps manual employee entry and omits expected return", () => {
    const body = wizardStateToCreateBody(
      {
        ...EMPTY_ASSIGNMENT_WIZARD_STATE,
        assetId: "a1",
        branchId: "b1",
        employeeSource: "MANUAL_ENTRY",
        manualEmployeeName: "Riya Shah",
        manualEmployeePhone: "9876543210",
        manualEmployeeDeployedTo: "Airtel — Gurugram office",
        deliveryReferenceStatus: "pending",
      },
      [],
    );
    expect(body.employee_source).toBe("MANUAL_ENTRY");
    expect(body.employee_id).toBeUndefined();
    expect(body.manual_employee_name).toBe("Riya Shah");
    expect(body.manual_employee_phone).toBe("9876543210");
    expect(body.manual_employee_deployed_to).toBe("Airtel — Gurugram office");
    expect(body.expected_return_at).toBeUndefined();
  });
});

describe("wizardStateToUpdateBody", () => {
  it("includes version", () => {
    const body = wizardStateToUpdateBody(
      { ...EMPTY_ASSIGNMENT_WIZARD_STATE, version: 5, deliveryReferenceStatus: "pending" },
      [],
    );
    expect(body.version).toBe(5);
  });
});

describe("returnWizardStateToBody", () => {
  it("maps return fields", () => {
    expect(
      returnWizardStateToBody({
        returnCondition: "good",
        returnRemarks: "  ok  ",
        reason: " offboarding ",
        componentReturns: [],
      }),
    ).toEqual({
      return_condition: "good",
      return_remarks: "ok",
      reason: "offboarding",
    });
  });

  it("includes component_returns when present", () => {
    expect(
      returnWizardStateToBody({
        returnCondition: "good",
        returnRemarks: "ok",
        reason: "",
        componentReturns: [
          {
            componentId: "c1",
            label: "Charger",
            serialNumber: "CHG-1",
            issueStatus: "RETURNED",
            returnRemarks: "",
          },
        ],
      }),
    ).toEqual({
      return_condition: "good",
      return_remarks: "ok",
      reason: undefined,
      component_returns: [
        { component_id: "c1", issue_status: "RETURNED", return_remarks: undefined },
      ],
    });
  });
});

describe("buildReturnSummary", () => {
  it("builds summary view", () => {
    const summary = buildReturnSummary(
      baseRow,
      { asset_code: "AST-1", asset_name: "Laptop", serial_number: "SN", operational_status: "ASSIGNED" },
      "Jane Doe",
    );
    expect(summary.assetCode).toBe("AST-1");
    expect(summary.assigneeLabel).toBe("Jane Doe");
    expect(summary.documentNumber).toBe("ASN-001");
  });
});
