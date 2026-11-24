/** @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
const listResource = vi.fn(async () => ({ data: { items: [], total: 0 } }));
let searchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => searchParams,
}));

vi.mock("@/lib/auth", () => ({
  isAuthenticated: () => true,
}));

vi.mock("@/lib/org-options", () => ({
  listEmployeeDirectory: vi.fn(async () => []),
  employeeDirectoryById: () => ({}),
}));

const getPortal = vi.fn();

vi.mock("@/services/assets-service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/assets-service")>();
  return {
    ...actual,
    assetInformationPortalService: {
      getPortal: (...args: unknown[]) => getPortal(...args),
      getSelfService: vi.fn(),
      getLifecycleTimeline: vi.fn(async () => []),
    },
    buildSelfServiceUrl: (id: string) => `/assets/information-portal/${id}?from=qr`,
    buildAssetQrUrl: (id: string) => `/assets/information-portal/${id}?from=qr`,
  };
});

vi.mock("@/services/api-client", () => ({
  ApiClientError: class ApiClientError extends Error {
    status: number;
    constructor(message: string, status = 400) {
      super(message);
      this.status = status;
    }
  },
  resourceService: {
    list: (...args: unknown[]) => listResource(...args),
  },
}));

import { AssetInformationPortalView } from "@/components/assets/asset-information-portal";

afterEach(() => {
  cleanup();
  getPortal.mockReset();
  listResource.mockReset();
});

beforeEach(() => {
  push.mockReset();
  searchParams = new URLSearchParams();
  listResource.mockResolvedValue({ data: { items: [], total: 0 } });
});

describe("AssetInformationPortalView tabs", () => {
  it("starts on Assignment History and has no Overview tab", async () => {
    getPortal.mockResolvedValue({
      asset_id: "a1",
      asset_code: "AST-1",
      asset_name: "Laptop",
      asset_type: "fixed",
      status: "active",
      operational_status: "READY_TO_MOVE",
      self_service_path: "/assets/information-portal/a1?from=qr",
    });
    render(<AssetInformationPortalView assetId="a1" />);
    expect(await screen.findByTestId("portal-tab-assignments")).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.queryByTestId("portal-tab-overview")).not.toBeInTheDocument();
    expect(screen.queryByTestId("portal-overview-panel")).not.toBeInTheDocument();
  });
});

describe("AssetInformationPortalView Maintenance History", () => {
  it("shows timeline and work-order columns for maintenance cycles", async () => {
    getPortal.mockResolvedValue({
      asset_id: "a1",
      asset_code: "ASSET-000097",
      asset_name: "Laptop",
      asset_type: "fixed",
      status: "active",
      operational_status: "READY_TO_MOVE",
      self_service_path: "/assets/information-portal/a1?from=qr",
    });
    listResource.mockImplementation(async (path: string) => {
      if (String(path).includes("asset-maintenances")) {
        return {
          data: {
            items: [
              {
                id: "m1",
                document_number: "AMNT-0001",
                status: "completed",
                maintenance_type: "corrective",
                reason: "Battery replacement",
                created_at: "2026-09-12T08:00:00.000Z",
                completed_date: "2026-09-14",
                expected_duration_days: 2,
                expected_return_date: "2026-09-14",
              },
            ],
            total: 1,
          },
        };
      }
      return { data: { items: [], total: 0 } };
    });

    const user = userEvent.setup();
    render(<AssetInformationPortalView assetId="a1" />);
    await screen.findByTestId("portal-tab-assignments");
    await user.click(screen.getByTestId("portal-tab-maintenance"));

    const timeline = await screen.findByTestId("portal-maintenance-timeline");
    expect(timeline).toHaveTextContent("Maintenance cycle completed");
    expect(timeline).toHaveTextContent("AMNT-0001");
    expect(timeline).not.toHaveTextContent("Battery replacement");

    const table = screen.getByTestId("portal-maintenance-table");
    expect(table).toHaveTextContent("Document");
    expect(table).toHaveTextContent("Entered");
    expect(table).toHaveTextContent("Completed");
    expect(table).not.toHaveTextContent("Reason");
    expect(table).toHaveTextContent("AMNT-0001");
    expect(table).not.toHaveTextContent("Battery replacement");
    expect(table).toHaveTextContent("corrective");
  });

  it("shows empty timeline and table messaging when there are no work orders", async () => {
    getPortal.mockResolvedValue({
      asset_id: "a1",
      asset_code: "ASSET-000097",
      asset_name: "Laptop",
      asset_type: "fixed",
      status: "active",
      operational_status: "READY_TO_MOVE",
      self_service_path: "/assets/information-portal/a1?from=qr",
    });

    const user = userEvent.setup();
    render(<AssetInformationPortalView assetId="a1" />);
    await screen.findByTestId("portal-tab-assignments");
    await user.click(screen.getByTestId("portal-tab-maintenance"));

    expect(await screen.findByTestId("portal-maintenance-timeline")).toHaveTextContent(
      "No maintenance history",
    );
    expect(screen.getByTestId("portal-maintenance-table")).toHaveTextContent("No work orders");
    expect(screen.queryByText("No records.")).not.toBeInTheDocument();
  });

  it("shows scanned banner without QR panel when opened from a scan", async () => {
    searchParams = new URLSearchParams("from=qr");
    getPortal.mockResolvedValue({
      asset_id: "a1",
      asset_code: "ASSET-000097",
      asset_name: "Laptop",
      asset_type: "fixed",
      status: "active",
      operational_status: "READY_TO_MOVE",
      self_service_path: "/assets/information-portal/a1?from=qr",
    });

    render(<AssetInformationPortalView assetId="a1" />);
    expect(screen.queryByTestId("portal-qr-section")).not.toBeInTheDocument();
    expect(await screen.findByTestId("portal-scanned-banner")).toHaveTextContent("Scanned QR");
    expect(screen.getByTestId("portal-tab-assignments")).toBeInTheDocument();
  });
});
