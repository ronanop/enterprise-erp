import { describe, expect, it } from "vitest";

import {
  EMPTY_USER_TRANSFER_ASSIGN,
  EMPTY_USER_TRANSFER_RETURN,
  isUserTransferAssignComplete,
  isUserTransferReturnComplete,
} from "@/components/assets/user-transfer-destination";

describe("isUserTransferAssignComplete", () => {
  it("requires employee, location, building, and date for Existing Employee", () => {
    expect(isUserTransferAssignComplete(EMPTY_USER_TRANSFER_ASSIGN)).toBe(false);
    expect(
      isUserTransferAssignComplete({
        ...EMPTY_USER_TRANSFER_ASSIGN,
        employeeSource: "MASTER_DATA",
        employeeId: "e1",
        toLocationId: "loc",
        toBuildingId: "b1",
        allocatedAt: "2026-09-16",
      }),
    ).toBe(true);
  });

  it("requires manual identity fields and department for Manual Entry", () => {
    expect(
      isUserTransferAssignComplete({
        ...EMPTY_USER_TRANSFER_ASSIGN,
        employeeSource: "MANUAL_ENTRY",
        toLocationId: "loc",
        toBuildingId: "b1",
        allocatedAt: "2026-09-16",
        manualEmployeeName: "Shreya Saxena",
        manualEmployeePhone: "9876543210",
        manualEmployeeDeployedTo: "Client site",
        departmentId: "d1",
      }),
    ).toBe(true);
    expect(
      isUserTransferAssignComplete({
        ...EMPTY_USER_TRANSFER_ASSIGN,
        employeeSource: "MANUAL_ENTRY",
        toLocationId: "loc",
        toBuildingId: "b1",
        allocatedAt: "2026-09-16",
        manualEmployeeName: "Shreya Saxena",
        manualEmployeePhone: "9876543210",
        manualEmployeeDeployedTo: "Client site",
        departmentId: "",
      }),
    ).toBe(false);
  });
});

describe("isUserTransferReturnComplete", () => {
  it("requires non-empty reason", () => {
    expect(isUserTransferReturnComplete(EMPTY_USER_TRANSFER_RETURN)).toBe(false);
    expect(
      isUserTransferReturnComplete({ ...EMPTY_USER_TRANSFER_RETURN, reason: "End of project" }),
    ).toBe(true);
  });
});
