import { describe, expect, it, vi } from "vitest";

import {
  handleInventoryMenuWorkflow,
  inventoryPathAfterWorkflow,
  isInventoryWorkflowAction,
  wizardInitialStateFromAssetId,
} from "@/components/assets/inventory/inventory-workflow";
import { createAssetNavigation } from "@/components/assets/navigation/asset-navigation";

describe("isInventoryWorkflowAction", () => {
  it("detects assign, return, and dispose", () => {
    expect(isInventoryWorkflowAction("assign")).toBe(true);
    expect(isInventoryWorkflowAction("return")).toBe(true);
    expect(isInventoryWorkflowAction("dispose")).toBe(true);
  });

  it("ignores other menu actions", () => {
    expect(isInventoryWorkflowAction("viewDetails")).toBe(false);
    expect(isInventoryWorkflowAction("portal")).toBe(false);
    expect(isInventoryWorkflowAction("transfer")).toBe(false);
  });
});

describe("wizardInitialStateFromAssetId", () => {
  it("returns seed for valid id", () => {
    expect(wizardInitialStateFromAssetId("asset-1")).toEqual({ assetId: "asset-1" });
  });

  it("trims whitespace", () => {
    expect(wizardInitialStateFromAssetId("  a1  ")).toEqual({ assetId: "a1" });
  });

  it("returns undefined for empty", () => {
    expect(wizardInitialStateFromAssetId("")).toBeUndefined();
    expect(wizardInitialStateFromAssetId(null)).toBeUndefined();
    expect(wizardInitialStateFromAssetId(undefined)).toBeUndefined();
    expect(wizardInitialStateFromAssetId("   ")).toBeUndefined();
  });
});

describe("inventoryPathAfterWorkflow", () => {
  it("returns inventory path", () => {
    expect(inventoryPathAfterWorkflow()).toBe("/assets/assets");
  });
});

describe("handleInventoryMenuWorkflow", () => {
  it("closes drawer then navigates to issue wizard", () => {
    const push = vi.fn();
    const closeDrawer = vi.fn();
    const navigation = createAssetNavigation(push);
    handleInventoryMenuWorkflow({
      action: "assign",
      assetId: "asset-99",
      navigation,
      closeDrawer,
      operationalStatus: "READY_TO_MOVE",
    });
    expect(closeDrawer).toHaveBeenCalledOnce();
    expect(push).toHaveBeenCalledWith(
      expect.stringContaining("/assets/asset-assignments/new?assetId=asset-99"),
    );
  });

  it("closes drawer then navigates to return wizard", () => {
    const push = vi.fn();
    const closeDrawer = vi.fn();
    const navigation = createAssetNavigation(push);
    handleInventoryMenuWorkflow({
      action: "return",
      assetId: "asset-99",
      navigation,
      closeDrawer,
      operationalStatus: "ASSIGNED",
    });
    expect(closeDrawer).toHaveBeenCalledOnce();
    expect(push).toHaveBeenCalledWith(
      expect.stringContaining("/assets/asset-assignments/return?assetId=asset-99"),
    );
    expect(push.mock.calls[0]?.[0]).toContain("intent=return");
  });

  it("does not close drawer for viewDetails", () => {
    const push = vi.fn();
    const closeDrawer = vi.fn();
    handleInventoryMenuWorkflow({
      action: "viewDetails",
      assetId: "asset-99",
      navigation: createAssetNavigation(push),
      closeDrawer,
      operationalStatus: "READY_TO_MOVE",
    });
    expect(closeDrawer).not.toHaveBeenCalled();
    expect(push).toHaveBeenCalledWith("/assets/assets/asset-99");
  });

  it("closes drawer only once (no duplicate navigation)", () => {
    const push = vi.fn();
    const closeDrawer = vi.fn();
    handleInventoryMenuWorkflow({
      action: "assign",
      assetId: "a1",
      navigation: createAssetNavigation(push),
      closeDrawer,
      operationalStatus: "READY_TO_MOVE",
    });
    expect(push).toHaveBeenCalledTimes(1);
    expect(closeDrawer).toHaveBeenCalledTimes(1);
  });

  it("blocks assign when status is ASSIGNED", () => {
    const push = vi.fn();
    const closeDrawer = vi.fn();
    handleInventoryMenuWorkflow({
      action: "assign",
      assetId: "a1",
      navigation: createAssetNavigation(push),
      closeDrawer,
      operationalStatus: "ASSIGNED",
    });
    expect(closeDrawer).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  it("blocks return when status is READY_TO_MOVE", () => {
    const push = vi.fn();
    const closeDrawer = vi.fn();
    handleInventoryMenuWorkflow({
      action: "return",
      assetId: "a1",
      navigation: createAssetNavigation(push),
      closeDrawer,
      operationalStatus: "READY_TO_MOVE",
    });
    expect(closeDrawer).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });
});
