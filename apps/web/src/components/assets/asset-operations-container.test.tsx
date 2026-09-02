/** @vitest-environment jsdom */

import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AssetOperationsContainer } from "@/components/assets/asset-operations-container";
import { BRANCH_ALL_VALUE } from "@/components/assets/shared";

const fetchMock = vi.fn();
const listBranchesMock = vi.fn();
const listSiteLocationsMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}));

vi.mock("@/components/assets/asset-operations-fetch", () => ({
  fetchAssetOperationsData: (...args: unknown[]) => fetchMock(...args),
}));

vi.mock("@/lib/org-options", () => ({
  listBranchOptions: () => listBranchesMock(),
}));

vi.mock("@/services/asset-site-location-service", () => ({
  listSiteLocations: () => listSiteLocationsMock(),
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
  transfersList: {
    items: [
      {
        id: "t1",
        document_number: "TRF-1",
        asset_id: "asset-1",
        from_location_label: "New Delhi · CRC2",
        to_location_label: "Mumbai · CRC-1",
        from_branch_id: "b1",
        to_branch_id: "b1",
        status: "submitted",
        reason: "Move",
      },
    ],
    total: 1,
    page: 1,
    page_size: 50,
  },
  assetsList: {
    items: [{ id: "asset-1", asset_code: "AST-1", asset_name: "Laptop", branch_id: "b1" }],
    total: 1,
    page: 1,
    page_size: 200,
  },
  errors: {},
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

beforeEach(() => {
  listBranchesMock.mockResolvedValue([{ id: "b1", label: "Noida" }]);
  listSiteLocationsMock.mockResolvedValue([
    {
      id: "loc1",
      name: "New Delhi",
      is_head_office: true,
      org_location_id: null,
      company_id: "c1",
      version: 1,
    },
  ]);
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

  it("renders transfer row from API", async () => {
    render(<AssetOperationsContainer />);
    await waitFor(() => {
      expect(screen.getByText("TRF-1")).toBeInTheDocument();
    });
    expect(screen.getByText("Laptop")).toBeInTheDocument();
    expect(screen.getByText("AST-1")).toBeInTheDocument();
  });

  it("shows loading skeletons initially", () => {
    fetchMock.mockImplementation(() => new Promise(() => {}));
    render(<AssetOperationsContainer />);
    expect(screen.getAllByLabelText("Loading statistic").length).toBeGreaterThan(0);
  });

  it("shows error card when all requests fail", async () => {
    fetchMock.mockResolvedValue({
      summary: null,
      transfersList: null,
      assetsList: null,
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
    let allowSuccess = false;
    fetchMock.mockImplementation(async () => {
      if (!allowSuccess) {
        return {
          summary: null,
          transfersList: null,
          assetsList: null,
          errors: { summary: "fail" },
        };
      }
      return successPayload;
    });

    render(<AssetOperationsContainer />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
    });
    allowSuccess = true;
    await user.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => {
      expect(screen.getByText("12")).toBeInTheDocument();
    });
  });

  it("refetches when location changes", async () => {
    const user = userEvent.setup();
    render(<AssetOperationsContainer />);
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(BRANCH_ALL_VALUE);
    });
    const group = await screen.findByRole("group", { name: "Location" });
    await user.click(within(group).getByRole("button", { name: "New Delhi" }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("loc1");
    });
  });

  it("shows empty transfer copy when list is empty", async () => {
    fetchMock.mockResolvedValue({
      ...successPayload,
      transfersList: { items: [], total: 0, page: 1, page_size: 50 },
    });
    render(<AssetOperationsContainer />);
    await waitFor(() => {
      expect(screen.getByText("No transfers found.")).toBeInTheDocument();
    });
  });
});
