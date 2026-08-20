/** @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AssetModuleHub } from "@/components/assets/asset-module-hub";

const push = vi.fn();

vi.mock("@/components/assets/navigation/use-asset-navigation", () => ({
  useAssetNavigation: () => ({
    openInventory: () => push("/assets/assets"),
    openRegisterNew: () => push("/assets/assets/new"),
    openAssignmentWizard: () => push("/assets/asset-assignments/new"),
    openReturnWizard: () => push("/assets/asset-assignments/return?intent=return"),
    openAssignmentList: () => push("/assets/asset-assignments"),
    openOperations: () => push("/assets/operations"),
  }),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("AssetModuleHub", () => {
  it("renders hub landmark and three modules", () => {
    render(<AssetModuleHub />);
    expect(screen.getByTestId("asset-module-hub")).toBeInTheDocument();
    expect(screen.getByTestId("module-asset")).toBeInTheDocument();
    expect(screen.getByTestId("module-allocation")).toBeInTheDocument();
    expect(screen.getByTestId("module-add-asset")).toBeInTheDocument();
  });

  it("shows Asset Management title", () => {
    render(<AssetModuleHub />);
    expect(screen.getByRole("heading", { level: 1, name: "Asset Management" })).toBeInTheDocument();
  });

  it("navigates Asset module to register", async () => {
    const user = userEvent.setup();
    render(<AssetModuleHub />);
    await user.click(screen.getByTestId("module-asset-open"));
    expect(push).toHaveBeenCalledWith("/assets/assets");
  });

  it("navigates Allocate from Asset Allocation module", async () => {
    const user = userEvent.setup();
    render(<AssetModuleHub />);
    await user.click(screen.getByTestId("module-allocation-allocate"));
    expect(push).toHaveBeenCalledWith("/assets/asset-assignments/new");
  });

  it("navigates Return from Asset Allocation module", async () => {
    const user = userEvent.setup();
    render(<AssetModuleHub />);
    await user.click(screen.getByTestId("module-allocation-return"));
    expect(push).toHaveBeenCalledWith(expect.stringContaining("/assets/asset-assignments/return"));
  });

  it("navigates View assignments from Asset Allocation module", async () => {
    const user = userEvent.setup();
    render(<AssetModuleHub />);
    await user.click(screen.getByTestId("module-allocation-list"));
    expect(push).toHaveBeenCalledWith("/assets/asset-assignments");
  });

  it("navigates Add Asset module to registration", async () => {
    const user = userEvent.setup();
    render(<AssetModuleHub />);
    await user.click(screen.getByTestId("module-add-asset-open"));
    expect(push).toHaveBeenCalledWith("/assets/assets/new");
  });

  it("links to full operations workspace", async () => {
    const user = userEvent.setup();
    render(<AssetModuleHub />);
    await user.click(screen.getByTestId("module-hub-operations-link"));
    expect(push).toHaveBeenCalledWith("/assets/operations");
  });
});
