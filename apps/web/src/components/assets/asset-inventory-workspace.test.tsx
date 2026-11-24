/** @vitest-environment jsdom */

import type { ComponentProps } from "react";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/services/assets-service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/assets-service")>();
  return {
    ...actual,
    dcChallanService: {
      ...actual.dcChallanService,
      search: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, page_size: 25 }),
    },
  };
});

import { AssetInventoryWorkspace } from "@/components/assets/asset-inventory-workspace";
import { EMPTY_INVENTORY_FILTERS } from "@/components/assets/shared";
import { BRANCH_ALL_VALUE } from "@/components/assets/shared";

const sampleRow = {
  id: "1",
  assetTag: "AST-1",
  laptopName: "Laptop",
  serialNumber: "SN-1",
  manufacturer: "Dell",
  model: "XPS",
  configuration: "i7 16/512GB",
  chargerCode: "CHG-001",
  currentHolder: "Rohan Mehta",
  employeeId: "EMP-002",
  department: "IT",
  branch: "Noida",
  operationalStatus: "READY_TO_MOVE",
  lifecycleStatus: "active",
  issueDate: "—",
  location: "Noida",
  expandable: {
    earlierUsedBy: "—",
    deliveryChallan: "—",
    deliveryReferenceStatus: "—",
    phoneNumber: "—",
    remarks: "—",
    assignmentRemarks: "—",
    returnRemarks: "—",
    accessories: [{ typeLabel: "Charger", serialDisplay: "CHG-001" }],
  },
  assignmentHistory: [],
};

function renderWorkspace(overrides: Partial<ComponentProps<typeof AssetInventoryWorkspace>> = {}) {
  return render(
    <AssetInventoryWorkspace
      preset="all"
      onPresetChange={vi.fn()}
      headerLocationId={BRANCH_ALL_VALUE}
      onHeaderLocationChange={vi.fn()}
      siteLocations={[
        { id: "loc-mumbai", label: "Mumbai" },
        { id: "loc-delhi", label: "New Delhi" },
      ]}
      branches={[{ id: "b1", label: "Head Office" }]}
      quickSearch=""
      onQuickSearchChange={vi.fn()}
      onQuickSearchSubmit={vi.fn()}
      draftFilters={EMPTY_INVENTORY_FILTERS}
      onDraftFiltersChange={vi.fn()}
      onApplyFilters={vi.fn()}
      onResetFilters={vi.fn()}
      categories={[]}
      departments={[]}
      locations={[]}
      rows={[sampleRow]}
      total={1}
      page={1}
      pageSize={25}
      onPageChange={vi.fn()}
      loading={false}
      {...overrides}
    />,
  );
}

afterEach(() => cleanup());

