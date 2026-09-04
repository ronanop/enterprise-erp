/** @vitest-environment jsdom */

import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AssetDetailDrawer } from "@/components/assets/inventory/interaction/asset-detail-drawer";
import { InventoryActionMenu } from "@/components/assets/inventory/interaction/inventory-action-menu";
import { AssignmentSection } from "@/components/assets/inventory/interaction/drawer-sections/assignment-section";
import { ConfigurationSection } from "@/components/assets/inventory/interaction/drawer-sections/configuration-section";
import { QuickLinksSection } from "@/components/assets/inventory/interaction/drawer-sections/quick-links-section";
import { SummarySection } from "@/components/assets/inventory/interaction/drawer-sections/summary-section";
import { mapInventoryRowToDrawerData } from "@/components/assets/inventory/interaction/inventory-drawer.mapper";

const blobMock = vi.fn();

vi.mock("@/services/assets-service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/assets-service")>();
  return {
    ...actual,
    dcChallanService: {
      ...actual.dcChallanService,
      getDocumentBlob: (...args: unknown[]) => blobMock(...args),
    },
  };
});

const drawerData = {
  assetTag: "AST-1",
  laptopName: "ThinkPad",
  currentHolder: "Asha Nair",
  configuration: "i7 · 16GB",
  branch: "Noida",
  operationalStatus: "ASSIGNED",
  lifecycleStatus: "active",
  registerGroups: {
    assignee: "Asha Nair",
    employeeId: "EMP-001",
    phone: "9123456789",
    issuedDate: "Aug 1, 2026",
    earlierUsedBy: "—",
    make: "Lenovo",
    model: "T14",
    configuration: "i7 · 16GB",
    branch: "Noida",
    location: "Floor 2",
    operationalStatus: "ASSIGNED",
    lifecycleStatus: "active",
    accessories: [],
    dcNumber: "—",
    dcStatus: "—",
    dcSignature: "Not Signed",
    assignmentRemarks: "—",
    returnRemarks: "—",
  },
  assignment: { employee: "Asha Nair", issueDate: "Aug 1, 2026", department: "IT" },
  additional: {
    earlierUsedBy: "—",
    deliveryChallan: "—",
    deliveryReferenceStatus: "—",
    remarks: "—",
    assignmentRemarks: "—",
    returnRemarks: "—",
  },
};

afterEach(() => {
  cleanup();
  blobMock.mockReset();
});

const testAsset = { id: "asset-1", assetTag: "AST-1" };

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

  it("opens more menu and lists permitted actions", async () => {
    const user = userEvent.setup();
    render(<InventoryActionMenu asset={testAsset} onMenuAction={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "More actions" }));
    expect(screen.getByRole("menu")).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Assign Asset" })).toBeInTheDocument();
  });

  it("hides assign when permission false", async () => {
    const user = userEvent.setup();
    render(
      <InventoryActionMenu
        asset={testAsset}
        permissions={{ assign: false }}
        onMenuAction={vi.fn()}
      />,
    );
    await user.click(screen.getByRole("button", { name: "More actions" }));
    expect(screen.queryByRole("menuitem", { name: "Assign Asset" })).not.toBeInTheDocument();
  });

  it("fires onMenuAction for menu item", async () => {
    const user = userEvent.setup();
    const onMenuAction = vi.fn();
    render(<InventoryActionMenu asset={testAsset} onMenuAction={onMenuAction} />);
    await user.click(screen.getByRole("button", { name: "More actions" }));
    await user.click(screen.getByRole("menuitem", { name: "QR Code" }));
    expect(onMenuAction).toHaveBeenCalledWith("qr", testAsset);
  });

  it("hides more button when all overflow permissions false", () => {
    render(
      <InventoryActionMenu
        asset={testAsset}
        permissions={{
          assign: false,
          return: false,
          portal: false,
          discovery: false,
          qr: false,
          transfer: false,
          maintenance: false,
          startDisposal: false,
          reinstate: false,
          history: false,
        }}
      />,
    );
    expect(screen.queryByRole("button", { name: "More actions" })).not.toBeInTheDocument();
  });
});

