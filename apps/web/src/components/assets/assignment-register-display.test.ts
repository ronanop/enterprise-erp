import { describe, expect, it } from "vitest";

import {
  formatAssignmentDate,
  formatAssignmentRegisterDcChallan,
  formatAssignmentRegisterDcColumn,
  formatAssignmentStatus,
  isReturnedAssignment,
  resolveRegisterAssetCode,
  resolveRegisterAssetName,
  resolveRegisterAssignee,
  resolveRegisterBuilding,
  resolveRegisterDepartment,
  resolveRegisterEmployeeId,
  resolveRegisterLocation,
} from "@/components/assets/assignment-register-display";

const employeeLookup = {
  "emp-1": {
    label: "Rohan Mehta (EMP-002)",
    displayName: "Rohan Mehta",
    employeeCode: "EMP-002",
    mobile: null,
  },
};

describe("formatAssignmentRegisterDcChallan / formatAssignmentRegisterDcColumn", () => {
  it("shows Not Created when no DC challan record exists", () => {
    expect(
      formatAssignmentRegisterDcColumn({
        delivery_reference_status: "pending",
        delivery_challan_signature_status: "not_signed",
        hasDcRecord: false,
      }),
    ).toBe("Not Created");
    expect(
      formatAssignmentRegisterDcChallan(null, "pending", "not_signed", { hasDcRecord: false }),
    ).toBe("Not Created");
  });

  it("shows Pending · Not Signed for existing pending DC", () => {
    expect(
      formatAssignmentRegisterDcColumn({
        delivery_reference_status: "pending",
        delivery_challan_signature_status: "not_signed",
        hasDcRecord: true,
        dcChallanStatus: "PENDING",
      }),
    ).toBe("Pending · Not Signed");
  });

  it("shows Generated · Not Signed from assignment fields when DC exists without entity status detail", () => {
    expect(
      formatAssignmentRegisterDcChallan("DC-1", "issued", "not_signed", { hasDcRecord: true }),
    ).toBe("Generated · Not Signed");
  });

  it("shows Signed when DC challan is signed", () => {
    expect(
      formatAssignmentRegisterDcColumn({
        delivery_reference_status: "issued",
        delivery_challan_signature_status: "signed",
        hasDcRecord: true,
        dcChallanStatus: "SIGNED",
      }),
    ).toBe("Signed");
  });

  it("shows Not Applicable", () => {
    expect(
      formatAssignmentRegisterDcColumn({
        delivery_reference_status: "not_applicable",
        hasDcRecord: false,
      }),
    ).toBe("Not Applicable");
  });
});

describe("resolveRegisterAssignee", () => {
  it("shows real employee name from directory", () => {
    expect(
      resolveRegisterAssignee(
        { allocation_type: "employee", employee_id: "emp-1" },
        employeeLookup,
      ),
    ).toBe("Rohan Mehta");
  });

  it("shows manual employee name", () => {
    expect(
      resolveRegisterAssignee(
        {
          allocation_type: "employee",
          employee_id: null,
          manual_employee_name: "Shreya Saxena",
          employee_source: "manual",
        },
        {},
      ),
    ).toBe("Shreya Saxena");
  });

  it("does not show Assigned as assignee", () => {
    expect(
      resolveRegisterAssignee({ allocation_type: "employee", employee_id: null }, {}),
    ).toBe("—");
  });
});

describe("resolveRegisterEmployeeId", () => {
  it("shows employee code from directory", () => {
    expect(
      resolveRegisterEmployeeId({ employee_id: "emp-1" }, employeeLookup),
    ).toBe("EMP-002");
  });

  it("shows dash for manual entry without employee_id", () => {
    expect(
      resolveRegisterEmployeeId(
        { employee_id: null, manual_employee_name: "Shreya Saxena" },
        {},
      ),
    ).toBe("—");
  });
});

