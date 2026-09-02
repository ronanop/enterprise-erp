/**
 * Incoming Assets workspace — Sub-phase 1 (IT receiving).
 * @vitest-environment jsdom
 */

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const searchMock = vi.fn();
const summaryMock = vi.fn();
const getMock = vi.fn();
const arriveMock = vi.fn();
const listBranchOptionsMock = vi.fn();

vi.mock("@/lib/auth", () => ({
  isAuthenticated: () => true,
}));

vi.mock("@/lib/org-options", () => ({
  listBranchOptions: () => listBranchOptionsMock(),
}));

vi.mock("@/services/assets-service", () => ({
  incomingAssetService: {
    search: (...args: unknown[]) => searchMock(...args),
    summary: (...args: unknown[]) => summaryMock(...args),
    get: (...args: unknown[]) => getMock(...args),
    arrive: (...args: unknown[]) => arriveMock(...args),
  },
}));

import { IncomingAssetsWorkspace } from "./incoming-assets-workspace";

const LINE = {
  id: "line-1",
  company_id: "c1",
  branch_id: "b1",
  grn_id: "g1",
  grn_line_id: "gl1",
  purchase_order_id: "po1",
  product_id: "p1",
  vendor_id: "v123456789",
  grn_document_number: "GRN-100",
  po_document_number: "PO-50",
  product_code: "LAP-01",
  product_name: "Dell Laptop",
  document_date: "2026-08-01",
  expected_quantity: 10,
  arrived_quantity: 4,
  pending_quantity: 6,
  status: "PARTIALLY_ARRIVED",
  version: 1,
  units: [
    { id: "u1", unit_index: 1, serial_number: null, status: "ARRIVED" },
    { id: "u2", unit_index: 2, serial_number: null, status: "PENDING" },
  ],
};

describe("IncomingAssetsWorkspace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listBranchOptionsMock.mockResolvedValue([{ id: "b1", label: "Noida" }]);
    summaryMock.mockResolvedValue({
      expected_lines: 3,
      pending_arrival_lines: 1,
      partially_arrived_lines: 1,
      arrived_lines: 1,
      expected_quantity_total: 20,
      arrived_quantity_total: 8,
      pending_quantity_total: 12,
    });
    searchMock.mockResolvedValue({
      items: [LINE],
      total: 1,
      page: 1,
      page_size: 25,
    });
    getMock.mockResolvedValue(LINE);
    arriveMock.mockResolvedValue({
      ...LINE,
      arrived_quantity: 10,
      pending_quantity: 0,
      status: "ARRIVED",
    });
  });

  it("renders header, summary cards, table row, and status badge", async () => {
    render(<IncomingAssetsWorkspace />);
    expect(await screen.findByRole("heading", { name: "Incoming Assets" })).toBeInTheDocument();
    expect(
      screen.getByText(/Assets received from Procurement\/SCM/i),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(summaryMock).toHaveBeenCalled();
      expect(searchMock).toHaveBeenCalled();
    });
    expect(screen.getAllByText("Expected").length).toBeGreaterThan(0);
    expect(screen.getByText("Pending Arrival")).toBeInTheDocument();
    expect(screen.getByText("GRN-100")).toBeInTheDocument();
    expect(screen.getByText("Dell Laptop")).toBeInTheDocument();
    expect(screen.getByText("PARTIALLY ARRIVED")).toBeInTheDocument();
  });

  it("filters by status via summary card", async () => {
    const user = userEvent.setup();
    render(<IncomingAssetsWorkspace />);
    await screen.findByText("GRN-100");
    searchMock.mockClear();
    await user.click(screen.getByText("Pending Arrival"));
    await waitFor(() => {
      expect(searchMock).toHaveBeenCalledWith(
        expect.objectContaining({ status: "EXPECTED" }),
      );
    });
  });

  it("opens receive panel and validates quantity", async () => {
    const user = userEvent.setup();
    render(<IncomingAssetsWorkspace />);
    await screen.findByText("GRN-100");
    await user.click(screen.getByRole("button", { name: "Receive" }));
    expect(await screen.findByText("Receive / view")).toBeInTheDocument();
    await waitFor(() => expect(getMock).toHaveBeenCalledWith("line-1"));
    const qty = screen.getByLabelText("Quantity");
    await user.clear(qty);
    await user.type(qty, "99");
    await user.click(screen.getByRole("button", { name: "Mark arrived" }));
    expect(await screen.findByText(/cannot exceed remaining/i)).toBeInTheDocument();
    expect(arriveMock).not.toHaveBeenCalled();
  });

  it("mark all confirms and submits arrive", async () => {
    const user = userEvent.setup();
    render(<IncomingAssetsWorkspace />);
    await screen.findByText("GRN-100");
    await user.click(screen.getByRole("button", { name: "Receive" }));
    await screen.findByLabelText("Quantity");
    await user.click(screen.getByRole("button", { name: "Mark all arrived" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/Mark all remaining/i)).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Mark arrived" }));
    await waitFor(() => {
      expect(arriveMock).toHaveBeenCalledWith("line-1", { mark_all: true });
    });
    expect(await screen.findByText(/Marked .* as arrived/i)).toBeInTheDocument();
  });

  it("shows API error from list failure", async () => {
    const { ApiClientError } = await import("@/services/api-client");
    searchMock.mockRejectedValue(new ApiClientError("GRN no longer available", 409));
    summaryMock.mockResolvedValue({
      expected_lines: 0,
      pending_arrival_lines: 0,
      partially_arrived_lines: 0,
      arrived_lines: 0,
      expected_quantity_total: 0,
      arrived_quantity_total: 0,
      pending_quantity_total: 0,
    });
    render(<IncomingAssetsWorkspace />);
    expect(await screen.findByRole("alert")).toHaveTextContent("GRN no longer available");
  });
});
