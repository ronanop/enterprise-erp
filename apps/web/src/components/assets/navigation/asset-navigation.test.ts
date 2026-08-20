import { describe, expect, it, vi } from "vitest";

import {
  assetNavigationPaths,
  createAssetNavigation,
  dispatchInventoryMenuAction,
  dispatchInventoryQuickLink,
} from "@/components/assets/navigation/asset-navigation";
import { consumeInventoryFocusAsset } from "@/components/assets/inventory/inventory-focus";

describe("assetNavigationPaths", () => {
  it("builds encoded asset detail path", () => {
    expect(assetNavigationPaths.details("abc-123")).toBe("/assets/assets/abc-123");
  });

  it("builds assignment wizard prefill path", () => {
    expect(assetNavigationPaths.assignment("x")).toContain("assetId=x");
    expect(assetNavigationPaths.assignment("x")).toContain("/assets/asset-assignments/new");
  });

  it("builds information portal path", () => {
    expect(assetNavigationPaths.informationPortal("id")).toBe("/assets/information-portal/id");
  });
});

describe("createAssetNavigation", () => {
  it("delegates each open method to push", () => {
    sessionStorage.clear();
    const push = vi.fn();
    const nav = createAssetNavigation(push);

    nav.openInventory();
    expect(push).toHaveBeenCalledWith("/assets/assets");
    expect(consumeInventoryFocusAsset()).toBeNull();

    nav.openRegisterNew();
    expect(push).toHaveBeenCalledWith("/assets/assets/new");

    nav.openInventoryImport();
    expect(push).toHaveBeenCalledWith("/assets/inventory-import");

    nav.openAssignmentWizard();
    expect(push).toHaveBeenCalledWith("/assets/asset-assignments/new");

    nav.openReturnWizard();
    expect(push).toHaveBeenCalledWith(expect.stringContaining("/assets/asset-assignments/return"));

    nav.openDetails("a1");
    expect(push).toHaveBeenCalledWith("/assets/assets/a1");

    nav.openAssignment("a1");
    expect(push).toHaveBeenCalledWith(expect.stringContaining("/assets/asset-assignments/new"));

    nav.openReturn("a1");
    expect(push).toHaveBeenCalledWith(expect.stringContaining("intent=return"));

    nav.openPortal("a1");
    expect(push).toHaveBeenCalledWith("/assets/information-portal/a1");

    nav.openDiscovery("a1");
    expect(push).toHaveBeenCalledWith("/assets/assets/a1");

    nav.openQr("a1");
    expect(push).toHaveBeenCalledWith(expect.stringContaining("/assets/qr-barcode"));

    nav.openTransfer("a1");
    expect(push).toHaveBeenCalledWith(expect.stringContaining("/assets/asset-transfers"));

    nav.openMaintenance("a1");
    expect(push).toHaveBeenCalledWith(expect.stringContaining("/assets/asset-maintenances"));

    nav.openMaintenanceList();
    expect(push).toHaveBeenCalledWith("/assets/asset-maintenances");

    nav.openAssignmentList();
    expect(push).toHaveBeenCalledWith(expect.stringContaining("/assets/asset-assignments"));

    nav.openOperations();
    expect(push).toHaveBeenCalledWith("/assets/operations");

    nav.openHistory("a1");
    expect(push).toHaveBeenCalledWith(expect.stringContaining("tab=activity"));

    nav.openEdit("a1");
    expect(push).toHaveBeenCalledWith(expect.stringContaining("intent=edit"));

    nav.openDisposal("a1");
    expect(push).toHaveBeenCalledWith(expect.stringContaining("/assets/asset-disposals"));

    nav.openDelete("a1");
    expect(push).toHaveBeenCalledWith(expect.stringContaining("intent=edit"));
  });

  it("stashes focus asset when opening inventory with asset id", () => {
    sessionStorage.clear();
    const push = vi.fn();
    const nav = createAssetNavigation(push);
    nav.openInventory("asset-42");
    expect(push).toHaveBeenCalledWith("/assets/assets");
    expect(consumeInventoryFocusAsset()).toBe("asset-42");
    expect(consumeInventoryFocusAsset()).toBeNull();
  });
});

describe("dispatchInventoryMenuAction", () => {
  it("routes assign action to openAssignment when Ready", () => {
    const nav = createAssetNavigation(vi.fn());
    const spy = vi.spyOn(nav, "openAssignment");
    dispatchInventoryMenuAction(nav, "assign", "asset-1", "READY_TO_MOVE");
    expect(spy).toHaveBeenCalledWith("asset-1");
  });

  it("blocks assign when Assigned", () => {
    const nav = createAssetNavigation(vi.fn());
    const spy = vi.spyOn(nav, "openAssignment");
    dispatchInventoryMenuAction(nav, "assign", "asset-1", "ASSIGNED");
    expect(spy).not.toHaveBeenCalled();
  });

  it("routes portal action to openPortal", () => {
    const nav = createAssetNavigation(vi.fn());
    const spy = vi.spyOn(nav, "openPortal");
    dispatchInventoryMenuAction(nav, "portal", "asset-2");
    expect(spy).toHaveBeenCalledWith("asset-2");
  });

  it("routes edit and dispose when status allows", () => {
    const nav = createAssetNavigation(vi.fn());
    const editSpy = vi.spyOn(nav, "openEdit");
    const disposeSpy = vi.spyOn(nav, "openDisposal");
    dispatchInventoryMenuAction(nav, "edit", "asset-1", "READY_TO_MOVE");
    dispatchInventoryMenuAction(nav, "dispose", "asset-2", "PENDING_DISPOSAL");
    expect(editSpy).toHaveBeenCalledWith("asset-1");
    expect(disposeSpy).toHaveBeenCalledWith("asset-2");
  });
});

describe("dispatchInventoryQuickLink", () => {
  it("routes discovery quick link", () => {
    const nav = createAssetNavigation(vi.fn());
    const spy = vi.spyOn(nav, "openDiscovery");
    dispatchInventoryQuickLink(nav, "discovery", "asset-3");
    expect(spy).toHaveBeenCalledWith("asset-3");
  });
});
