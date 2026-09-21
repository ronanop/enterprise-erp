/** @vitest-environment jsdom */

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  AssetDisposalWorkspace,
  disposalRecordStatusLabel,
  formatAssetOptionLabel,
  formatDisposalGateError,
  isDisposalEligibleAsset,
} from "@/components/assets/asset-disposal-workspace";

const listMock = vi.fn();
const createMock = vi.fn();
const getMock = vi.fn();

vi.mock("@/lib/auth", () => ({
  isAuthenticated: () => true,
  getAccessTokenUserId: () => "user-1",
}));

vi.mock("@/services/api-client", async () => {
  const actual = await vi.importActual<typeof import("@/services/api-client")>(
    "@/services/api-client",
  );
  return {
    ...actual,
    resourceService: {
      list: (...args: unknown[]) => listMock(...args),
      create: (...args: unknown[]) => createMock(...args),
      get: (...args: unknown[]) => getMock(...args),
    },
  };
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function readyAsset(overrides: Record<string, unknown> = {}) {
  return {
    id: "asset-1",
    asset_code: "AST-000123",
    asset_name: "Laptop Dell Latitude 5420",
    branch_id: "branch-1",
    status: "active",
    operational_status: "READY_TO_MOVE",
    serial_number: "ABC123456",
    make: "Dell",
    model: "Latitude 5420",
    asset_type_name: "Laptop",
    ...overrides,
  };
}

beforeEach(() => {
  listMock.mockImplementation(async (path: string) => {
    if (String(path).includes("asset-disposals")) {
      return { data: { items: [], total: 0, page: 1, page_size: 25 } };
    }
    return { data: { items: [readyAsset()], total: 1, page: 1, page_size: 200 } };
  });
  createMock.mockResolvedValue({
    data: {
      id: "d1",
      document_number: "ADISP-1",
      status: "draft",
      disposal_type: "scrap",
      remarks: "EOL",
    },
  });
  getMock.mockResolvedValue({ data: readyAsset() });
});

describe("disposal helpers", () => {
  it("accepts Ready/Assigned/Retired only for picker eligibility", () => {
    expect(isDisposalEligibleAsset({ operational_status: "READY_TO_MOVE" })).toBe(true);
    expect(isDisposalEligibleAsset({ operational_status: "ASSIGNED" })).toBe(true);
    expect(isDisposalEligibleAsset({ operational_status: "RETIRED" })).toBe(true);
    expect(isDisposalEligibleAsset({ operational_status: "PENDING_DISPOSAL" })).toBe(false);
    expect(isDisposalEligibleAsset({ operational_status: "DISPOSED" })).toBe(false);
  });

  it("maps record status labels", () => {
    expect(disposalRecordStatusLabel("posted")).toBe("Disposed");
    expect(disposalRecordStatusLabel("draft")).toBe("Sent to Disposal");
  });

  it("builds rich labels and remarks gate message", () => {
    expect(formatAssetOptionLabel(readyAsset())).toContain("AST-000123");
    expect(formatDisposalGateError("Remarks are required").title).toMatch(/Remarks/i);
  });
});

describe("AssetDisposalWorkspace", () => {
  it("loads inventory assets via /assets/assets query", async () => {
    render(<AssetDisposalWorkspace />);
    await waitFor(() => expect(listMock).toHaveBeenCalled());
    expect(
      listMock.mock.calls.some(
        (c) => String(c[0]) === "/assets/assets" || String(c[0]).startsWith("/assets/assets"),
      ),
    ).toBe(true);
  });

  it("shows asset select when eligible assets exist", async () => {
    render(<AssetDisposalWorkspace />);
    expect(await screen.findByTestId("disposal-asset-select")).toBeInTheDocument();
  });

  it("shows empty state when no eligible assets", async () => {
    listMock.mockImplementation(async (path: string) => {
      if (String(path).includes("asset-disposals")) {
        return { data: { items: [], total: 0, page: 1, page_size: 25 } };
      }
      return { data: { items: [], total: 0, page: 1, page_size: 200 } };
    });
    render(<AssetDisposalWorkspace />);
    expect(await screen.findByTestId("disposal-no-eligible-assets")).toHaveTextContent(
      /No assets are available to send to disposal/i,
    );
  });

  it("still loads assets when disposal list fails", async () => {
    listMock.mockImplementation(async (path: string, query?: Record<string, unknown>) => {
      if (String(path).includes("asset-disposals") && !query?.q) {
        // first disposals calls used by loadAssets / load
        throw new Error("disposals down");
      }
      if (String(path).includes("asset-disposals")) {
        throw new Error("disposals down");
      }
      return { data: { items: [readyAsset()], total: 1, page: 1, page_size: 200 } };
    });
    render(<AssetDisposalWorkspace />);
    expect(await screen.findByTestId("disposal-asset-select")).toBeInTheDocument();
  });

  it("renders Scrap-only type, remarks, and Send to Disposal", async () => {
    render(<AssetDisposalWorkspace />);
    expect(await screen.findByTestId("disposal-send-button")).toHaveTextContent(
      /Send to Disposal/i,
    );
    expect(screen.getByTestId("disposal-remarks")).toHaveAttribute(
      "placeholder",
      expect.stringMatching(/reason for sending this asset to disposal/i),
    );
    expect(screen.getByTestId("disposal-type-select")).toBeInTheDocument();
    expect(screen.queryByLabelText(/Book Value/i)).not.toBeInTheDocument();
    expect(screen.queryByTestId("disposal-ceo-instruction")).not.toBeInTheDocument();
  });

  it("requires remarks before create", async () => {
    const user = userEvent.setup();
    render(<AssetDisposalWorkspace />);
    const select = await screen.findByTestId("disposal-asset-select");
    await user.selectOptions(select, "asset-1");
    await user.click(screen.getByTestId("disposal-send-button"));
    expect(await screen.findByTestId("disposal-gate-error")).toHaveTextContent(/Remarks/i);
    expect(createMock).not.toHaveBeenCalled();
  });

  it("creates scrap disposal with remarks and shows Disposed status", async () => {
    const user = userEvent.setup();
    let disposals: unknown[] = [];
    listMock.mockImplementation(async (path: string) => {
      if (String(path).includes("asset-disposals")) {
        return { data: { items: disposals, total: disposals.length, page: 1, page_size: 25 } };
      }
      return { data: { items: [readyAsset()], total: 1, page: 1, page_size: 200 } };
    });
    createMock.mockImplementation(async () => {
      disposals = [
        {
          id: "d1",
          document_number: "ADISP-1",
          asset_id: "asset-1",
          disposal_type: "scrap",
          remarks: "Broken beyond repair",
          status: "posted",
          version: 1,
          branch_id: "branch-1",
        },
      ];
      return { data: disposals[0] };
    });
    render(<AssetDisposalWorkspace />);
    const select = await screen.findByTestId("disposal-asset-select");
    await user.selectOptions(select, "asset-1");
    await user.type(screen.getByTestId("disposal-remarks"), "Broken beyond repair");
    await user.click(screen.getByTestId("disposal-send-button"));
    await waitFor(() => expect(createMock).toHaveBeenCalled());
    expect(createMock.mock.calls[0]?.[1]).toMatchObject({
      asset_id: "asset-1",
      disposal_type: "scrap",
      remarks: "Broken beyond repair",
      branch_id: "branch-1",
    });
    expect(await screen.findByTestId("disposal-success")).toHaveTextContent(
      /Asset disposed successfully/i,
    );
    expect(await screen.findByText("Disposed")).toBeInTheDocument();
  });

  it("shows existing disposal records with remarks", async () => {
    listMock.mockImplementation(async (path: string) => {
      if (String(path).includes("asset-disposals")) {
        return {
          data: {
            items: [
              {
                id: "d1",
                document_number: "ADISP-2026-000001",
                asset_id: "asset-1",
                disposal_type: "scrap",
                remarks: "End of life",
                status: "draft",
                version: 1,
                branch_id: "branch-1",
              },
            ],
            total: 1,
            page: 1,
            page_size: 25,
          },
        };
      }
      return { data: { items: [readyAsset()], total: 1, page: 1, page_size: 200 } };
    });
    render(<AssetDisposalWorkspace />);
    expect(await screen.findByText("ADISP-2026-000001")).toBeInTheDocument();
    expect(screen.getByText("End of life")).toBeInTheDocument();
    expect(screen.getByText("Sent to Disposal")).toBeInTheDocument();
  });
});
