/** @vitest-environment jsdom */

import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AssetOperationsContainer } from "@/components/assets/asset-operations-container";
import { BRANCH_ALL_VALUE } from "@/components/assets/shared";

const fetchMock = vi.fn();
const listBranchesMock = vi.fn();

vi.mock("@/components/assets/asset-operations-fetch", () => ({
  fetchAssetOperationsData: (...args: unknown[]) => fetchMock(...args),
}));

vi.mock("@/lib/org-options", () => ({
  listBranchOptions: () => listBranchesMock(),
}));

const successPayload = {
  summary: {
    company_id: "c1",
    total_assets: 12,
    ready_to_move: 2,
    assigned: 8,
    retired: 1,
    pending_disposal: 1,
    disposed: 0,
  },
  readyList: {
    items: [{ id: "1", asset_code: "AST-1", asset_name: "Laptop", branch_id: "b1" }],
    total: 1,
    page: 1,
    page_size: 10,
  },
  disposalList: { items: [], total: 0, page: 1, page_size: 10 },
  assignmentsList: {
    items: [
      {
        id: "a1",
        document_number: "ASN-1",
        asset_id: "asset-1",
        status: "active",
        allocated_at: "2026-08-01T09:00:00.000Z",
      },
    ],
    total: 1,
    page: 1,
    page_size: 10,
  },
  errors: {},
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

beforeEach(() => {
  listBranchesMock.mockResolvedValue([{ id: "b1", label: "Noida" }]);
  fetchMock.mockResolvedValue(successPayload);
});

describe("AssetOperationsContainer", () => {
  it("loads and renders KPI values", async () => {
    render(<AssetOperationsContainer />);
    await waitFor(() => {
      expect(screen.getByText("12")).toBeInTheDocument();
    });
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("renders ready queue row from API", async () => {
    render(<AssetOperationsContainer />);
    await waitFor(() => {
      expect(screen.getByText("AST-1")).toBeInTheDocument();
    });
    expect(screen.getByText("Laptop")).toBeInTheDocument();
  });

  it("shows loading skeletons initially", () => {
    fetchMock.mockImplementation(() => new Promise(() => {}));
    render(<AssetOperationsContainer />);
    expect(screen.getAllByLabelText("Loading statistic").length).toBeGreaterThan(0);
  });

  it("shows error card when all requests fail", async () => {
    fetchMock.mockResolvedValue({
      summary: null,
      readyList: null,
      disposalList: null,
      assignmentsList: null,
      errors: { summary: "Network error" },
    });
    render(<AssetOperationsContainer />);
    await waitFor(() => {
      expect(screen.getByTestId("asset-ops-error-card")).toBeInTheDocument();
    });
    expect(screen.getByText("Network error")).toBeInTheDocument();
  });

  it("retries fetch when Retry is clicked", async () => {
    const user = userEvent.setup();
    fetchMock
      .mockResolvedValueOnce({
        summary: null,
        readyList: null,
        disposalList: null,
        assignmentsList: null,
        errors: { summary: "fail" },
      })
      .mockResolvedValueOnce(successPayload);

    render(<AssetOperationsContainer />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => {
      expect(screen.getByText("12")).toBeInTheDocument();
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("refetches when branch changes", async () => {
    const user = userEvent.setup();
    render(<AssetOperationsContainer />);
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(BRANCH_ALL_VALUE);
    });
    const group = await screen.findByRole("group", { name: "Branch" });
    await user.click(within(group).getByRole("button", { name: "Noida" }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("b1");
    });
  });

  it("shows empty assignment copy when list is empty", async () => {
    fetchMock.mockResolvedValue({
      ...successPayload,
      assignmentsList: { items: [], total: 0, page: 1, page_size: 10 },
    });
    render(<AssetOperationsContainer />);
    await waitFor(() => {
      expect(screen.getByText("No assignments")).toBeInTheDocument();
    });
  });
});
