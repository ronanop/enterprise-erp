import { describe, expect, it } from "vitest";

import {
  buildDcChallanHref,
  canCreateDcChallanFromInventory,
  canLaunchDcFromAssignment,
  isEmployeeAllocation,
  isManualEntryDcChallan,
} from "@/components/assets/navigation/dc-challan-navigation";

describe("dc-challan-navigation", () => {
  it("builds deep links with asset and assignment ids", () => {
    expect(buildDcChallanHref()).toBe("/assets/asset-dc-challans");
    expect(buildDcChallanHref({ assetId: "a1" })).toBe("/assets/asset-dc-challans?assetId=a1");
    expect(buildDcChallanHref({ assetId: "a1", assignmentId: "asn-1" })).toBe(
      "/assets/asset-dc-challans?assetId=a1&assignmentId=asn-1",
    );
    expect(buildDcChallanHref({ challanId: "dc-1" })).toBe(
      "/assets/asset-dc-challans?challanId=dc-1",
    );
  });

  it("treats only employee allocation as eligible", () => {
    expect(isEmployeeAllocation("employee")).toBe(true);
    expect(isEmployeeAllocation("warehouse")).toBe(false);
    expect(isEmployeeAllocation("department")).toBe(false);
  });

  it("hides Create DC for closed or non-employee assignments", () => {
    expect(
      canLaunchDcFromAssignment({ allocation_type: "employee", status: "active" }),
    ).toBe(true);
    expect(
      canLaunchDcFromAssignment({ allocation_type: "warehouse", status: "active" }),
    ).toBe(false);
    expect(
      canLaunchDcFromAssignment({ allocation_type: "employee", status: "returned" }),
    ).toBe(false);
  });

  it("allows Case 2 on Ready to Move and hides warehouse assignments", () => {
    expect(canCreateDcChallanFromInventory({ operationalStatus: "READY_TO_MOVE" })).toBe(true);
    expect(
      canCreateDcChallanFromInventory({
        operationalStatus: "ASSIGNED",
        assignmentAllocationType: "employee",
      }),
    ).toBe(true);
    expect(
      canCreateDcChallanFromInventory({
        operationalStatus: "ASSIGNED",
        assignmentAllocationType: "warehouse",
      }),
    ).toBe(false);
    expect(canCreateDcChallanFromInventory({ operationalStatus: "RETIRED" })).toBe(false);
  });

  it("treats deployed_to as a manual-entry challan", () => {
    expect(isManualEntryDcChallan({ deployed_to: "Airtel — Gurugram office" })).toBe(true);
    expect(isManualEntryDcChallan({ deployed_to: "" })).toBe(false);
    expect(isManualEntryDcChallan({})).toBe(false);
  });
});
