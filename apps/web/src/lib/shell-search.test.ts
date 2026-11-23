import { describe, expect, it } from "vitest";

import { filterShellHits, modulePaneCatalog, resolveShellSearchScope } from "@/lib/shell-search";

describe("shell-search", () => {
  it("searches HRMS panes on HR routes", () => {
    const scope = resolveShellSearchScope("/hr/leave");
    expect(scope.mode).toBe("panes");
    if (scope.mode !== "panes") return;
    expect(scope.placeholder).toBe("Search HRMS…");
    expect(scope.panes.some((pane) => pane.href === "/hr" || pane.href.startsWith("/hr"))).toBe(true);
  });

  it("uses HRMS search outside leftover module paths", () => {
    const scope = resolveShellSearchScope("/finance/journals");
    expect(scope.mode).toBe("panes");
    if (scope.mode !== "panes") return;
    expect(scope.moduleTitle).toBe("HRMS");
  });

  it("falls back to the HR home catalog on /home", () => {
    expect(resolveShellSearchScope("/home")).toEqual({
      mode: "home",
      placeholder: "Search HRMS…",
    });
  });

  it("filters HR pane hits by title", () => {
    const catalog = modulePaneCatalog("/hr");
    const hits = filterShellHits(catalog.panes, "superadmin");
    expect(hits.some((hit) => hit.href === "/hr/superadmin")).toBe(true);
  });
});
