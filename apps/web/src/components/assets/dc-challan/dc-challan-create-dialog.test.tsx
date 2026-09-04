/**
 * DC Challan create dialog
 * @vitest-environment jsdom
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const searchAssetsMock = vi.fn();
const getAssetMock = vi.fn();
const listAssignmentsMock = vi.fn();
const createMock = vi.fn();
const listEmployeesMock = vi.fn();

vi.mock("@/services/assets-service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/assets-service")>();
  return {
    ...actual,
    assetRegisterService: {
      ...actual.assetRegisterService,
      search: (...args: unknown[]) => searchAssetsMock(...args),
      get: (...args: unknown[]) => getAssetMock(...args),
    },
    assetOperationsService: {
      ...actual.assetOperationsService,
      listAssignments: (...args: unknown[]) => listAssignmentsMock(...args),
    },
    dcChallanService: {
      ...actual.dcChallanService,
      create: (...args: unknown[]) => createMock(...args),
    },
  };
});

vi.mock("@/lib/org-options", () => ({
  listEmployeeDirectory: (...args: unknown[]) => listEmployeesMock(...args),
}));

import { DcChallanCreateDialog } from "./dc-challan-create-dialog";

describe("DcChallanCreateDialog", () => {
  beforeEach(() => {
    searchAssetsMock.mockReset();
    getAssetMock.mockReset();
    listAssignmentsMock.mockReset();
    createMock.mockReset();
    listEmployeesMock.mockReset();
    listEmployeesMock.mockResolvedValue([
      { id: "emp-8", label: "Sana Qureshi (EMP-008)", displayName: "Sana Qureshi", employeeCode: "EMP-008", mobile: "9" },
    ]);
    listAssignmentsMock.mockResolvedValue({ items: [], total: 0, page: 1, page_size: 20 });
    createMock.mockResolvedValue({ id: "dc-1", dc_number: "DC-2026-000002", asset_id: "a1", status: "PENDING" });
  });

  it("searches eligible assets and shows a confirmation preview", async () => {
    const user = userEvent.setup();
    searchAssetsMock.mockResolvedValue({
      items: [
        {
          id: "a1",
          asset_code: "AST-1",
          asset_name: "Macbook",
          serial_number: "SN-9",
          operational_status: "READY_TO_MOVE",
        },
      ],
      total: 1,
      page: 1,
      page_size: 8,
    });
    render(
      <DcChallanCreateDialog
        open
        onOpenChange={vi.fn()}
        onCreated={vi.fn()}
      />,
    );
    expect(screen.queryByLabelText("Asset ID")).toBeNull();
    await user.type(screen.getByRole("combobox", { name: "Search eligible assets" }), "mac");
    await waitFor(() => expect(searchAssetsMock).toHaveBeenCalled());
    expect(searchAssetsMock.mock.calls.map((call) => call[0].operational_status).sort()).toEqual([
      "ASSIGNED",
      "READY_TO_MOVE",
    ]);
    await user.click(await screen.findByRole("option", { name: /Macbook/ }));
    expect(screen.getByTestId("dc-challan-create-preview")).toHaveTextContent("AST-1");
    expect(screen.getByTestId("dc-challan-create-preview")).toHaveTextContent("Macbook");
    expect(screen.getByText(/Asset only/)).toBeInTheDocument();
  });

  it("shows the eligible empty state when nothing matches", async () => {
    const user = userEvent.setup();
    searchAssetsMock.mockResolvedValue({ items: [], total: 0, page: 1, page_size: 8 });
    render(<DcChallanCreateDialog open onOpenChange={vi.fn()} onCreated={vi.fn()} />);
    await user.type(screen.getByRole("combobox", { name: "Search eligible assets" }), "zzz");
    expect(await screen.findByText("No ready-to-move or assigned assets match")).toBeInTheDocument();
  });

  it("skips pickers on a deep-linked asset and shows assignment chip", async () => {
    getAssetMock.mockResolvedValue({
      id: "a1",
      asset_code: "AST-121",
      asset_name: "Apple MacBook Pro 14",
      operational_status: "ASSIGNED",
    });
    listAssignmentsMock.mockResolvedValue({
      items: [
        {
          id: "asn-1",
          document_number: "AASN-1",
          allocation_type: "employee",
          status: "active",
          employee_id: "emp-8",
        },
      ],
      total: 1,
      page: 1,
      page_size: 20,
    });
    render(
      <DcChallanCreateDialog
        open
        onOpenChange={vi.fn()}
        onCreated={vi.fn()}
        initialAssetId="a1"
        initialAssignmentId="asn-1"
        lockPrefill
      />,
    );
    expect(screen.queryByRole("combobox", { name: "Search eligible assets" })).toBeNull();
    await waitFor(() => expect(getAssetMock).toHaveBeenCalledWith("a1"));
    expect(await screen.findByTestId("dc-challan-create-preview")).toHaveTextContent("AST-121");
    expect(await screen.findByTestId("dc-challan-create-preview")).toHaveTextContent("Sana Qureshi (EMP-008)");
  });
});
