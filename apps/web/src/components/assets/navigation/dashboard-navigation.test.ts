/** @vitest-environment jsdom */

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  dashboardNavigationPaths,
  navigateDashboardKpi,
  navigateDashboardQuickAction,
  navigateDashboardViewAll,
  openInventoryWithPreset,
} from "@/components/assets/navigation/dashboard-navigation";
import {
  clearInventoryUiSnapshot,
  peekInventoryUiSnapshot,
} from "@/components/assets/inventory/inventory-ui-state";
import { BRANCH_ALL_VALUE } from "@/components/assets/shared";

describe("dashboardNavigationPaths", () => {
  it("points at existing asset module routes", () => {
    expect(dashboardNavigationPaths.registerAsset).toBe("/assets/assets/new");
    expect(dashboardNavigationPaths.assignAsset).toBe("/assets/asset-assignments/new");
    expect(dashboardNavigationPaths.returnAsset).toBe("/assets/asset-assignments/return");
    expect(dashboardNavigationPaths.qrBarcode).toBe("/assets/qr-barcode");
    expect(dashboardNavigationPaths.assignments).toBe("/assets/asset-assignments");
    expect(dashboardNavigationPaths.inventory).toBe("/assets/assets");
  });
});

describe("navigateDashboardKpi", () => {
  beforeEach(() => {
    clearInventoryUiSnapshot();
  });

  it("maps each KPI to the matching inventory preset", () => {
    const push = vi.fn();
    const cases = [
      ["total", "all"],
      ["ready", "ready"],
      ["assigned", "assigned"],
      ["inUseAsComponent", "in_use_as_component"],
      ["retired", "retired"],
      ["pendingDisposal", "pending_disposal"],
      ["disposed", "disposed"],
    ] as const;

    for (const [kpi, preset] of cases) {
      clearInventoryUiSnapshot();
      navigateDashboardKpi(push, kpi);
      expect(peekInventoryUiSnapshot()?.preset).toBe(preset);
      expect(push).toHaveBeenCalledWith("/assets/assets");
    }
  });
});

describe("navigateDashboardQuickAction", () => {
  beforeEach(() => {
    clearInventoryUiSnapshot();
  });

  it("navigates register/assign/return/qr to direct routes", () => {
    const push = vi.fn();
    navigateDashboardQuickAction(push, "register");
    navigateDashboardQuickAction(push, "assign");
    navigateDashboardQuickAction(push, "return");
    navigateDashboardQuickAction(push, "qr");
    expect(push.mock.calls.map((c) => c[0])).toEqual([
      "/assets/assets/new",
      "/assets/asset-assignments/new",
      "/assets/asset-assignments/return",
      "/assets/qr-barcode",
    ]);
  });

  it("opens ready inventory for discovery", () => {
    const push = vi.fn();
    navigateDashboardQuickAction(push, "discovery", "branch-1");
    expect(push).toHaveBeenCalledWith("/assets/assets");
    expect(peekInventoryUiSnapshot()?.preset).toBe("ready");
    expect(peekInventoryUiSnapshot()?.headerLocationId).toBe("branch-1");
  });

  it("opens all-assets inventory for information portal", () => {
    const push = vi.fn();
    navigateDashboardQuickAction(push, "informationPortal");
    expect(push).toHaveBeenCalledWith("/assets/assets");
    expect(peekInventoryUiSnapshot()?.preset).toBe("all");
    expect(peekInventoryUiSnapshot()?.headerLocationId).toBe(BRANCH_ALL_VALUE);
  });
});

describe("navigateDashboardViewAll", () => {
  beforeEach(() => {
    clearInventoryUiSnapshot();
  });

  it("opens ready and pending disposal presets", () => {
    const push = vi.fn();
    navigateDashboardViewAll(push, "ready", "b1");
    expect(peekInventoryUiSnapshot()?.preset).toBe("ready");
    navigateDashboardViewAll(push, "pendingDisposal", "b1");
    expect(peekInventoryUiSnapshot()?.preset).toBe("pending_disposal");
    expect(push).toHaveBeenCalledWith("/assets/assets");
  });

  it("opens assignments list", () => {
    const push = vi.fn();
    navigateDashboardViewAll(push, "assignments");
    expect(push).toHaveBeenCalledWith("/assets/asset-assignments");
  });
});

describe("openInventoryWithPreset", () => {
  beforeEach(() => {
    clearInventoryUiSnapshot();
  });

  it("persists snapshot before navigation", () => {
    const push = vi.fn();
    openInventoryWithPreset(push, "disposed", "branch-x");
    const snap = peekInventoryUiSnapshot();
    expect(snap?.preset).toBe("disposed");
    expect(snap?.headerLocationId).toBe("branch-x");
    expect(snap?.page).toBe(1);
    expect(push).toHaveBeenCalledWith("/assets/assets");
  });
});
