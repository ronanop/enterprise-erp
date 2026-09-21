/** @vitest-environment jsdom */

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn(), prefetch: vi.fn() }),
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
    },
    buildSelfServiceUrl: (id: string) => `/assets/self-service/${id}`,
  };
});

vi.mock("@/services/api-client", () => ({
  ApiClientError: class ApiClientError extends Error {},
  resourceService: {
    list: vi.fn(async () => ({ data: { items: [], total: 0 } })),
  },
}));

import { AssetInformationPortalView } from "@/components/assets/asset-information-portal";

afterEach(() => {
  cleanup();
  getPortal.mockReset();
});

beforeEach(() => {
  push.mockReset();
});

describe("AssetInformationPortalView Overview status", () => {
  it("shows Ready to Move from operational_status instead of submitted", async () => {
    getPortal.mockResolvedValue({
      asset_id: "a1",
      asset_code: "AST-1",
      asset_name: "Laptop",
      asset_type: "fixed",
      status: "submitted",
      operational_status: "READY_TO_MOVE",
      self_service_path: "/assets/self-service/a1",
      assignment: null,
      warranty: null,
      insurance: null,
    });
    render(<AssetInformationPortalView assetId="a1" />);
    const status = await screen.findByTestId("portal-overview-status");
    expect(status).toHaveTextContent("Ready to Move");
    expect(status).not.toHaveTextContent("submitted");
    expect(status).not.toHaveTextContent("Submitted");
  });

  it("shows Assigned when operational_status is ASSIGNED", async () => {
    getPortal.mockResolvedValue({
      asset_id: "a1",
      asset_code: "AST-1",
      asset_name: "Laptop",
      asset_type: "fixed",
      status: "active",
      operational_status: "ASSIGNED",
      self_service_path: "/assets/self-service/a1",
    });
    render(<AssetInformationPortalView assetId="a1" />);
    const status = await screen.findByTestId("portal-overview-status");
    await waitFor(() => expect(status).toHaveTextContent("Assigned"));
    expect(status).not.toHaveTextContent("active");
  });

  it("maps submitted without operational_status to Registered", async () => {
    getPortal.mockResolvedValue({
      asset_id: "a1",
      asset_code: "AST-1",
      asset_name: "Laptop",
      asset_type: "fixed",
      status: "submitted",
      operational_status: null,
      self_service_path: "/assets/self-service/a1",
    });
    render(<AssetInformationPortalView assetId="a1" />);
    const status = await screen.findByTestId("portal-overview-status");
    await waitFor(() => expect(status).toHaveTextContent("Registered"));
    expect(status).not.toHaveTextContent("submitted");
  });
});
