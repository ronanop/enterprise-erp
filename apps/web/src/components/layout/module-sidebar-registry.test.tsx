import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/hr/hr-sidebar", () => ({ HrSidebar: () => null }));

import { resolveShellSidebarKey } from "@/components/layout/module-sidebar-registry";

describe("resolveShellSidebarKey", () => {
  it("uses the HR rail on every signed-in app path", () => {
    for (const pathname of ["/hr", "/hr/leave", "/hr/superadmin", "/organization", "/crm/x", "/home"]) {
      expect(resolveShellSidebarKey({ pathname, standalone: true })).toBe("hr");
      expect(resolveShellSidebarKey({ pathname, standalone: false })).toBe("hr");
    }
  });

  it("hides the rail in focus modes", () => {
    expect(
      resolveShellSidebarKey({
        pathname: "/hr",
        standalone: true,
        hideSidebar: true,
      }),
    ).toBeNull();
  });
});
