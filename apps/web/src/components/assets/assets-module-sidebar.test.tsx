/** @vitest-environment jsdom */

import { cleanup, render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AssetsModuleSidebar } from "@/components/assets/assets-module-sidebar";
import {
  buildAssetSidebarNav,
  isAssetNavActive,
  itAssetWorkspaceNav,
  nonItAssetWorkspaceNav,
} from "@/config/assets";

vi.mock("next/navigation", () => ({
  usePathname: () => "/assets/assets",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/services/asset-domain-membership-service", () => ({
  fetchMyDomainAccess: vi.fn(async () => ({
    is_module_admin: true,
    domains: ["IT", "NON_IT"],
    admin_domains: ["IT", "NON_IT"],
    memberships: [],
  })),
}));

afterEach(() => {
  cleanup();
});

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
  it("exposes Asset Management landmark", async () => {
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

  it("builds domain switcher + IT workspace with nested Users for module admin", () => {
    const nav = buildAssetSidebarNav({
      isModuleAdmin: true,
      domains: ["IT", "NON_IT"],
      adminDomains: ["IT", "NON_IT"],
      activeDomain: "IT",
    });
    expect(nav.map((g) => g.title)).toEqual([
      "Domains",
      "IT Assets",
      "Configuration",
      "Operations",
      "Lifecycle",
      "Extended",
    ]);
    expect(nav[0]?.items.map((i) => i.title)).toEqual(["IT Assets", "Non-IT Assets"]);
    expect(itAssetWorkspaceNav[0]?.items.map((i) => i.title)).toEqual([
      "Dashboard",
      "All Assets",
      "Incoming Assets",
      "Incoming QC",
      "Pending Registration",
      "Add Asset",
    ]);
    const extended = nav.find((g) => g.title === "Extended");
    expect(extended?.items.map((i) => i.title)).toContain("Users");
    expect(nonItAssetWorkspaceNav[0]?.items.map((i) => i.title)).toEqual([
      "Dashboard",
      "Inventory",
      "Types",
      "Locations",
      "Users",
    ]);
    expect(nonItAssetWorkspaceNav[0]?.items.some((i) => i.title === "Users")).toBe(true);
  });

  it("hides Users tab for domain members who are not admins", () => {
    const nav = buildAssetSidebarNav({
      isModuleAdmin: false,
      domains: ["IT"],
      adminDomains: [],
      activeDomain: "IT",
    });
    const allTitles = nav.flatMap((g) => g.items.map((i) => i.title));
    expect(allTitles).not.toContain("Users");
    expect(allTitles).toContain("All Assets");
  });

  it("hides future modules from the rail", async () => {
    render(<AssetsModuleSidebar />);
    await waitFor(() => {
      expect(screen.getByRole("link", { name: "All Assets" })).toBeInTheDocument();
    });
    const nav = screen.getByTestId("assets-module-sidebar-nav");
    for (const title of HIDDEN_TITLES) {
      expect(within(nav).queryByRole("link", { name: title })).not.toBeInTheDocument();
    }
  });

  it("keeps only Locations (no Asset Locations duplicate)", async () => {
    render(<AssetsModuleSidebar />);
    await waitFor(() => {
      expect(screen.getByRole("link", { name: "Locations" })).toBeInTheDocument();
    });
    const nav = screen.getByTestId("assets-module-sidebar-nav");
    expect(within(nav).getByRole("link", { name: "Locations" })).toHaveAttribute(
      "href",
      "/assets/locations",
    );
    expect(within(nav).queryByRole("link", { name: "Asset Locations" })).not.toBeInTheDocument();
  });

  it("labels retained links and marks active All Assets", async () => {
    render(<AssetsModuleSidebar />);
    await waitFor(() => {
      expect(screen.getByRole("link", { name: "All Assets" })).toBeInTheDocument();
    });
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
