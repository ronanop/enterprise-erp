/**
 * Incoming Assets QC workspace — Sub-phase 2.
 * @vitest-environment jsdom
 */

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const searchMock = vi.fn();
const getMock = vi.fn();
const startMock = vi.fn();
const acceptMock = vi.fn();
const rejectMock = vi.fn();
const listBranchOptionsMock = vi.fn();

vi.mock("@/lib/auth", () => ({
  isAuthenticated: () => true,
}));

vi.mock("@/lib/org-options", () => ({
  listBranchOptions: () => listBranchOptionsMock(),
}));

vi.mock("@/services/assets-service", () => ({
  incomingAssetQcService: {
    search: (...args: unknown[]) => searchMock(...args),
    get: (...args: unknown[]) => getMock(...args),
    start: (...args: unknown[]) => startMock(...args),
    accept: (...args: unknown[]) => acceptMock(...args),
    reject: (...args: unknown[]) => rejectMock(...args),
  },
}));

import { IncomingAssetsQcWorkspace } from "./incoming-assets-qc-workspace";

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
  arrived_quantity: 10,
  pending_quantity: 0,
  accepted_quantity: 0,
  rejected_quantity: 0,
  pending_qc_quantity: 10,
  status: "ARRIVED",
  qc_status: "PENDING",
  version: 1,
  units: [
    {
      id: "u1",
      unit_index: 1,
      serial_number: "SN-1",
      status: "ARRIVED",
      qc_status: "PENDING_QC",
    },
    {
      id: "u2",
      unit_index: 2,
      serial_number: null,
      status: "ARRIVED",
      qc_status: "PENDING_QC",
    },
  ],
};

describe("IncomingAssetsQcWorkspace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listBranchOptionsMock.mockResolvedValue([{ id: "b1", label: "Noida" }]);
    searchMock.mockResolvedValue({
      items: [LINE],
      total: 1,
      page: 1,
      page_size: 25,
    });
    getMock.mockResolvedValue(LINE);
    startMock.mockResolvedValue({ ...LINE, qc_status: "IN_PROGRESS" });
    acceptMock.mockResolvedValue({
      ...LINE,
      accepted_quantity: 2,
      pending_qc_quantity: 8,
      qc_status: "IN_PROGRESS",
    });
    rejectMock.mockResolvedValue({
      ...LINE,
      rejected_quantity: 1,
      pending_qc_quantity: 9,
      qc_status: "IN_PROGRESS",
    });
  });

  it("renders QC header, queue row, and badges", async () => {
    render(<IncomingAssetsQcWorkspace />);
    expect(
      await screen.findByRole("heading", { name: "Incoming Assets — QC" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Accept makes them eligible/i)).toBeInTheDocument();
    await waitFor(() => expect(searchMock).toHaveBeenCalled());
    expect(screen.getByText("GRN-100")).toBeInTheDocument();
    expect(screen.getByText("Dell Laptop")).toBeInTheDocument();
    expect(screen.getByText("PENDING")).toBeInTheDocument();
  });

  it("opens inspect panel and starts QC", async () => {
    const user = userEvent.setup();
    render(<IncomingAssetsQcWorkspace />);
    await screen.findByText("GRN-100");
    await user.click(screen.getByRole("button", { name: "Inspect" }));
    await waitFor(() => expect(getMock).toHaveBeenCalledWith("line-1"));
    expect(await screen.findByText("Inspect / disposition")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Start QC" }));
    await waitFor(() => expect(startMock).toHaveBeenCalledWith("line-1"));
  });

  it("validates accept quantity against pending QC", async () => {
    const user = userEvent.setup();
    render(<IncomingAssetsQcWorkspace />);
    await screen.findByText("GRN-100");
    await user.click(screen.getByRole("button", { name: "Inspect" }));
    await screen.findByLabelText("Quantity");
    const qty = screen.getByLabelText("Quantity");
    await user.clear(qty);
    await user.type(qty, "99");
    await user.click(screen.getByRole("button", { name: "Accept qty" }));
    expect(await screen.findByText(/cannot exceed pending QC/i)).toBeInTheDocument();
    expect(acceptMock).not.toHaveBeenCalled();
  });

  it("accept all confirms and submits", async () => {
    const user = userEvent.setup();
    render(<IncomingAssetsQcWorkspace />);
    await screen.findByText("GRN-100");
    await user.click(screen.getByRole("button", { name: "Inspect" }));
    await screen.findByLabelText("Quantity");
    await user.click(screen.getByRole("button", { name: "Accept all pending" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/No asset register record/i)).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Accept" }));
    await waitFor(() => {
      expect(acceptMock).toHaveBeenCalledWith("line-1", {
        mark_all_pending: true,
        notes: undefined,
      });
    });
    expect(
      await screen.findByText(/No asset record was created/i),
    ).toBeInTheDocument();
  });

  it("requires rejection reason before reject", async () => {
    const user = userEvent.setup();
    render(<IncomingAssetsQcWorkspace />);
    await screen.findByText("GRN-100");
    await user.click(screen.getByRole("button", { name: "Inspect" }));
    await screen.findByLabelText("Quantity");
    await user.click(screen.getByRole("button", { name: "Reject qty" }));
    expect(await screen.findByText(/Rejection reason is required/i)).toBeInTheDocument();
    expect(rejectMock).not.toHaveBeenCalled();
  });
});
