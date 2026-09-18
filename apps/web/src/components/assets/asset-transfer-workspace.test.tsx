import { render, screen, waitFor } from "@testing-library/react";
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

vi.mock("@/services/asset-site-location-service", () => ({
  listSiteLocations: vi.fn(async () => []),
  listSiteBuildings: vi.fn(async () => []),
}));

const listMock = vi.fn();
const actionMock = vi.fn();

vi.mock("@/services/api-client", () => ({
  ApiClientError: class ApiClientError extends Error {
    status: number;
    constructor(message: string, status = 400) {
      super(message);
      this.status = status;
    }
  },
  resourceService: {
    list: (...args: unknown[]) => listMock(...args),
    action: (...args: unknown[]) => actionMock(...args),
    create: vi.fn(),
    update: vi.fn(),
    get: vi.fn(),
  },
}));

import { AssetTransferWorkspace } from "@/components/assets/asset-transfer-workspace";

describe("AssetTransferWorkspace", () => {
  beforeEach(() => {
    searchParams.get.mockImplementation((key: string): string | null =>
      key === "document" ? null : null,
    );
    listMock.mockReset();
    actionMock.mockReset();
    listMock.mockImplementation(async (path: string) => {
      if (String(path).includes("/assets/assets")) {
        return {
          data: {
            items: [
              {
                id: "asset-1",
                asset_code: "AST-001",
                asset_name: "Macbook",
                branch_id: "branch-1",
                status: "active",
              },
            ],
            total: 1,
            page: 1,
            page_size: 100,
          },
        };
      }
      return {
        data: {
          items: [
            {
              id: "xfer-1",
              document_number: "ATRF-2026-000005",
              asset_id: "asset-1",
              from_branch_id: "branch-1",
              to_branch_id: "branch-2",
              from_location_label: "New Delhi",
              to_location_label: "Mumbai",
              status: "draft",
              version: 1,
              effective_date: "2026-09-17",
              reason: "Relocation",
            },
          ],
          total: 1,
          page: 1,
          page_size: 25,
        },
      };
    });
  });

  it("renders transfer register title and document rows", async () => {
    render(<AssetTransferWorkspace />);
    expect(screen.getByRole("heading", { name: "Transfers" })).toBeInTheDocument();
    expect(
      screen.getByText("Manage asset transfer requests and their approval status."),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText("ATRF-2026-000005")).toBeInTheDocument();
    });
    expect(screen.getByText("Macbook")).toBeInTheDocument();
    expect(screen.getByText("New Delhi")).toBeInTheDocument();
    expect(screen.getByText("Mumbai")).toBeInTheDocument();
    expect(screen.getAllByText("Draft").length).toBeGreaterThan(0);
  });

  it("focuses document from query param", async () => {
    searchParams.get.mockImplementation((key: string): string | null =>
      key === "document" ? "ATRF-2026-000005" : null,
    );
    render(<AssetTransferWorkspace />);
    await waitFor(() => {
      expect(screen.getByTestId("transfer-row-ATRF-2026-000005")).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getByText("Transfer detail")).toBeInTheDocument();
      expect(screen.getByText("Submit")).toBeInTheDocument();
      expect(screen.getByText("Cancel")).toBeInTheDocument();
    });
  });
});
