/** @vitest-environment jsdom */

import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AssetDetailDrawer } from "@/components/assets/inventory/interaction/asset-detail-drawer";
import { InventoryActionMenu } from "@/components/assets/inventory/interaction/inventory-action-menu";
import { AssignmentSection } from "@/components/assets/inventory/interaction/drawer-sections/assignment-section";
import { ConfigurationSection } from "@/components/assets/inventory/interaction/drawer-sections/configuration-section";
import { DocumentsSection } from "@/components/assets/inventory/interaction/drawer-sections/documents-section";
import { DrawerActionBar } from "@/components/assets/inventory/interaction/drawer-sections/drawer-action-bar";
import { DrawerWorkspaceTabs } from "@/components/assets/inventory/interaction/drawer-sections/drawer-workspace-tabs";
import { QuickLinksSection } from "@/components/assets/inventory/interaction/drawer-sections/quick-links-section";
import { SummarySection } from "@/components/assets/inventory/interaction/drawer-sections/summary-section";
import { TimelineSection } from "@/components/assets/inventory/interaction/drawer-sections/timeline-section";
import {
  buildDrawerTimeline,
  mapInventoryRowToDrawerData,
  parseConfigurationParts,
} from "@/components/assets/inventory/interaction/inventory-drawer.mapper";
import type { AssetDetailDrawerData } from "@/components/assets/inventory/interaction/inventory-interaction.types";
import type { InventoryRowViewModel } from "@/components/assets/inventory.mapper";

const drawerData: AssetDetailDrawerData = {
  assetTag: "AST-1",
  laptopName: "ThinkPad",
  manufacturer: "Lenovo",
  model: "T14",
  currentHolder: "Asha Nair",
  department: "IT",
  employeeId: "E-1",
  location: "Noida HQ",
  configuration: "i7 · 16GB · Windows",
  configurationParts: {
    cpu: "i7",
    ram: "16GB",
    storage: "—",
    os: "Windows",
    accessories: "—",
  },
  branch: "Noida",
  operationalStatus: "ASSIGNED",
  lifecycleStatus: "active",
  qrValue: "/assets/information-portal/asset-1",
  assignment: { employee: "Asha Nair", issueDate: "Aug 1, 2026", department: "IT" },
  additional: {
    earlierUsedBy: "—",
    deliveryChallan: "—",
    deliveryReferenceStatus: "—",
    remarks: "—",
    assignmentRemarks: "—",
    returnRemarks: "—",
  },
  history: [
    {
      id: "h1",
      documentNumber: "ASN-1",
      status: "active",
      assigneeLabel: "Asha Nair",
      allocatedAt: "Aug 1, 2026",
      returnedAt: "—",
      deliveryReferenceNumber: "—",
      deliveryReferenceStatus: "—",
      assignmentRemarks: "—",
      returnRemarks: "—",
    },
  ],
  timeline: [
    { id: "registered", label: "Registered", at: "—", kind: "milestone" },
    { id: "assigned-h1", label: "Assigned", at: "Aug 1, 2026", kind: "assigned" },
  ],
};

afterEach(() => cleanup());

const testAsset = { id: "asset-1", assetTag: "AST-1", operationalStatus: "ASSIGNED" };
const readyAsset = { id: "asset-2", assetTag: "AST-2", operationalStatus: "READY_TO_MOVE" };

async function selectDrawerTab(user: ReturnType<typeof userEvent.setup>, label: string) {
  const tabs = screen.getByTestId("drawer-workspace-tabs");
  await user.click(within(tabs).getByRole("tab", { name: label }));
}

