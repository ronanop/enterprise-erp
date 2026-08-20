/** @vitest-environment jsdom */

import type { ComponentProps } from "react";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AssetInventoryWorkspace } from "@/components/assets/asset-inventory-workspace";
import { EMPTY_INVENTORY_FILTERS } from "@/components/assets/shared";
import { BRANCH_ALL_VALUE } from "@/components/assets/shared";

const sampleRow = {
  id: "1",
  assetTag: "AST-1",
  laptopName: "Laptop",
  manufacturer: "Dell",
  model: "XPS",
  configuration: "i7 · 16GB",
  currentHolder: "—",
  employeeId: "—",
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
  },
  assignmentHistory: [],
};

function renderWorkspace(overrides: Partial<ComponentProps<typeof AssetInventoryWorkspace>> = {}) {
  return render(
    <AssetInventoryWorkspace
      preset="all"
      onPresetChange={vi.fn()}
      headerBranchId={BRANCH_ALL_VALUE}
      onHeaderBranchChange={vi.fn()}
      branches={[{ id: "b1", label: "Noida" }]}
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
      successToastMessage={null}
      highlightedRowId={null}
      expandedRowIds={new Set()}
      onToggleExpand={vi.fn()}
      {...overrides}
    />,
  );
}

afterEach(() => cleanup());

describe("AssetInventoryWorkspace", () => {
  it("renders header and presets", () => {
    renderWorkspace();
    expect(screen.getByText("Asset Register")).toBeInTheDocument();
    expect(screen.getByTestId("inventory-preset-tabs")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Assigned" })).toBeInTheDocument();
  });

  it("renders embedded section header without local branch selector", () => {
    renderWorkspace({ embedded: true, hideBranchSelector: true });
    expect(screen.getByTestId("asset-register-section-header")).toBeInTheDocument();
    expect(screen.getByTestId("asset-inventory-workspace").getAttribute("data-embedded")).toBe(
      "true",
    );
    expect(screen.queryByRole("group", { name: "Branch" })).not.toBeInTheDocument();
  });

  it("shows table row on desktop", () => {
    renderWorkspace();
    const table = screen.getByTestId("inventory-table");
    expect(within(table).getByText("AST-1")).toBeInTheDocument();
  });

  it("renders action menu in table", () => {
    renderWorkspace();
    const table = screen.getByTestId("inventory-table");
    expect(within(table).getByRole("button", { name: /View/ })).toBeInTheDocument();
    expect(within(table).getByRole("button", { name: "More actions" })).toBeInTheDocument();
  });

  it("calls onViewRow when View clicked", async () => {
    const user = userEvent.setup();
    const onViewRow = vi.fn();
    renderWorkspace({ onViewRow });
    const table = screen.getByTestId("inventory-table");
    await user.click(within(table).getByRole("button", { name: /View/ }));
    expect(onViewRow).toHaveBeenCalledWith(sampleRow);
  });

  it("calls onViewRow when table row clicked", async () => {
    const user = userEvent.setup();
    const onViewRow = vi.fn();
    renderWorkspace({ onViewRow });
    await user.click(screen.getByTestId("inventory-table-row"));
    expect(onViewRow).toHaveBeenCalledWith(sampleRow);
  });

  it("does not open drawer from expand chevron alone", async () => {
    const user = userEvent.setup();
    const onViewRow = vi.fn();
    const onToggleExpand = vi.fn();
    renderWorkspace({ onViewRow, onToggleExpand });
    await user.click(screen.getByRole("button", { name: "Expand row" }));
    expect(onToggleExpand).toHaveBeenCalledWith("1");
    expect(onViewRow).not.toHaveBeenCalled();
  });

  it("opens drawer when drawerOpen", () => {
    renderWorkspace({
      drawerOpen: true,
      drawerRow: sampleRow,
      drawerData: {
        assetTag: sampleRow.assetTag,
        laptopName: sampleRow.laptopName,
        manufacturer: sampleRow.manufacturer,
        model: sampleRow.model,
        currentHolder: sampleRow.currentHolder,
        department: sampleRow.department,
        employeeId: sampleRow.employeeId,
        location: sampleRow.location,
        configuration: sampleRow.configuration,
        configurationParts: {
          cpu: "i7",
          ram: "16GB",
          storage: "—",
          os: "—",
          accessories: "—",
        },
        branch: sampleRow.branch,
        operationalStatus: sampleRow.operationalStatus,
        lifecycleStatus: sampleRow.lifecycleStatus,
        qrValue: "/assets/information-portal/1",
        timeline: [],
        history: [],
      },
    });
    expect(screen.getByTestId("asset-detail-drawer")).toBeInTheDocument();
    expect(screen.getByTestId("drawer-workspace-header")).toBeInTheDocument();
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

  it("calls onPresetChange", async () => {
    const user = userEvent.setup();
    const onPresetChange = vi.fn();
    renderWorkspace({ onPresetChange });
    await user.click(screen.getByRole("tab", { name: "Disposed" }));
    expect(onPresetChange).toHaveBeenCalledWith("disposed");
  });

  it("expands row details", async () => {
    const user = userEvent.setup();
    const onToggleExpand = vi.fn();
    renderWorkspace({ onToggleExpand });
    await user.click(screen.getByRole("button", { name: "Expand row" }));
    expect(onToggleExpand).toHaveBeenCalledWith("1");
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

  it("submits quick search", async () => {
    const user = userEvent.setup();
    const onQuickSearchSubmit = vi.fn();
    renderWorkspace({ onQuickSearchSubmit, quickSearch: "tag" });
    await user.click(screen.getByRole("button", { name: "Search" }));
    expect(onQuickSearchSubmit).toHaveBeenCalled();
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

  it("renders success toast when message provided", () => {
    renderWorkspace({ successToastMessage: "Asset registered successfully." });
    expect(screen.getByTestId("inventory-success-toast")).toHaveTextContent(
      "Asset registered successfully.",
    );
  });

  it("marks highlighted table row", () => {
    renderWorkspace({ highlightedRowId: "1" });
    expect(screen.getByTestId("inventory-table-row")).toHaveAttribute("data-highlighted", "true");
  });
});