describe("AssetInventoryWorkspace", () => {
  it("renders header and search without status preset pills", () => {
    renderWorkspace();
    expect(screen.getByRole("heading", { level: 1, name: "All Assets" })).toBeInTheDocument();
    expect(
      screen.queryByText("Search, filter, and manage the enterprise IT asset register."),
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId("inventory-status-filter")).not.toBeInTheDocument();
    expect(screen.getByTestId("inventory-search-filter-row")).toBeInTheDocument();
    expect(screen.queryByTestId("inventory-filters-trigger")).not.toBeInTheDocument();
  });

  it("shows table row on desktop without Asset Code column", () => {
    renderWorkspace();
    const table = screen.getByTestId("inventory-table");
    expect(within(table).queryByRole("columnheader", { name: "Asset Code" })).not.toBeInTheDocument();
    expect(within(table).getByRole("columnheader", { name: "Configuration" })).toBeInTheDocument();
    expect(within(table).getByRole("columnheader", { name: "Charger" })).toBeInTheDocument();
    expect(within(table).getByText("Laptop")).toBeInTheDocument();
    expect(within(table).queryByText("AST-1")).not.toBeInTheDocument();
  });

  it("renders Configuration in compact IT style and separate Charger code", () => {
    renderWorkspace();
    const table = screen.getByTestId("inventory-table");
    const config = within(table).getByTestId("inventory-configuration-cell");
    expect(config).toHaveTextContent("i7 16/512GB");
    expect(config).not.toHaveTextContent("Processor:");
    expect(config).not.toHaveTextContent("CHG-001");

    const charger = within(table).getByTestId("inventory-charger-cell");
    expect(charger).toHaveTextContent("CHG-001");
    expect(charger.textContent).toBe("CHG-001");
  });

  it("shows an em dash in Charger when no charger code", () => {
    renderWorkspace({
      rows: [
        {
          ...sampleRow,
          id: "2",
          chargerCode: "",
          expandable: { ...sampleRow.expandable, accessories: [] },
        },
      ],
    });
    const charger = screen.getByTestId("inventory-charger-cell");
    expect(charger.textContent).toBe("—");
  });

  it("shows the actual employee name in Assignee", () => {
    renderWorkspace();
    const assignee = screen.getByTestId("inventory-assignee-cell");
    expect(assignee).toHaveTextContent("Rohan Mehta");
    expect(assignee).not.toHaveTextContent("Assigned");
  });

  it("shows an em dash in Assignee when the asset has no holder", () => {
    renderWorkspace({
      rows: [
        {
          ...sampleRow,
          id: "3",
          currentHolder: "",
          employeeId: "—",
        },
      ],
    });
    expect(screen.getByTestId("inventory-assignee-cell").textContent).toBe("—");
  });

  it("renders action menu in table", () => {
    renderWorkspace();
    const table = screen.getByTestId("inventory-table");
    expect(within(table).queryByRole("button", { name: /^View$/ })).not.toBeInTheDocument();
    expect(within(table).getByRole("button", { name: "More actions" })).toBeInTheDocument();
  });

  it("does not offer View Details or QR Code in the row menu", async () => {
    const user = userEvent.setup();
    renderWorkspace();
    const table = screen.getByTestId("inventory-table");
    await user.click(within(table).getByRole("button", { name: "More actions" }));
    expect(screen.queryByRole("menuitem", { name: "View Details" })).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "QR Code" })).not.toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Edit" })).toBeInTheDocument();
  });

  it("opens drawer when drawerOpen", () => {
    renderWorkspace({
      drawerOpen: true,
      drawerRow: sampleRow,
      drawerData: {
        assetTag: sampleRow.assetTag,
        laptopName: sampleRow.laptopName,
        currentHolder: sampleRow.currentHolder,
        configuration: sampleRow.configuration,
        branch: sampleRow.branch,
        operationalStatus: sampleRow.operationalStatus,
        lifecycleStatus: sampleRow.lifecycleStatus,
      },
    });
    expect(screen.getByTestId("asset-detail-drawer")).toBeInTheDocument();
  });

  it("shows loading skeleton in table", () => {
    renderWorkspace({ loading: true, rows: [] });
    const table = screen.getByTestId("inventory-table");
    expect(within(table).getByLabelText("Loading table")).toBeInTheDocument();
  });

  it("shows empty state copy for ready preset", () => {
    renderWorkspace({ preset: "ready", rows: [] });
    const table = screen.getByTestId("inventory-table");
    expect(within(table).getByText("No ready assets")).toBeInTheDocument();
  });

  it("does not expose status preset pills for onPresetChange", () => {
    const onPresetChange = vi.fn();
    renderWorkspace({ onPresetChange });
    expect(screen.queryByTestId("inventory-status-filter")).not.toBeInTheDocument();
    expect(onPresetChange).not.toHaveBeenCalled();
  });

  it("does not render an inline row-expand control", () => {
    renderWorkspace();
    expect(screen.queryByRole("button", { name: "Expand row" })).not.toBeInTheDocument();
  });

  it("renders mobile cards container", () => {
    renderWorkspace();
    expect(screen.getByTestId("inventory-mobile-cards")).toBeInTheDocument();
  });

  it("shows error card", () => {
    renderWorkspace({ errorMessage: "Failed", onRetry: vi.fn() });
    expect(screen.getByTestId("inventory-error-card")).toBeInTheDocument();
  });

  it("pagination disables previous on page 1", () => {
    renderWorkspace({ page: 1 });
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
  });

  it("submits search from the typeahead on Enter", async () => {
    const user = userEvent.setup();
    const onQuickSearchSubmit = vi.fn();
    renderWorkspace({ onQuickSearchSubmit, quickSearch: "tag" });
    await user.type(screen.getByRole("combobox", { name: "Search assets" }), "{Enter}");
    expect(onQuickSearchSubmit).toHaveBeenCalled();
  });

  it("does not render the removed advanced filters popover", () => {
    renderWorkspace();
    expect(screen.queryByTestId("inventory-filters-trigger")).not.toBeInTheDocument();
    expect(screen.queryByText("Lifecycle status")).not.toBeInTheDocument();
    expect(screen.queryByText("All departments")).not.toBeInTheDocument();
  });

  it("shows dismissible chips for applied search only", () => {
    renderWorkspace({
      appliedFilters: { ...EMPTY_INVENTORY_FILTERS, search: "mac", branchId: "b1" },
      onDismissFilter: vi.fn(),
    });
    expect(screen.getByTestId("inventory-active-filter-chips")).toHaveTextContent("Search: mac");
    expect(screen.getByTestId("inventory-active-filter-chips")).not.toHaveTextContent("Branch:");
  });

  it("renders export toolbar when handlers provided", async () => {
    const user = userEvent.setup();
    const onExportExcel = vi.fn();
    renderWorkspace({ onExportExcel, onExportCsv: vi.fn() });
    expect(screen.getByTestId("inventory-export-toolbar")).toBeInTheDocument();
    await user.click(screen.getByTestId("inventory-export-trigger"));
    await user.click(screen.getByTestId("inventory-export-xlsx"));
    expect(onExportExcel).toHaveBeenCalledOnce();
  });
});
