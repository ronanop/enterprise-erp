/** @vitest-environment jsdom */

import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AssetsModuleSidebar } from "@/components/assets/assets-module-sidebar";
import { assetManagementNav, isAssetNavActive } from "@/config/assets";

vi.mock("next/navigation", () => ({
  usePathname: () => "/assets/assets",
}));

afterEach(() => {
  cleanup();
});

const APPROVED_GROUP_TITLES = [
  "Assets",
  "Configuration",
  "Operations",
  "Lifecycle",
  "Extended",
] as const;

const HIDDEN_TITLES = [
  "Depreciation",
  "Revaluation",
  "Audits",
  "Warranties",
  "Insurance",
  "Maintenance Plans",
  "Service History",
  "Checklists",
  "Meter Readings",
  "Notifications",
  "Asset Locations",
  "Settings",
  "Disposals",
] as const;

describe("AssetsModuleSidebar", () => {
  it("exposes Asset Management landmark", () => {
    render(<AssetsModuleSidebar />);
    expect(screen.getByTestId("assets-module-sidebar")).toHaveAttribute(
      "aria-label",
      "Asset Management",
    );
  });

  it("renders a docked sidebar that does not overlay on hover", () => {
    render(<AssetsModuleSidebar />);
    const sidebar = screen.getByTestId("assets-module-sidebar");
    expect(sidebar.className).toMatch(/w-\[260px\]/);
    expect(sidebar.className).not.toMatch(/hover:w-64/);
    expect(sidebar.className).toMatch(/h-dvh/);
    expect(screen.getByTestId("assets-module-sidebar-nav")).toBeInTheDocument();
    expect(screen.queryByTestId("assets-module-sidebar-mobile")).not.toBeInTheDocument();
  });

  it("collapses in-flow without covering content", async () => {
    const user = userEvent.setup();
    render(<AssetsModuleSidebar />);
    const sidebar = screen.getByTestId("assets-module-sidebar");
    await user.click(screen.getByTestId("assets-module-sidebar-collapse"));
    expect(sidebar.className).toMatch(/w-\[72px\]/);
    expect(sidebar.className).not.toMatch(/w-\[260px\]/);
  });

  it("locks nav to the approved current-scope sections and order", () => {
    expect(assetManagementNav.map((g) => g.title)).toEqual([...APPROVED_GROUP_TITLES]);
    expect(assetManagementNav[0]?.items.map((i) => i.title)).toEqual([
      "Dashboard",
      "All Assets",
      "Incoming Assets",
      "Incoming QC",
      "Pending Registration",
      "Add Asset",
    ]);
    expect(assetManagementNav[1]?.items.map((i) => i.title)).toEqual([
      "Categories",
      "Asset Types",
      "Locations",
      "Departments",
    ]);
    expect(assetManagementNav[2]?.items.map((i) => i.title)).toEqual([
      "Asset Assignment",
      "DC Challan",
      "Transfers",
      "Maintenance",
    ]);
    expect(assetManagementNav[3]?.items.map((i) => i.title)).toEqual(["Disposal"]);
    expect(assetManagementNav[4]?.items.map((i) => i.title)).toEqual([
      "Components",
      "Documents",
      "QR / Barcode",
      "Reports",
    ]);
  });

  it("hides future modules from the rail", () => {
    render(<AssetsModuleSidebar />);
    const nav = screen.getByTestId("assets-module-sidebar-nav");
    for (const title of HIDDEN_TITLES) {
      expect(within(nav).queryByRole("link", { name: title })).not.toBeInTheDocument();
    }
  });

  it("keeps only Locations (no Asset Locations duplicate)", () => {
    render(<AssetsModuleSidebar />);
    const nav = screen.getByTestId("assets-module-sidebar-nav");
    expect(within(nav).getByRole("link", { name: "Locations" })).toHaveAttribute(
      "href",
      "/assets/locations",
    );
    expect(within(nav).queryByRole("link", { name: "Asset Locations" })).not.toBeInTheDocument();
  });

  it("labels retained links and marks active All Assets", () => {
    render(<AssetsModuleSidebar />);
    const nav = screen.getByTestId("assets-module-sidebar-nav");
    expect(within(nav).getByRole("link", { name: "Dashboard" })).toHaveAttribute(
      "href",
      "/assets",
    );
    expect(within(nav).getByRole("link", { name: "All Assets" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(within(nav).getByRole("link", { name: "Disposal" })).toHaveAttribute(
      "href",
      "/assets/asset-disposals",
    );
    expect(within(nav).getByRole("link", { name: "Components" })).toHaveAttribute(
      "href",
      "/assets/asset-components",
    );
  });

  it("does not treat Add Asset as All Assets", () => {
    expect(isAssetNavActive("/assets/assets/new", "/assets/assets", "prefix")).toBe(false);
    expect(isAssetNavActive("/assets/assets/new", "/assets/assets/new", "exact")).toBe(true);
    expect(isAssetNavActive("/assets/assets", "/assets/assets", "prefix")).toBe(true);
  });
});
