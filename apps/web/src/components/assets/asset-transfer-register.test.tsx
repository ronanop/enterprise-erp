import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const searchParams = vi.hoisted(() => ({
  get: vi.fn<(key: string) => string | null>(() => null),
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => searchParams,
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/assets/asset-transfers",
}));

vi.mock("@/lib/auth", () => ({
  isAuthenticated: () => true,
  getAccessTokenUserId: () => "user-1",
}));

vi.mock("@/lib/org-options", () => ({
  listBranchOptions: vi.fn(async () => [{ id: "branch-1", label: "CRC2" }]),
}));

const listTransfers = vi.fn();
const listAssets = vi.fn();
const actionMock = vi.fn();

vi.mock("@/services/assets-service", () => ({
  assetOperationsService: {
    listTransfers: (...args: unknown[]) => listTransfers(...args),
    listAssets: (...args: unknown[]) => listAssets(...args),
  },
}));

vi.mock("@/services/api-client", () => ({
  ApiClientError: class ApiClientError extends Error {
    status: number;
    constructor(message: string, status = 400) {
      super(message);
      this.status = status;
    }
  },
  resourceService: {
    action: (...args: unknown[]) => actionMock(...args),
  },
}));

import { AssetTransferRegister } from "@/components/assets/asset-transfer-register";

describe("AssetTransferRegister", () => {
  beforeEach(() => {
    searchParams.get.mockReturnValue(null);
    listTransfers.mockReset();
    listAssets.mockReset();
    actionMock.mockReset();
    listAssets.mockResolvedValue({
      items: [
        {
          id: "asset-1",
          asset_code: "AST-2026-000002",
          asset_name: "Macbook",
        },
      ],
      total: 1,
      page: 1,
      page_size: 200,
    });
    listTransfers.mockResolvedValue({
      items: [
        {
          id: "xfer-1",
          document_number: "ATRF-2026-000005",
          asset_id: "asset-1",
          from_branch_id: "branch-1",
          to_branch_id: "branch-2",
          from_location_label: "New Delhi",
          to_location_label: "Noida",
          status: "draft",
          version: 1,
          effective_date: "2026-09-17",
          reason: "Relocation",
          created_by: "user-2",
        },
        {
          id: "xfer-2",
          document_number: "ATRF-2026-000006",
          asset_id: "asset-1",
          from_location_label: "Noida",
          to_location_label: "Delhi",
          status: "submitted",
          version: 1,
          effective_date: "2026-09-18",
          created_by: "user-2",
        },
      ],
      total: 2,
      page: 1,
      page_size: 25,
    });
  });

  it("renders one simple transfer table with status values", async () => {
    render(<AssetTransferRegister />);
    expect(screen.getByRole("heading", { name: "Transfers" })).toBeInTheDocument();
    expect(screen.getByText("View asset transfer records.")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText("ATRF-2026-000005")).toBeInTheDocument();
    });
    expect(screen.getByText("ATRF-2026-000006")).toBeInTheDocument();
    expect(screen.getAllByText("Macbook").length).toBeGreaterThan(0);
    expect(screen.getByTestId("transfer-register-table")).toBeInTheDocument();
    expect(screen.queryByText("Create draft")).not.toBeInTheDocument();
    expect(screen.queryByText("Transfer detail")).not.toBeInTheDocument();
    expect(screen.queryByText("Edit draft")).not.toBeInTheDocument();
  });

  it("focuses document from query param and exposes draft actions in menu", async () => {
    const user = userEvent.setup();
    searchParams.get.mockImplementation((key: string) =>
      key === "document" ? "ATRF-2026-000005" : null,
    );
    render(<AssetTransferRegister />);
    await waitFor(() => {
      expect(screen.getByTestId("transfer-row-ATRF-2026-000005")).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getByTestId("transfer-register-detail")).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: "Actions for ATRF-2026-000005" }));
    expect(screen.getByRole("menuitem", { name: "View details" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Submit" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Cancel" })).toBeInTheDocument();
  });
});