describe("InventoryActionMenu", () => {
  it("renders View when viewDetails permitted", () => {
    render(<InventoryActionMenu asset={testAsset} onView={vi.fn()} />);
    expect(screen.getByRole("button", { name: /View/ })).toBeInTheDocument();
  });

  it("hides View when viewDetails false", () => {
    render(<InventoryActionMenu asset={testAsset} permissions={{ viewDetails: false }} />);
    expect(screen.queryByRole("button", { name: /View/ })).not.toBeInTheDocument();
  });

  it("calls onView when View clicked", async () => {
    const user = userEvent.setup();
    const onView = vi.fn();
    render(<InventoryActionMenu asset={testAsset} onView={onView} />);
    await user.click(screen.getByRole("button", { name: /View/ }));
    expect(onView).toHaveBeenCalledWith(testAsset);
  });

  it("opens more menu and lists Assigned actions", async () => {
    const user = userEvent.setup();
    render(<InventoryActionMenu asset={testAsset} onMenuAction={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "More actions" }));
    expect(screen.getByRole("menu")).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Return Asset" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "View History" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Allocate Asset" })).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Edit" })).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Delete" })).not.toBeInTheDocument();
  });

  it("lists Ready actions including Allocate", async () => {
    const user = userEvent.setup();
    render(<InventoryActionMenu asset={readyAsset} onMenuAction={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "More actions" }));
    expect(screen.getByRole("menuitem", { name: "Allocate Asset" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Edit" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Delete" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Return Asset" })).not.toBeInTheDocument();
  });

  it("hides return when permission false", async () => {
    const user = userEvent.setup();
    render(
      <InventoryActionMenu
        asset={testAsset}
        permissions={{ return: false }}
        onMenuAction={vi.fn()}
      />,
    );
    await user.click(screen.getByRole("button", { name: "More actions" }));
    expect(screen.queryByRole("menuitem", { name: "Return Asset" })).not.toBeInTheDocument();
  });

  it("fires onMenuAction for menu item", async () => {
    const user = userEvent.setup();
    const onMenuAction = vi.fn();
    render(<InventoryActionMenu asset={testAsset} onMenuAction={onMenuAction} />);
    await user.click(screen.getByRole("button", { name: "More actions" }));
    await user.click(screen.getByRole("menuitem", { name: "Return Asset" }));
    expect(onMenuAction).toHaveBeenCalledWith("return", testAsset);
  });

  it("hides more button when overflow actions denied by permission", () => {
    render(
      <InventoryActionMenu
        asset={testAsset}
        permissions={{
          edit: false,
          assign: false,
          return: false,
          delete: false,
          dispose: false,
          history: false,
        }}
      />,
    );
    expect(screen.queryByRole("button", { name: "More actions" })).not.toBeInTheDocument();
  });

  it("shows empty text when no actions available", () => {
    render(
      <InventoryActionMenu
        asset={testAsset}
        permissions={{
          viewDetails: false,
          edit: false,
          assign: false,
          return: false,
          delete: false,
          dispose: false,
          history: false,
        }}
      />,
    );
    expect(screen.getByTestId("inventory-action-empty")).toHaveTextContent("No actions available");
  });
});

