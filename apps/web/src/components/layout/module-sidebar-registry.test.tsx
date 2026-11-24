import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/assets/assets-module-sidebar", () => ({ AssetsModuleSidebar: () => null }));
vi.mock("@/components/crm/crm-workspace-nav", () => ({ CrmSidebar: () => null }));
vi.mock("@/components/layout/app-sidebar", () => ({ AppSidebar: () => null }));
vi.mock("@/components/layout/workspace-module-sidebar", () => ({
  WorkspaceModuleSidebar: () => null,
}));
vi.mock("@/components/marketing/marketing-workspace-nav", () => ({ MarketingSidebar: () => null }));
vi.mock("@/components/procurement/procurement-workspace-nav", () => ({
  ProcurementSidebar: () => null,
}));
vi.mock("@/components/projects/projects-workspace-nav", () => ({ ProjectsSidebar: () => null }));
vi.mock("@/components/service/service-workspace-nav", () => ({ ServiceSidebar: () => null }));

import { resolveShellSidebarKey } from "@/components/layout/module-sidebar-registry";
import { WORKSPACE_SIDEBARS } from "@/config/workspace-sidebars";

describe("resolveShellSidebarKey", () => {
  it("gives every standalone module workspace a left sidebar", () => {
    for (const root of ["/crm", "/finance", "/documents", "/assets", "/procurement"]) {
      expect(resolveShellSidebarKey({ pathname: `${root}/x`, standalone: true })).toBe(root);
    }
    expect(resolveShellSidebarKey({ pathname: "/finance", standalone: true })).toBe("/finance");
  });

  it("uses the global rail on platform routes (HRMS UI removed from this ERP)", () => {
    expect(resolveShellSidebarKey({ pathname: "/hr/leave", standalone: true })).toBeNull();
    expect(resolveShellSidebarKey({ pathname: "/organization", standalone: false })).toBe("app");
  });

  it("hides the rail in focus modes and for unregistered workspaces", () => {
    expect(
      resolveShellSidebarKey({
        pathname: "/assets/information-portal/1",
        standalone: true,
        hideSidebar: true,
      }),
    ).toBeNull();
    expect(resolveShellSidebarKey({ pathname: "/unknown", standalone: true })).toBeNull();
  });

  it("has one config per workspace root with unique item hrefs", () => {
    const roots = WORKSPACE_SIDEBARS.map((c) => c.root);
    expect(new Set(roots).size).toBe(roots.length);
    for (const config of WORKSPACE_SIDEBARS) {
      const hrefs = config.items.map((i) => i.href);
      expect(new Set(hrefs).size).toBe(hrefs.length);
      expect(hrefs[0]).toBe(config.root);
    }
  });
});
