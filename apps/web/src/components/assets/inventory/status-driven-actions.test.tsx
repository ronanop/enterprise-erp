/** @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { InventoryActionMenu } from "@/components/assets/inventory/interaction/inventory-action-menu";
import {
  resolveDrawerActionVisibility,
  DrawerActionBar,
} from "@/components/assets/inventory/interaction/drawer-sections/drawer-action-bar";
import {
  STATUS_ACTION_MATRIX,
  getStatusActionCapability,
  isStatusActionAllowed,
  normalizeOperationalStatus,
  resolveDrawerPrimaryAction,
  statusActionEmptyMessage,
  type StatusDrivenActionId,
} from "@/components/assets/inventory/status-driven-actions";
import {
  createAssetNavigation,
  dispatchInventoryMenuAction,
} from "@/components/assets/navigation/asset-navigation";
import { handleInventoryMenuWorkflow } from "@/components/assets/inventory/inventory-workflow";
import { StatusBadge } from "@/components/assets/shared";
import { OPERATIONAL_STATUS_VALUES } from "@/components/assets/shared/asset-status";
import type { InventoryMenuActionId } from "@/components/assets/inventory/interaction/inventory-interaction.types";

afterEach(() => cleanup());

const ACTIONS: StatusDrivenActionId[] = [
  "view",
  "edit",
  "assign",
  "return",
  "delete",
  "history",
  "dispose",
];

const MENU_BY_STATUS: Record<
  string,
  { visible: string[]; hidden: string[] }
> = {
  READY_TO_MOVE: {
    visible: ["Edit", "Allocate Asset", "Delete", "View History"],
    hidden: ["Return Asset", "Complete Disposal"],
  },
  ASSIGNED: {
    visible: ["Return Asset", "View History"],
    hidden: ["Edit", "Allocate Asset", "Delete", "Complete Disposal"],
  },
  RETIRED: {
    visible: ["View History"],
    hidden: ["Edit", "Allocate Asset", "Return Asset", "Delete", "Complete Disposal"],
  },
  PENDING_DISPOSAL: {
    visible: ["Complete Disposal", "View History"],
    hidden: ["Edit", "Allocate Asset", "Return Asset", "Delete"],
  },
  DISPOSED: {
    visible: ["View History"],
    hidden: ["Edit", "Allocate Asset", "Return Asset", "Delete", "Complete Disposal"],
  },
};

describe("CR-006 Task 5 — status action matrix", () => {
  it.each(OPERATIONAL_STATUS_VALUES)("defines capability for %s", (status) => {
    expect(STATUS_ACTION_MATRIX[status]).toBeDefined();
  });

  it.each(OPERATIONAL_STATUS_VALUES)("READY view/history always true for %s", (status) => {
    const cap = getStatusActionCapability(status);
    expect(cap.view).toBe(true);
    expect(cap.history).toBe(true);
  });

  it("READY_TO_MOVE allows view edit assign delete history", () => {
    const cap = getStatusActionCapability("READY_TO_MOVE");
    expect(cap).toEqual({
      view: true,
      edit: true,
      assign: true,
      return: false,
      delete: true,
      history: true,
      dispose: false,
    });
  });

  it("ASSIGNED allows view return history only", () => {
    expect(getStatusActionCapability("ASSIGNED")).toEqual({
      view: true,
      edit: false,
      assign: false,
      return: true,
      delete: false,
      history: true,
      dispose: false,
    });
  });

  it("RETIRED allows view history only", () => {
    expect(getStatusActionCapability("RETIRED")).toEqual({
      view: true,
      edit: false,
      assign: false,
      return: false,
      delete: false,
      history: true,
      dispose: false,
    });
  });

  it("PENDING_DISPOSAL allows view dispose history", () => {
    expect(getStatusActionCapability("PENDING_DISPOSAL")).toEqual({
      view: true,
      edit: false,
      assign: false,
      return: false,
      delete: false,
      history: true,
      dispose: true,
    });
  });

  it("DISPOSED allows view history only", () => {
    expect(getStatusActionCapability("DISPOSED")).toEqual({
      view: true,
      edit: false,
      assign: false,
      return: false,
      delete: false,
      history: true,
      dispose: false,
    });
  });

  it("unknown status only allows view and history", () => {
    expect(getStatusActionCapability("UNKNOWN")).toEqual({
      view: true,
      edit: false,
      assign: false,
      return: false,
      delete: false,
      history: true,
      dispose: false,
    });
  });

  it("null status only allows view and history", () => {
    expect(getStatusActionCapability(null).assign).toBe(false);
    expect(getStatusActionCapability(undefined).view).toBe(true);
  });

  it.each([
    ["ready_to_move", "READY_TO_MOVE"],
    [" ASSIGNED ", "ASSIGNED"],
    ["disposed", "DISPOSED"],
  ] as const)("normalizes %s → %s", (input, expected) => {
    expect(normalizeOperationalStatus(input)).toBe(expected);
  });

  it("normalize returns null for garbage", () => {
    expect(normalizeOperationalStatus("")).toBeNull();
    expect(normalizeOperationalStatus("nope")).toBeNull();
  });
});

describe("CR-006 Task 5 — isStatusActionAllowed", () => {
  it.each(
    OPERATIONAL_STATUS_VALUES.flatMap((status) =>
      ACTIONS.map((action) => [status, action, STATUS_ACTION_MATRIX[status][action]] as const),
    ),
  )("%s → %s = %s", (status, action, expected) => {
    expect(isStatusActionAllowed(status, action)).toBe(expected);
  });

  it("denies assign for Assigned", () => {
    expect(isStatusActionAllowed("ASSIGNED", "assign")).toBe(false);
  });

  it("denies return for Ready", () => {
    expect(isStatusActionAllowed("READY_TO_MOVE", "return")).toBe(false);
  });

  it("denies dispose for Disposed", () => {
    expect(isStatusActionAllowed("DISPOSED", "dispose")).toBe(false);
  });

  it("allows dispose only for Pending Disposal", () => {
    expect(isStatusActionAllowed("PENDING_DISPOSAL", "dispose")).toBe(true);
    expect(isStatusActionAllowed("READY_TO_MOVE", "dispose")).toBe(false);
    expect(isStatusActionAllowed("ASSIGNED", "dispose")).toBe(false);
    expect(isStatusActionAllowed("RETIRED", "dispose")).toBe(false);
  });
});

describe("CR-006 Task 5 — drawer primary actions", () => {
  it("Ready → Allocate Asset", () => {
    expect(resolveDrawerPrimaryAction("READY_TO_MOVE")).toEqual({
      action: "assign",
      label: "Allocate Asset",
    });
  });

  it("Assigned → Return Asset", () => {
    expect(resolveDrawerPrimaryAction("ASSIGNED")).toEqual({
      action: "return",
      label: "Return Asset",
    });
  });

  it("Retired → View History", () => {
    expect(resolveDrawerPrimaryAction("RETIRED")).toEqual({
      action: "history",
      label: "View History",
    });
  });

  it("Pending Disposal → Complete Disposal", () => {
    expect(resolveDrawerPrimaryAction("PENDING_DISPOSAL")).toEqual({
      action: "dispose",
      label: "Complete Disposal",
    });
  });

  it("Disposed → View History", () => {
    expect(resolveDrawerPrimaryAction("DISPOSED")).toEqual({
      action: "history",
      label: "View History",
    });
  });

  it("unknown → null", () => {
    expect(resolveDrawerPrimaryAction("x")).toBeNull();
    expect(resolveDrawerPrimaryAction(null)).toBeNull();
  });

  it("empty message mentions status", () => {
    expect(statusActionEmptyMessage("RETIRED")).toMatch(/RETIRED/i);
    expect(statusActionEmptyMessage(null)).toMatch(/No actions available/);
  });

  it("resolveDrawerActionVisibility mirrors primary", () => {
    expect(resolveDrawerActionVisibility("READY_TO_MOVE")).toEqual({
      showAllocate: true,
      showReturn: false,
      primaryAction: "assign",
    });
    expect(resolveDrawerActionVisibility("ASSIGNED")).toEqual({
      showAllocate: false,
      showReturn: true,
      primaryAction: "return",
    });
    expect(resolveDrawerActionVisibility("PENDING_DISPOSAL").primaryAction).toBe("dispose");
    expect(resolveDrawerActionVisibility("DISPOSED").primaryAction).toBe("history");
  });
});

describe("CR-006 Task 5 — register menu by status", () => {
  it.each(Object.keys(MENU_BY_STATUS))("menu for %s shows allowed labels", async (status) => {
    const user = userEvent.setup();
    const asset = { id: "a1", assetTag: "T-1", operationalStatus: status };
    render(<InventoryActionMenu asset={asset} onMenuAction={vi.fn()} />);
    expect(screen.getByRole("button", { name: /View/ })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "More actions" }));
    for (const label of MENU_BY_STATUS[status]!.visible) {
      expect(screen.getByRole("menuitem", { name: label })).toBeInTheDocument();
    }
    for (const label of MENU_BY_STATUS[status]!.hidden) {
      expect(screen.queryByRole("menuitem", { name: label })).not.toBeInTheDocument();
    }
  });
});

describe("CR-006 Task 5 — drawer action bar UI", () => {
  const asset = { id: "a1", assetTag: "T-1" };

  it("Ready drawer CTA is Allocate", () => {
    render(<DrawerActionBar asset={asset} onAction={vi.fn()} operationalStatus="READY_TO_MOVE" />);
    expect(screen.getByRole("button", { name: "Allocate Asset" })).toBeInTheDocument();
  });

  it("Assigned drawer CTA is Return", () => {
    render(<DrawerActionBar asset={asset} onAction={vi.fn()} operationalStatus="ASSIGNED" />);
    expect(screen.getByRole("button", { name: "Return Asset" })).toBeInTheDocument();
  });

  it("Retired drawer CTA is View History", () => {
    render(<DrawerActionBar asset={asset} onAction={vi.fn()} operationalStatus="RETIRED" />);
    expect(screen.getByRole("button", { name: "View History" })).toBeInTheDocument();
  });

  it("Pending Disposal drawer CTA is Complete Disposal", () => {
    render(
      <DrawerActionBar asset={asset} onAction={vi.fn()} operationalStatus="PENDING_DISPOSAL" />,
    );
    expect(screen.getByRole("button", { name: "Complete Disposal" })).toBeInTheDocument();
  });

  it("Disposed drawer CTA is View History", () => {
    render(<DrawerActionBar asset={asset} onAction={vi.fn()} operationalStatus="DISPOSED" />);
    expect(screen.getByRole("button", { name: "View History" })).toBeInTheDocument();
  });

  it("fires dispose action", async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    render(
      <DrawerActionBar asset={asset} onAction={onAction} operationalStatus="PENDING_DISPOSAL" />,
    );
    await user.click(screen.getByRole("button", { name: "Complete Disposal" }));
    expect(onAction).toHaveBeenCalledWith("dispose", asset);
  });

  it("fires history action", async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    render(<DrawerActionBar asset={asset} onAction={onAction} operationalStatus="RETIRED" />);
    await user.click(screen.getByRole("button", { name: "View History" }));
    expect(onAction).toHaveBeenCalledWith("history", asset);
  });

  it("shows empty when primary permission denied", () => {
    render(
      <DrawerActionBar
        asset={asset}
        onAction={vi.fn()}
        operationalStatus="READY_TO_MOVE"
        permissions={{ assign: false }}
      />,
    );
    expect(screen.getByTestId("drawer-action-empty")).toBeInTheDocument();
  });
});

describe("CR-006 Task 5 — disabled navigation guards", () => {
  const cases: Array<{
    action: InventoryMenuActionId;
    status: string;
    shouldNavigate: boolean;
    spy: "openAssignment" | "openReturn" | "openDisposal" | "openEdit" | "openDelete" | "openHistory";
  }> = [
    { action: "assign", status: "READY_TO_MOVE", shouldNavigate: true, spy: "openAssignment" },
    { action: "assign", status: "ASSIGNED", shouldNavigate: false, spy: "openAssignment" },
    { action: "assign", status: "RETIRED", shouldNavigate: false, spy: "openAssignment" },
    { action: "assign", status: "PENDING_DISPOSAL", shouldNavigate: false, spy: "openAssignment" },
    { action: "assign", status: "DISPOSED", shouldNavigate: false, spy: "openAssignment" },
    { action: "return", status: "ASSIGNED", shouldNavigate: true, spy: "openReturn" },
    { action: "return", status: "READY_TO_MOVE", shouldNavigate: false, spy: "openReturn" },
    { action: "return", status: "RETIRED", shouldNavigate: false, spy: "openReturn" },
    { action: "return", status: "DISPOSED", shouldNavigate: false, spy: "openReturn" },
    { action: "edit", status: "READY_TO_MOVE", shouldNavigate: true, spy: "openEdit" },
    { action: "edit", status: "ASSIGNED", shouldNavigate: false, spy: "openEdit" },
    { action: "delete", status: "READY_TO_MOVE", shouldNavigate: true, spy: "openDelete" },
    { action: "delete", status: "ASSIGNED", shouldNavigate: false, spy: "openDelete" },
    { action: "dispose", status: "PENDING_DISPOSAL", shouldNavigate: true, spy: "openDisposal" },
    { action: "dispose", status: "DISPOSED", shouldNavigate: false, spy: "openDisposal" },
    { action: "dispose", status: "READY_TO_MOVE", shouldNavigate: false, spy: "openDisposal" },
    { action: "history", status: "DISPOSED", shouldNavigate: true, spy: "openHistory" },
    { action: "history", status: "RETIRED", shouldNavigate: true, spy: "openHistory" },
  ];

  it.each(cases)(
    "$action + $status navigates=$shouldNavigate",
    ({ action, status, shouldNavigate, spy }) => {
      const nav = createAssetNavigation(vi.fn());
      const method = vi.spyOn(nav, spy);
      dispatchInventoryMenuAction(nav, action, "asset-x", status);
      if (shouldNavigate) expect(method).toHaveBeenCalledWith("asset-x");
      else expect(method).not.toHaveBeenCalled();
    },
  );

  it("workflow blocks Assigned → Allocate without closing drawer", () => {
    const push = vi.fn();
    const closeDrawer = vi.fn();
    handleInventoryMenuWorkflow({
      action: "assign",
      assetId: "a1",
      navigation: createAssetNavigation(push),
      closeDrawer,
      operationalStatus: "ASSIGNED",
    });
    expect(closeDrawer).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  it("workflow allows Ready → Allocate", () => {
    const push = vi.fn();
    const closeDrawer = vi.fn();
    handleInventoryMenuWorkflow({
      action: "assign",
      assetId: "a1",
      navigation: createAssetNavigation(push),
      closeDrawer,
      operationalStatus: "READY_TO_MOVE",
    });
    expect(closeDrawer).toHaveBeenCalledOnce();
    expect(push).toHaveBeenCalled();
  });
});

describe("CR-006 Task 5 — status badge colors", () => {
  it("Ready uses emerald (green)", () => {
    const { container } = render(<StatusBadge kind="operational" status="READY_TO_MOVE" />);
    expect(container.firstChild).toHaveClass("bg-emerald-50");
  });

  it("Assigned uses blue", () => {
    const { container } = render(<StatusBadge kind="operational" status="ASSIGNED" />);
    expect(container.firstChild).toHaveClass("bg-blue-50");
  });

  it("Retired uses orange", () => {
    const { container } = render(<StatusBadge kind="operational" status="RETIRED" />);
    expect(container.firstChild).toHaveClass("bg-orange-50");
  });

  it("Pending Disposal uses amber", () => {
    const { container } = render(<StatusBadge kind="operational" status="PENDING_DISPOSAL" />);
    expect(container.firstChild).toHaveClass("bg-amber-50");
  });

  it("Disposed uses muted gray", () => {
    const { container } = render(<StatusBadge kind="operational" status="DISPOSED" />);
    expect(container.firstChild).toHaveClass("bg-muted");
  });
});