describe("AssetDetailDrawer workspace", () => {
  it("does not render when closed", () => {
    render(<AssetDetailDrawer open={false} onOpenChange={vi.fn()} data={drawerData} />);
    expect(screen.queryByTestId("asset-detail-drawer")).not.toBeInTheDocument();
  });

  it("shows skeleton when loading", () => {
    render(<AssetDetailDrawer open onOpenChange={vi.fn()} loading />);
    expect(screen.getByTestId("asset-detail-drawer-skeleton")).toBeInTheDocument();
  });

  it("shows empty state without data", () => {
    render(<AssetDetailDrawer open onOpenChange={vi.fn()} loading={false} data={null} />);
    expect(screen.getByText("No asset selected")).toBeInTheDocument();
  });

  it("renders workspace header with QR and barcode", () => {
    render(<AssetDetailDrawer open onOpenChange={vi.fn()} data={drawerData} />);
    expect(screen.getByTestId("drawer-workspace-header")).toBeInTheDocument();
    expect(screen.getByTestId("drawer-qr-code")).toBeInTheDocument();
    expect(screen.getByTestId("drawer-barcode")).toBeInTheDocument();
    expect(screen.getByTestId("drawer-asset-image")).toBeInTheDocument();
    expect(screen.getByTestId("drawer-header-asset-tag")).toHaveTextContent("AST-1");
    expect(screen.getByRole("heading", { name: "ThinkPad" })).toBeInTheDocument();
  });

  it("renders six workspace tabs", () => {
    render(<AssetDetailDrawer open onOpenChange={vi.fn()} data={drawerData} />);
    const tabs = screen.getByTestId("drawer-workspace-tabs");
    expect(within(tabs).getAllByRole("tab")).toHaveLength(6);
  });

  it("defaults to Overview tab content", () => {
    render(<AssetDetailDrawer open onOpenChange={vi.fn()} data={drawerData} />);
    expect(screen.getByTestId("drawer-tab-panel-overview")).toBeInTheDocument();
    expect(screen.getByText("Asset summary")).toBeInTheDocument();
    expect(screen.getByText("Purchase information")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Current holder" })).toBeInTheDocument();
    expect(screen.queryByText("Warranty")).not.toBeInTheDocument();
  });

  it("switches to Configuration tab", async () => {
    const user = userEvent.setup();
    render(<AssetDetailDrawer open onOpenChange={vi.fn()} data={drawerData} />);
    await selectDrawerTab(user, "Configuration");
    expect(screen.getByTestId("drawer-configuration-section")).toBeInTheDocument();
    expect(screen.getByTestId("drawer-config-cpu")).toHaveTextContent("i7");
    expect(screen.getByTestId("drawer-config-ram")).toHaveTextContent("16GB");
  });

  it("switches to Assignment tab", async () => {
    const user = userEvent.setup();
    render(<AssetDetailDrawer open onOpenChange={vi.fn()} data={drawerData} />);
    await selectDrawerTab(user, "Assignment");
    expect(screen.getByTestId("drawer-assignment-employee")).toHaveTextContent("Asha Nair");
  });

  it("switches to History tab", async () => {
    const user = userEvent.setup();
    render(<AssetDetailDrawer open onOpenChange={vi.fn()} data={drawerData} />);
    await selectDrawerTab(user, "History");
    expect(screen.getByText("Assignment history")).toBeInTheDocument();
    expect(screen.getByText("ASN-1")).toBeInTheDocument();
  });

  it("switches to Timeline tab", async () => {
    const user = userEvent.setup();
    render(<AssetDetailDrawer open onOpenChange={vi.fn()} data={drawerData} />);
    await selectDrawerTab(user, "Timeline");
    expect(screen.getByTestId("drawer-timeline-section")).toBeInTheDocument();
    expect(screen.getAllByTestId("drawer-timeline-event").length).toBeGreaterThan(0);
  });

  it("switches to Documents tab with QR and barcode", async () => {
    const user = userEvent.setup();
    render(<AssetDetailDrawer open onOpenChange={vi.fn()} data={drawerData} asset={testAsset} />);
    await selectDrawerTab(user, "Documents");
    expect(screen.getByTestId("drawer-documents-section")).toBeInTheDocument();
    expect(screen.getByTestId("drawer-documents-qr")).toBeInTheDocument();
    expect(screen.getByTestId("drawer-documents-barcode")).toBeInTheDocument();
  });

  it("renders bottom action bar", () => {
    render(
      <AssetDetailDrawer
        open
        onOpenChange={vi.fn()}
        data={drawerData}
        asset={testAsset}
        onAction={vi.fn()}
      />,
    );
    const bar = screen.getByTestId("drawer-action-bar");
    expect(within(bar).getByRole("button", { name: "Return Asset" })).toBeInTheDocument();
    expect(within(bar).queryByRole("button", { name: "Allocate Asset" })).not.toBeInTheDocument();
  });

  it("invokes onAction from bottom bar", async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    render(
      <AssetDetailDrawer
        open
        onOpenChange={vi.fn()}
        data={drawerData}
        asset={testAsset}
        onAction={onAction}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Return Asset" }));
    expect(onAction).toHaveBeenCalledWith("return", testAsset);
  });

  it("invokes printQr action", async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    render(
      <AssetDetailDrawer
        open
        onOpenChange={vi.fn()}
        data={drawerData}
        asset={testAsset}
        onAction={onAction}
      />,
    );
    await selectDrawerTab(user, "Documents");
    await user.click(screen.getByRole("button", { name: "Open QR workspace" }));
    expect(onAction).toHaveBeenCalledWith("printQr", testAsset);
  });

  it("applies responsive width classes on panel", () => {
    render(<AssetDetailDrawer open onOpenChange={vi.fn()} data={drawerData} />);
    const panel = screen.getByTestId("asset-detail-drawer-panel");
    expect(panel.className).toMatch(/md:w-1\/2/);
    expect(panel.className).toMatch(/xl:w-\[35%\]/);
    expect(panel.className).toMatch(/w-full/);
  });

  it("closes via close button", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<AssetDetailDrawer open onOpenChange={onOpenChange} data={drawerData} />);
    await user.click(screen.getByRole("button", { name: "Close drawer" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("closes via overlay", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<AssetDetailDrawer open onOpenChange={onOpenChange} data={drawerData} />);
    await user.click(screen.getByRole("button", { name: "Close drawer overlay" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("hides Allocate when permission false on Ready asset", () => {
    render(
      <AssetDetailDrawer
        open
        onOpenChange={vi.fn()}
        data={{ ...drawerData, operationalStatus: "READY_TO_MOVE" }}
        asset={readyAsset}
        onAction={vi.fn()}
        actionPermissions={{ assign: false }}
      />,
    );
    expect(screen.queryByRole("button", { name: "Allocate Asset" })).not.toBeInTheDocument();
    expect(screen.getByTestId("drawer-action-empty")).toBeInTheDocument();
  });
});

describe("SummarySection", () => {
  it("renders operational badge", () => {
    render(
      <SummarySection
        assetTag="AST-1"
        laptopName="Laptop"
        currentHolder="—"
        branch="Noida"
        operationalStatus="READY_TO_MOVE"
        lifecycleStatus="active"
      />,
    );
    expect(screen.getByText("Ready to move")).toBeInTheDocument();
  });
});

describe("AssignmentSection", () => {
  it("shows empty assignment state", () => {
    render(<AssignmentSection assignment={{ employee: "—", issueDate: "—", department: "—" }} />);
    expect(screen.getByText("No active assignment")).toBeInTheDocument();
  });

  it("shows assignment fields", () => {
    render(
      <AssignmentSection
        assignment={{ employee: "Asha", issueDate: "Today", department: "IT" }}
      />,
    );
    expect(screen.getByText("Asha")).toBeInTheDocument();
  });
});

describe("ConfigurationSection", () => {
  it("shows empty configuration", () => {
    render(<ConfigurationSection configuration="—" />);
    expect(screen.getByText("No configuration on file")).toBeInTheDocument();
  });

  it("shows parsed configuration parts", () => {
    render(
      <ConfigurationSection
        configuration="i7 · 16GB"
        parts={{ cpu: "i7", ram: "16GB", storage: "—", os: "—", accessories: "—" }}
      />,
    );
    expect(screen.getByTestId("drawer-config-cpu")).toHaveTextContent("i7");
  });
});

describe("TimelineSection", () => {
  it("shows empty timeline", () => {
    render(<TimelineSection events={[]} />);
    expect(screen.getByText("No timeline events")).toBeInTheDocument();
  });

  it("renders timeline events", () => {
    render(
      <TimelineSection
        events={[
          { id: "1", label: "Registered", at: "—", kind: "milestone" },
          { id: "2", label: "Assigned", at: "Aug 1", kind: "assigned" },
        ]}
      />,
    );
    expect(screen.getAllByTestId("drawer-timeline-event")).toHaveLength(2);
  });
});

describe("DocumentsSection", () => {
  it("renders document slots", () => {
    render(<DocumentsSection data={drawerData} />);
    expect(screen.getByTestId("drawer-documents-qr")).toBeInTheDocument();
    expect(screen.getByTestId("drawer-documents-barcode")).toBeInTheDocument();
  });

  it("calls onOpenQr", async () => {
    const user = userEvent.setup();
    const onOpenQr = vi.fn();
    render(<DocumentsSection data={drawerData} onOpenQr={onOpenQr} />);
    await user.click(screen.getByRole("button", { name: "Open QR workspace" }));
    expect(onOpenQr).toHaveBeenCalledOnce();
  });
});

describe("DrawerActionBar", () => {
  it("shows empty state without operational status", () => {
    render(<DrawerActionBar />);
    expect(screen.getByTestId("drawer-action-empty")).toBeInTheDocument();
  });

  it("disables primary action without asset handler", () => {
    render(<DrawerActionBar operationalStatus="READY_TO_MOVE" />);
    expect(screen.getByRole("button", { name: "Allocate Asset" })).toBeDisabled();
  });

  it("fires action callback for Allocate", async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    render(
      <DrawerActionBar
        asset={readyAsset}
        onAction={onAction}
        operationalStatus="READY_TO_MOVE"
      />,
    );
    await user.click(screen.getByRole("button", { name: "Allocate Asset" }));
    expect(onAction).toHaveBeenCalledWith("assign", readyAsset);
  });

  it("shows Allocate Asset for Ready To Move assets", () => {
    render(
      <DrawerActionBar
        asset={readyAsset}
        onAction={vi.fn()}
        operationalStatus="READY_TO_MOVE"
      />,
    );
    expect(screen.getByRole("button", { name: "Allocate Asset" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Return Asset" })).not.toBeInTheDocument();
  });

  it("shows Return Asset for Assigned assets", () => {
    render(
      <DrawerActionBar
        asset={testAsset}
        onAction={vi.fn()}
        operationalStatus="ASSIGNED"
      />,
    );
    expect(screen.getByRole("button", { name: "Return Asset" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Allocate Asset" })).not.toBeInTheDocument();
  });

  it("shows View History for retired assets", () => {
    render(
      <DrawerActionBar
        asset={testAsset}
        onAction={vi.fn()}
        operationalStatus="RETIRED"
      />,
    );
    expect(screen.getByRole("button", { name: "View History" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Allocate Asset" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Return Asset" })).not.toBeInTheDocument();
  });

  it("shows Complete Disposal for pending disposal assets", () => {
    render(
      <DrawerActionBar
        asset={testAsset}
        onAction={vi.fn()}
        operationalStatus="PENDING_DISPOSAL"
      />,
    );
    expect(screen.getByRole("button", { name: "Complete Disposal" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Allocate Asset" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Return Asset" })).not.toBeInTheDocument();
  });

  it("shows View History for disposed assets", () => {
    render(
      <DrawerActionBar
        asset={testAsset}
        onAction={vi.fn()}
        operationalStatus="DISPOSED"
      />,
    );
    expect(screen.getByRole("button", { name: "View History" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Complete Disposal" })).not.toBeInTheDocument();
  });
});

describe("DrawerWorkspaceTabs", () => {
  it("notifies onChange", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<DrawerWorkspaceTabs value="overview" onChange={onChange} />);
    await user.click(screen.getByRole("tab", { name: "History" }));
    expect(onChange).toHaveBeenCalledWith("history");
  });
});

describe("QuickLinksSection", () => {
  it("disables buttons without handler", () => {
    render(<QuickLinksSection />);
    const portal = screen.getByRole("button", { name: "Portal" });
    expect(portal).toBeDisabled();
  });

  it("shows message when no links enabled", () => {
    render(
      <QuickLinksSection
        enabledLinks={{ portal: false, discovery: false, qr: false, history: false }}
      />,
    );
    expect(screen.getByText(/No quick links available/)).toBeInTheDocument();
  });
});

describe("mapInventoryRowToDrawerData", () => {
  const baseRow: InventoryRowViewModel = {
    id: "1",
    assetTag: "AST-9",
    laptopName: "Mac",
    manufacturer: "Apple",
    model: "M3",
    configuration: "16GB",
    currentHolder: "Bob",
    employeeId: "e1",
    department: "IT",
    branch: "Noida",
    operationalStatus: "ASSIGNED",
    lifecycleStatus: "active",
    issueDate: "Aug 1",
    location: "HQ",
    expandable: {
      earlierUsedBy: "—",
      deliveryChallan: "—",
      deliveryReferenceStatus: "—",
      phoneNumber: "—",
      remarks: "note",
      assignmentRemarks: "note",
      returnRemarks: "—",
    },
    assignmentHistory: [],
  };

  it("maps row to drawer payload", () => {
    const data = mapInventoryRowToDrawerData(baseRow);
    expect(data.laptopName).toBe("Mac");
    expect(data.manufacturer).toBe("Apple");
    expect(data.additional?.remarks).toBe("note");
    expect(data.configurationParts.ram).toBe("16GB");
    expect(data.timeline?.length).toBeGreaterThan(0);
    expect(data.qrValue).toContain("/assets/information-portal/1");
  });

  it("builds timeline from history", () => {
    const events = buildDrawerTimeline({
      ...baseRow,
      assignmentHistory: [
        {
          id: "a1",
          documentNumber: "ASN",
          status: "returned",
          assigneeLabel: "Bob",
          allocatedAt: "Jan 1",
          returnedAt: "Feb 1",
          deliveryReferenceNumber: "—",
          deliveryReferenceStatus: "—",
          assignmentRemarks: "—",
          returnRemarks: "—",
        },
      ],
    });
    expect(events.some((e) => e.label === "Assigned")).toBe(true);
    expect(events.some((e) => e.label === "Returned")).toBe(true);
  });
});

describe("parseConfigurationParts", () => {
  it("parses cpu ram os", () => {
    const parts = parseConfigurationParts("i7 · 16GB · Windows 11");
    expect(parts.cpu).toBe("i7");
    expect(parts.ram).toBe("16GB");
    expect(parts.os).toContain("Windows");
  });

  it("returns dashes for empty", () => {
    expect(parseConfigurationParts("—").cpu).toBe("—");
  });
});