describe("AssetDetailDrawer", () => {
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

  it("renders all sections with data", () => {
    render(<AssetDetailDrawer open onOpenChange={vi.fn()} data={drawerData} />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Overview")).toBeInTheDocument();
    expect(screen.getByText("Assignment")).toBeInTheDocument();
    expect(screen.getByText("IT Information")).toBeInTheDocument();
    expect(screen.getByText("Location")).toBeInTheDocument();
    expect(screen.getByText("Delivery Challan")).toBeInTheDocument();
    expect(screen.getByText("Assignment history")).toBeInTheDocument();
    expect(screen.getByText("Quick links")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "ThinkPad" })).toBeInTheDocument();
    expect(screen.getByTestId("inventory-expandable-assignee").textContent).toBe("Asha Nair");
  });

  it("renders Create DC Challan in the drawer header when eligible", () => {
    render(
      <AssetDetailDrawer
        open
        onOpenChange={vi.fn()}
        data={drawerData}
        onCreateDcChallan={vi.fn()}
      />,
    );
    expect(screen.getAllByRole("button", { name: "Create DC Challan" }).length).toBeGreaterThan(0);
  });

  it("shows a quiet empty DC state when no challan is linked", () => {
    render(
      <AssetDetailDrawer
        open
        onOpenChange={vi.fn()}
        data={drawerData}
        dcChallan={null}
        onCreateDcChallan={vi.fn()}
      />,
    );
    expect(screen.getByText("No delivery challan for this asset.")).toBeInTheDocument();
  });

  it("opens the shared document preview from View", async () => {
    blobMock.mockResolvedValue({
      kind: "file",
      blob: new Blob(["%PDF"], { type: "application/pdf" }),
      contentType: "application/pdf",
      filename: "issued.pdf",
    });
    URL.createObjectURL = vi.fn(() => "blob:inventory-dc");
    URL.revokeObjectURL = vi.fn();
    const user = userEvent.setup();
    render(
      <AssetDetailDrawer
        open
        onOpenChange={vi.fn()}
        data={drawerData}
        dcChallan={{
          id: "dc-9",
          dc_number: "DC-2026-000099",
          asset_id: "a1",
          status: "SIGNED",
          company_id: "c1",
          branch_id: "b1",
          version: 1,
          scm_issued_document: {
            doc_kind: "SCM_ISSUED",
            original_filename: "issued.pdf",
            content_type: "application/pdf",
            has_stored_file: true,
          },
        }}
      />,
    );
    await user.click(screen.getAllByRole("button", { name: "View" })[0]!);
    const modal = await screen.findByTestId("dc-document-preview-modal");
    expect(modal).toBeInTheDocument();
    expect(modal).toHaveTextContent("DC-2026-000099");
    expect(modal).toHaveTextContent("issued.pdf");
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
    expect(screen.getByText("Ready to Move")).toBeInTheDocument();
    expect(screen.getByText("Operational Status")).toBeInTheDocument();
    expect(screen.getByText("Lifecycle Status")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
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
});

describe("QuickLinksSection", () => {
  it("disables buttons without handler", () => {
    render(<QuickLinksSection />);
    const portal = screen.getByRole("button", { name: "Portal" });
    expect(portal).toBeDisabled();
  });

  it("calls handler when enabled", async () => {
    const user = userEvent.setup();
    const onQuickLink = vi.fn();
    render(
      <AssetDetailDrawer
        open
        onOpenChange={vi.fn()}
        asset={testAsset}
        data={drawerData}
        onQuickLink={onQuickLink}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Discovery" }));
    expect(onQuickLink).toHaveBeenCalledWith("discovery", testAsset);
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
  it("maps row to drawer payload", () => {
    const data = mapInventoryRowToDrawerData({
      id: "1",
      assetTag: "AST-9",
      laptopName: "Mac",
      serialNumber: "SN-1",
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
    });
    expect(data.laptopName).toBe("Mac");
    expect(data.additional?.remarks).toBe("note");
  });
});
