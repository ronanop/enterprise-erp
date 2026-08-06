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
    expect(state.issuedItemIds).toEqual(["c1", "c2"]);
    expect(state.assignmentRemarks).toBe("Note here");
    expect(state.deliveryReferenceNumber).toBe("DR-9");
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
      },
      [],
    );
    expect(body.asset_id).toBe("a1");
    expect(body.employee_id).toBe("e1");
    expect(body.department_id).toBeUndefined();
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
      }),
    ).toEqual({
      return_condition: "good",
      return_remarks: "ok",
      reason: "offboarding",
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
