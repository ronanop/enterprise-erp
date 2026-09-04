/**
 * Pending Registration queue — Sub-phase 3.
 * @vitest-environment jsdom
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const searchMock = vi.fn();
const summaryMock = vi.fn();
const downloadMock = vi.fn();
const validateMock = vi.fn();
const confirmMock = vi.fn();
const listBranchOptionsMock = vi.fn();

vi.mock("@/lib/auth", () => ({
  isAuthenticated: () => true,
  getAccessToken: () => "token",
}));

vi.mock("@/lib/org-options", () => ({
  listBranchOptions: () => listBranchOptionsMock(),
}));

vi.mock("@/services/assets-service", () => ({
  assetRegistrationQueueService: {
    search: (...args: unknown[]) => searchMock(...args),
    summary: (...args: unknown[]) => summaryMock(...args),
    downloadTemplate: (...args: unknown[]) => downloadMock(...args),
    validateExcel: (...args: unknown[]) => validateMock(...args),
    confirmExcel: (...args: unknown[]) => confirmMock(...args),
  },
}));

import { AssetRegistrationQueueWorkspace } from "./asset-registration-queue-workspace";

const ITEM = {
  incoming_unit_id: "u1",
  incoming_line_id: "l1",
  unit_index: 1,
  unit_reference: "IN-0001",
  product_name: "Dell Laptop",
  product_code: "LAP",
  serial_number: "ABC001",
  grn_id: "g1",
  grn_document_number: "GRN-100",
  purchase_order_id: "po1",
  po_document_number: "PO-50",
  branch_id: "b1",
  qc_status: "ACCEPTED",
  registration_status: "PENDING_REGISTRATION",
  line_registration_status: "PENDING_REGISTRATION",
  registered_asset_id: null,
};

describe("AssetRegistrationQueueWorkspace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listBranchOptionsMock.mockResolvedValue([{ id: "b1", label: "Noida" }]);
    summaryMock.mockResolvedValue({
      accepted: 10,
      registered: 3,
      pending_registration: 7,
    });
    searchMock.mockResolvedValue({
      items: [ITEM],
      total: 1,
      page: 1,
      page_size: 25,
    });
  });

  it("renders header, counts, and Add Asset action", async () => {
    render(<AssetRegistrationQueueWorkspace />);
    expect(
      await screen.findByRole("heading", { name: "Pending Registration" }),
    ).toBeInTheDocument();
    await waitFor(() => expect(summaryMock).toHaveBeenCalled());
    expect(screen.getByText("Dell Laptop")).toBeInTheDocument();
    expect(screen.getByText("IN-0001")).toBeInTheDocument();
    const add = screen.getByRole("link", { name: "Add Asset" });
    expect(add).toHaveAttribute(
      "href",
      "/assets/assets/new?incomingUnitId=u1&incomingLineId=l1",
    );
  });

  it("shows empty pending message when all registered", async () => {
    summaryMock.mockResolvedValue({
      accepted: 5,
      registered: 5,
      pending_registration: 0,
    });
    searchMock.mockResolvedValue({ items: [], total: 0, page: 1, page_size: 25 });
    render(<AssetRegistrationQueueWorkspace />);
    expect(
      await screen.findByText(/All accepted assets have been registered/i),
    ).toBeInTheDocument();
  });

  it("exposes upload and download template actions", async () => {
    render(<AssetRegistrationQueueWorkspace />);
    await screen.findByText("Dell Laptop");
    expect(screen.getByRole("button", { name: /Download Template/i })).toBeInTheDocument();
    expect(screen.getByLabelText("Upload Excel")).toBeInTheDocument();
  });
});
