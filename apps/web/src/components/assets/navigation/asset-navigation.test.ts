import { describe, expect, it, vi } from "vitest";

import {
  assetNavigationPaths,
  createAssetNavigation,
  dispatchInventoryMenuAction,
  dispatchInventoryQuickLink,
} from "@/components/assets/navigation/asset-navigation";

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
    const push = vi.fn();
    const nav = createAssetNavigation(push);

    nav.openInventory();
    expect(push).toHaveBeenCalledWith("/assets/assets");

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

    nav.openHistory("a1");
    expect(push).toHaveBeenCalledWith(expect.stringContaining("tab=activity"));
  });
});

describe("dispatchInventoryMenuAction", () => {
  it("routes assign action to openAssignment", () => {
    const nav = createAssetNavigation(vi.fn());
    const spy = vi.spyOn(nav, "openAssignment");
    dispatchInventoryMenuAction(nav, "assign", "asset-1");
    expect(spy).toHaveBeenCalledWith("asset-1");
  });

  it("routes portal action to openPortal", () => {
    const nav = createAssetNavigation(vi.fn());
    const spy = vi.spyOn(nav, "openPortal");
    dispatchInventoryMenuAction(nav, "portal", "asset-2");
    expect(spy).toHaveBeenCalledWith("asset-2");
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
