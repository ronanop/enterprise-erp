import { describe, expect, it } from "vitest";

import {
  formatLifecycleStatusLabel,
  isAssignmentEligibleAsset,
  OPERATIONAL_STATUS_LABELS,
} from "@/components/assets/shared/asset-status";

describe("asset-status labels", () => {
  it("formats operational labels for UX", () => {
    expect(OPERATIONAL_STATUS_LABELS.READY_TO_MOVE).toBe("Ready to Move");
    expect(OPERATIONAL_STATUS_LABELS.PENDING_DISPOSAL).toBe("Pending Disposal");
    expect(OPERATIONAL_STATUS_LABELS.IN_USE_AS_COMPONENT).toBe("In Use as Component");
  });

  it("formats lifecycle labels including maintenance", () => {
    expect(formatLifecycleStatusLabel("in_maintenance")).toBe("In Maintenance");
    expect(formatLifecycleStatusLabel("written_off")).toBe("Written Off");
    expect(formatLifecycleStatusLabel("active")).toBe("Active");
  });
});

describe("isAssignmentEligibleAsset", () => {
  it("allows READY_TO_MOVE + active", () => {
    expect(
      isAssignmentEligibleAsset({
        operational_status: "READY_TO_MOVE",
        status: "active",
      }),
    ).toBe(true);
  });

  it("rejects READY_TO_MOVE + in_maintenance lifecycle", () => {
    expect(
      isAssignmentEligibleAsset({
        operational_status: "READY_TO_MOVE",
        status: "in_maintenance",
      }),
    ).toBe(false);
  });

  it("rejects IN_MAINTENANCE operational status", () => {
    expect(
      isAssignmentEligibleAsset({
        operational_status: "IN_MAINTENANCE",
        status: "active",
      }),
    ).toBe(false);
  });

  it("rejects ASSIGNED even when lifecycle active", () => {
    expect(
      isAssignmentEligibleAsset({
        operational_status: "ASSIGNED",
        status: "active",
      }),
    ).toBe(false);
  });

  it("rejects RETIRED even when lifecycle active", () => {
    expect(
      isAssignmentEligibleAsset({
        operational_status: "RETIRED",
        status: "active",
      }),
    ).toBe(false);
  });

  it("rejects IN_USE_AS_COMPONENT even when lifecycle active", () => {
    expect(
      isAssignmentEligibleAsset({
        operational_status: "IN_USE_AS_COMPONENT",
        status: "active",
      }),
    ).toBe(false);
  });

  it("rejects READY_TO_MOVE draft lifecycle", () => {
    expect(
      isAssignmentEligibleAsset({
        operational_status: "READY_TO_MOVE",
        status: "draft",
      }),
    ).toBe(false);
  });
});
