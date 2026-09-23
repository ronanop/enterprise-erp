import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { DeleteAssetConfirmDialog } from "@/components/assets/delete-asset-confirm-dialog";

describe("DeleteAssetConfirmDialog", () => {
  it("shows asset code in confirmation copy", () => {
    render(
      <DeleteAssetConfirmDialog
        open
        asset={{ id: "a1", assetCode: "AST-2026-000001", assetName: "Dell Latitude" }}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );
    expect(screen.getByTestId("delete-asset-confirm-dialog")).toBeInTheDocument();
    expect(screen.getByText(/Delete Asset\?/i)).toBeInTheDocument();
    expect(screen.getByTestId("delete-asset-confirm-message")).toHaveTextContent(
      "Are you sure you want to delete asset AST-2026-000001?",
    );
    expect(screen.getByTestId("delete-asset-name")).toHaveTextContent("Dell Latitude");
    expect(screen.getByText(/cannot be undone/i)).toBeInTheDocument();
  });

  it("Cancel does not call onConfirm", () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <DeleteAssetConfirmDialog
        open
        asset={{ id: "a1", assetCode: "AST-1", assetName: "Laptop" }}
        onCancel={onCancel}
        onConfirm={onConfirm}
      />,
    );
    fireEvent.click(screen.getByTestId("delete-asset-cancel-button"));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("Delete Asset confirms", () => {
    const onConfirm = vi.fn();
    render(
      <DeleteAssetConfirmDialog
        open
        asset={{ id: "a1", assetCode: "AST-1", assetName: "Laptop" }}
        onCancel={vi.fn()}
        onConfirm={onConfirm}
      />,
    );
    fireEvent.click(screen.getByTestId("delete-asset-confirm-button"));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("surfaces backend validation errors", () => {
    render(
      <DeleteAssetConfirmDialog
        open
        asset={{ id: "a1", assetCode: "AST-1" }}
        error="Cannot delete asset with an active or pending assignment"
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );
    expect(screen.getByTestId("delete-asset-error")).toHaveTextContent(
      /active or pending assignment/i,
    );
  });
});
