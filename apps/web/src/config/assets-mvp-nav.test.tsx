/** @vitest-environment jsdom */

import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AssetsModuleSidebar } from "@/components/assets/assets-module-sidebar";
import { AssetsWorkspaceNav } from "@/components/assets/assets-workspace-nav";
import {
  assetManagementNav,
  assetManagementNavCatalog,
  getAssetManagementNavItems,
} from "@/config/assets";

vi.mock("next/navigation", () => ({
  usePathname: () => "/assets/assets",
}));

afterEach(() => {
  cleanup();
});

describe("Assets full navigation", () => {
  it("sidebar config exposes the full operations catalog", () => {
    const titles = assetManagementNav.flatMap((g) => g.items.map((i) => i.title));
    expect(titles).toEqual(
      expect.arrayContaining([
        "Dashboard",
        "Asset Operations",
        "Asset Register",
        "Add Asset",
        "Categories",
        "Asset Allocation",
        "Transfers",
        "Maintenance",
        "Depreciation",
        "Disposals",
        "Audits",
        "Components",
        "QR / Barcode",
        "Reports",
        "Settings",
      ]),
    );
    expect(titles.length).toBeGreaterThan(3);
    expect(assetManagementNav).toEqual(assetManagementNavCatalog);
  });

  it("sidebar UI renders Dashboard and Operations links", () => {
    render(<AssetsModuleSidebar />);
    const nav = screen.getByLabelText("Asset Management");
    expect(within(nav).getByRole("link", { name: /^Dashboard$/i })).toHaveAttribute("href", "/assets");
    expect(within(nav).getByRole("link", { name: /Asset Operations/i })).toHaveAttribute(
      "href",
      "/assets/operations",
    );
    expect(within(nav).getByRole("link", { name: /Asset Register/i })).toHaveAttribute(
      "href",
      "/assets/assets",
    );
    expect(within(nav).getByRole("link", { name: /Asset Allocation/i })).toHaveAttribute(
      "href",
      "/assets/asset-assignments",
    );
    expect(within(nav).getByRole("link", { name: /^Transfers$/i })).toHaveAttribute(
      "href",
      "/assets/asset-transfers",
    );
    expect(within(nav).getByRole("link", { name: /^Maintenance$/i })).toHaveAttribute(
      "href",
      "/assets/asset-maintenances",
    );
    expect(within(nav).getByRole("link", { name: /^Disposals$/i })).toHaveAttribute(
      "href",
      "/assets/asset-disposals",
    );
    expect(within(nav).getByText("Operations")).toBeInTheDocument();
    expect(within(nav).getByText("Lifecycle")).toBeInTheDocument();
    expect(within(nav).getByText("Compliance")).toBeInTheDocument();
  });

  it("workspace secondary nav matches full catalog items", () => {
    render(<AssetsWorkspaceNav />);
    const nav = screen.getByRole("navigation", { name: "Assets workspace" });
    const links = within(nav).getAllByRole("link").map((a) => a.textContent);
    expect(links).toEqual(getAssetManagementNavItems().map((i) => i.title));
  });
});
