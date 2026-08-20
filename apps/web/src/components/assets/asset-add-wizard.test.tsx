/** @vitest-environment jsdom */

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AssetAddWizard } from "@/components/assets/asset-add-wizard";

const openInventory = vi.fn();
const createMock = vi.fn();
const updateMock = vi.fn();
const actionMock = vi.fn();
const searchCategoriesMock = vi.fn();
const markInventoryStaleMock = vi.fn();
const stashInventoryArrivalMock = vi.fn();

vi.mock("@/lib/auth", () => ({
  isAuthenticated: () => true,
}));

vi.mock("@/lib/org-options", () => ({
  listBranchOptions: async () => [
    { id: "11111111-1111-4111-8111-111111111111", label: "Test Branch" },
  ],
}));

vi.mock("@/components/assets/navigation/use-asset-navigation", () => ({
  useAssetNavigation: () => ({
    openInventory: openInventory,
  }),
}));

vi.mock("@/components/assets/inventory/inventory-refresh", () => ({
  markInventoryStale: (...args: unknown[]) => markInventoryStaleMock(...args),
}));

vi.mock("@/components/assets/inventory/inventory-arrival", () => ({
  stashInventoryArrival: (...args: unknown[]) => stashInventoryArrivalMock(...args),
}));

vi.mock("@/services/assets-service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/assets-service")>();
  return {
    ...actual,
    buildSelfServiceUrl: vi.fn(() => "https://self.service/assets/asset-1"),
    assetCategoryService: {
      search: (...args: unknown[]) => searchCategoriesMock(...args),
    },
    assetRegisterService: {
      create: (...args: unknown[]) => createMock(...args),
      update: (...args: unknown[]) => updateMock(...args),
      action: (...args: unknown[]) => actionMock(...args),
    },
  };
});

beforeEach(() => {
  vi.clearAllMocks();
  searchCategoriesMock.mockResolvedValue({
    items: [{ id: "cat-1", category_code: "IT", category_name: "IT Assets", status: "active" }],
  });
  createMock.mockResolvedValue({ id: "asset-1" });
  updateMock.mockResolvedValue({});
  actionMock.mockResolvedValue({});
});

afterEach(() => {
  cleanup();
});

async function completeWizardToReview(user: ReturnType<typeof userEvent.setup>) {
  render(<AssetAddWizard />);
  await waitFor(() => expect(searchCategoriesMock).toHaveBeenCalled());
  await waitFor(() => expect(screen.getByTestId("register-branch-select")).toBeInTheDocument());
  const textboxes = screen.getAllByRole("textbox");
  await user.type(textboxes[0]!, "Lenovo T14");
  await user.type(textboxes[1]!, "AST-001");
  await user.click(screen.getByRole("button", { name: /^Next$/i }));
  // Classification pre-filled from demo/API categories
  await user.click(screen.getByRole("button", { name: /^Next$/i }));
  await user.click(screen.getByRole("button", { name: /^Next$/i }));
  await user.click(screen.getByRole("button", { name: /^Next$/i }));
  await user.click(screen.getByRole("button", { name: /^Next$/i }));
}

describe("AssetAddWizard registration integration", () => {
  it("shows validation errors and stays on registration when create fails client-side", async () => {
    const user = userEvent.setup();
    render(<AssetAddWizard />);
    await user.click(screen.getByRole("button", { name: /^Review$/i }));
    await user.click(screen.getByRole("button", { name: /Create asset/i }));
    expect(screen.getByRole("alert")).toHaveTextContent(/Asset name is required/i);
    expect(openInventory).not.toHaveBeenCalled();
    expect(createMock).not.toHaveBeenCalled();
  });

  it("navigates to inventory on successful create", async () => {
    const user = userEvent.setup();
    await completeWizardToReview(user);
    await user.click(screen.getByRole("button", { name: /Create asset/i }));
    await waitFor(() => expect(openInventory).toHaveBeenCalledWith("asset-1"));
  });

  it("marks inventory stale and stashes arrival payload on success", async () => {
    const user = userEvent.setup();
    await completeWizardToReview(user);
    await user.click(screen.getByRole("button", { name: /Create asset/i }));
    await waitFor(() => expect(createMock).toHaveBeenCalled());
    expect(markInventoryStaleMock).toHaveBeenCalledWith({ reason: "register", assetId: "asset-1" });
    expect(stashInventoryArrivalMock).toHaveBeenCalledWith({
      reason: "register",
      assetId: "asset-1",
      toastMessage: "Asset registered successfully.",
    });
  });

  it("submits and auto-approves through existing asset register service", async () => {
    const user = userEvent.setup();
    await completeWizardToReview(user);
    await user.click(screen.getByRole("button", { name: /Create asset/i }));
    await waitFor(() => expect(createMock).toHaveBeenCalled());
    expect(actionMock).toHaveBeenNthCalledWith(1, "asset-1", "submit");
    expect(actionMock).toHaveBeenNthCalledWith(2, "asset-1", "approve");
  });

  it("falls back to demo register when API create fails", async () => {
    createMock.mockRejectedValueOnce(new Error("Create blocked"));
    const user = userEvent.setup();
    await completeWizardToReview(user);
    await user.click(screen.getByRole("button", { name: /Create asset/i }));
    await waitFor(() => expect(openInventory).toHaveBeenCalled());
    expect(markInventoryStaleMock).toHaveBeenCalled();
    expect(stashInventoryArrivalMock).toHaveBeenCalled();
  });
});
