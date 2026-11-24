/** @vitest-environment jsdom */

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AssetOperationsContainer } from "@/components/assets/asset-operations-container";
import { BRANCH_ALL_VALUE } from "@/components/assets/shared";

const fetchMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}));

vi.mock("@/components/assets/asset-operations-fetch", () => ({
  fetchAssetOperationsData: (...args: unknown[]) => fetchMock(...args),
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
  errors: {},
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

beforeEach(() => {
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

  it("does not render transfers section", async () => {
    render(<AssetOperationsContainer />);
    await waitFor(() => {
      expect(screen.getByText("12")).toBeInTheDocument();
    });
    expect(screen.queryByTestId("asset-ops-transfers")).not.toBeInTheDocument();
  });

  it("shows loading skeletons initially", () => {
    fetchMock.mockImplementation(() => new Promise(() => {}));
    render(<AssetOperationsContainer />);
    expect(screen.getAllByLabelText("Loading statistic").length).toBeGreaterThan(0);
  });

  it("shows error card when summary fails", async () => {
    fetchMock.mockResolvedValue({
      summary: null,
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

  it("loads dashboard for all locations without a location selector", async () => {
    render(<AssetOperationsContainer />);
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(BRANCH_ALL_VALUE);
    });
    expect(screen.queryByRole("group", { name: "Location" })).not.toBeInTheDocument();
  });
});
