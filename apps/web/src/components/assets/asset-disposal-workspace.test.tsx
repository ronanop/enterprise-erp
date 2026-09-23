/**
 * @vitest-environment jsdom
 */
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const list = vi.fn();
const get = vi.fn();

vi.mock("@/lib/auth", () => ({
  isAuthenticated: () => true,
}));

vi.mock("@/services/api-client", () => ({
  ApiClientError: class ApiClientError extends Error {},
  resourceService: {
    list: (...args: unknown[]) => list(...args),
    get: (...args: unknown[]) => get(...args),
  },
}));

import { AssetDisposalWorkspace } from "@/components/assets/asset-disposal-workspace";

afterEach(() => {
  cleanup();
  list.mockReset();
  get.mockReset();
});

beforeEach(() => {
  list.mockResolvedValue({
    data: {
      items: [
        {
          id: "d1",
          document_number: "ADISP-1",
          asset_id: "a1",
          disposal_type: "scrap",
          disposal_date: "2026-09-22",
          remarks: "Broken",
          management_approved: true,
          status: "posted",
          version: 1,
          branch_id: "b1",
          asset_code: "AST-1",
          make: "Dell",
          model: "Latitude",
          configuration: "16 GB / 512 GB",
        },
      ],
      total: 1,
      page: 1,
      page_size: 25,
    },
  });
  get.mockResolvedValue({
    data: {
      id: "d1",
      document_number: "ADISP-1",
      asset_id: "a1",
      disposal_type: "scrap",
      disposal_date: "2026-09-22",
      remarks: "Broken",
      management_approved: true,
      status: "posted",
      version: 1,
      branch_id: "b1",
      asset_code: "AST-1",
      asset_name: "Dell Laptop",
      make: "Dell",
      model: "Latitude",
      configuration: "16 GB / 512 GB",
      serial_number: "SN-1",
    },
  });
});

describe("AssetDisposalWorkspace (Disposed tab)", () => {
  it("lists disposed assets with summary columns", async () => {
    render(<AssetDisposalWorkspace />);
    expect(await screen.findByTestId("disposed-assets-table")).toBeInTheDocument();
    expect(screen.getByText("AST-1")).toBeInTheDocument();
    expect(screen.getByText("Dell")).toBeInTheDocument();
    expect(screen.getByText("Latitude")).toBeInTheDocument();
    expect(screen.getByText("2026-09-22")).toBeInTheDocument();
    expect(list).toHaveBeenCalledWith(
      "/assets/asset-disposals",
      expect.objectContaining({ status: "posted" }),
    );
  });

  it("opens View Details with reason and approval", async () => {
    const user = userEvent.setup();
    render(<AssetDisposalWorkspace />);
    await user.click(await screen.findByTestId("disposed-view-d1"));
    expect(await screen.findByTestId("disposed-detail-drawer")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText("Broken")).toBeInTheDocument();
      expect(screen.getByText("Yes / Approved")).toBeInTheDocument();
    });
  });
});
