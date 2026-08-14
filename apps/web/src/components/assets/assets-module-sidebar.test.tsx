/** @vitest-environment jsdom */

import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AssetsModuleSidebar } from "@/components/assets/assets-module-sidebar";
import { assetManagementNav } from "@/config/assets";

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

  it("renders mobile full-label nav and desktop icon rail", () => {
    render(<AssetsModuleSidebar />);
    expect(screen.getByTestId("assets-module-sidebar-mobile")).toBeInTheDocument();
    expect(screen.getByTestId("assets-module-sidebar-rail")).toBeInTheDocument();
    const railNav = screen.getByTestId("assets-module-sidebar-rail-nav");
    expect(railNav.className).toMatch(/w-16/);
    expect(railNav.className).toMatch(/hover:w-64/);
    expect(railNav.className).toMatch(/focus-within:w-64/);
    expect(railNav.className).toMatch(/motion-reduce:transition-none/);
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
    const rail = screen.getByTestId("assets-module-sidebar-rail-nav");
    for (const title of HIDDEN_TITLES) {
      expect(within(rail).queryByRole("link", { name: title })).not.toBeInTheDocument();
    }
  });

  it("keeps only Locations (no Asset Locations duplicate)", () => {
    render(<AssetsModuleSidebar />);
    const rail = screen.getByTestId("assets-module-sidebar-rail-nav");
    expect(within(rail).getByRole("link", { name: "Locations" })).toHaveAttribute(
      "href",
      "/assets/locations",
    );
    expect(within(rail).queryByRole("link", { name: "Asset Locations" })).not.toBeInTheDocument();
  });

  it("labels retained links and marks active All Assets", () => {
    render(<AssetsModuleSidebar />);
    const rail = screen.getByTestId("assets-module-sidebar-rail-nav");
    expect(within(rail).getByRole("link", { name: "Dashboard" })).toHaveAttribute(
      "href",
      "/assets",
    );
    expect(within(rail).getByRole("link", { name: "All Assets" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(within(rail).getByRole("link", { name: "Disposal" })).toHaveAttribute(
      "href",
      "/assets/asset-disposals",
    );
    expect(within(rail).getByRole("link", { name: "Components" })).toHaveAttribute(
      "href",
      "/assets/asset-components",
    );
  });
});