describe("asset / org display", () => {
  it("shows asset name and code", () => {
    const asset = { asset_name: "Macbook", asset_code: "AST-2026-000002" };
    expect(resolveRegisterAssetName(asset, "a1")).toBe("Macbook");
    expect(resolveRegisterAssetCode(asset)).toBe("AST-2026-000002");
  });

  it("shows department from assignment or employee/asset", () => {
    expect(
      resolveRegisterDepartment(
        { department_id: "d1" },
        null,
        null,
        { d1: "Finance" },
      ),
    ).toBe("Finance");
    expect(
      resolveRegisterDepartment(
        { department_id: null },
        { department_id: "d2" },
        null,
        { d2: "IT" },
      ),
    ).toBe("IT");
  });

  it("shows location and building", () => {
    expect(
      resolveRegisterLocation(
        { current_location_label: null },
        { location_label: "Noida HQ", building_id: "b1" },
      ),
    ).toBe("Noida HQ");
    expect(resolveRegisterBuilding({ building_id: "b1" }, { b1: "Tower A" })).toBe(
      "Tower A",
    );
  });

  it("shows assignment date and user-friendly status (never workflow composites)", () => {
    expect(formatAssignmentDate("2026-03-15T10:00:00Z")).toBe("2026-03-15");
    expect(formatAssignmentStatus("active", "approved")).toBe("Active");
    expect(formatAssignmentStatus("returned", "approved")).toBe("Returned");
    expect(formatAssignmentStatus("active", "approved")).not.toContain("/");
    expect(formatAssignmentStatus("active", "approved")).not.toContain("approved");
  });
});

describe("formatAssignmentStatus", () => {
  it("maps active + approved → Active", () => {
    expect(formatAssignmentStatus("active", "approved")).toBe("Active");
  });

  it("maps returned + approved → Returned", () => {
    expect(formatAssignmentStatus("returned", "approved")).toBe("Returned");
  });

  it("maps active + pending workflow → Active", () => {
    expect(formatAssignmentStatus("active", "in_progress")).toBe("Active");
    expect(formatAssignmentStatus("active", "pending")).toBe("Active");
  });

  it("maps returned + any workflow status → Returned", () => {
    expect(formatAssignmentStatus("returned", "approved")).toBe("Returned");
    expect(formatAssignmentStatus("returned", "rejected")).toBe("Returned");
    expect(formatAssignmentStatus("returned", null)).toBe("Returned");
  });

  it("never renders active / approved style composites", () => {
    const samples = [
      formatAssignmentStatus("active", "approved"),
      formatAssignmentStatus("returned", "approved"),
      formatAssignmentStatus("active", "in_progress"),
    ];
    for (const label of samples) {
      expect(label).not.toMatch(/\//);
      expect(label.toLowerCase()).not.toContain("approved");
      expect(label).not.toBe("active / approved");
      expect(label).not.toBe("returned / approved");
    }
  });

  it("uses safe fallback for missing or internal workflow-like statuses", () => {
    expect(formatAssignmentStatus(null)).toBe("—");
    expect(formatAssignmentStatus("")).toBe("—");
    expect(formatAssignmentStatus("draft")).toBe("—");
    expect(formatAssignmentStatus("submitted")).toBe("—");
    expect(formatAssignmentStatus("approved")).toBe("—");
    expect(formatAssignmentStatus("rejected")).toBe("—");
  });
});

describe("returned assignments", () => {
  it("flags returned status", () => {
    expect(isReturnedAssignment({ status: "returned" })).toBe(true);
    expect(isReturnedAssignment({ status: "active" })).toBe(false);
    expect(isReturnedAssignment({ status: "active", returned_at: "2026-01-01" })).toBe(
      true,
    );
  });

  it("still resolves historical assignee name for returned rows", () => {
    expect(
      resolveRegisterAssignee(
        {
          status: "returned",
          allocation_type: "employee",
          employee_id: "emp-1",
          returned_at: "2026-02-01",
        },
        employeeLookup,
      ),
    ).toBe("Rohan Mehta");
  });
});
