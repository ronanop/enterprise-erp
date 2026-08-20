/** @vitest-environment jsdom */

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildReturnSuccessToast,
  consumeInventoryArrival,
  stashInventoryArrival,
} from "@/components/assets/inventory/inventory-arrival";
import {
  clearInventoryStale,
  consumeInventoryStale,
  markInventoryStale,
  peekInventoryStale,
} from "@/components/assets/inventory/inventory-refresh";
import { consumeInventoryFocusAsset } from "@/components/assets/inventory/inventory-focus";
import { createAssignmentNavigation } from "@/components/assets/navigation/assignment-navigation";

/**
 * Mirrors ReturnAssetWizardPage onSuccess side effects without mounting Next.js page.
 */
function completeReturnSuccess(input: {
  assetId: string;
  assetName?: string;
  push: (href: string) => void;
}) {
  const assignmentNav = createAssignmentNavigation(input.push);
  stashInventoryArrival({
    reason: "return",
    assetId: input.assetId,
    toastMessage: buildReturnSuccessToast(input.assetName),
  });
  markInventoryStale({ reason: "return", assetId: input.assetId });
  assignmentNav.openInventory(input.assetId);
}

beforeEach(() => {
  sessionStorage.clear();
  clearInventoryStale();
});

describe("Return success → register synchronization", () => {
  it("marks inventory stale for return reason", () => {
    const push = vi.fn();
    completeReturnSuccess({ assetId: "asset-1", assetName: "Dell Latitude 7440", push });
    expect(peekInventoryStale()).toBe(true);
    expect(consumeInventoryStale()).toMatchObject({ reason: "return", assetId: "asset-1" });
  });

  it("stashes return toast arrival payload", () => {
    const push = vi.fn();
    completeReturnSuccess({ assetId: "asset-1", assetName: "Dell Latitude 7440", push });
    expect(consumeInventoryArrival()).toMatchObject({
      reason: "return",
      assetId: "asset-1",
      toastMessage: "Dell Latitude 7440 returned successfully.",
    });
  });

  it("navigates to inventory with focus asset", () => {
    const push = vi.fn();
    completeReturnSuccess({ assetId: "asset-88", assetName: "ThinkPad", push });
    expect(push).toHaveBeenCalledWith("/assets/assets");
    expect(consumeInventoryFocusAsset()).toBe("asset-88");
  });

  it("does not mark stale when caller skips success path", () => {
    expect(peekInventoryStale()).toBe(false);
    expect(consumeInventoryArrival()).toBeNull();
  });

  it("builds toast without asset name fallback", () => {
    expect(buildReturnSuccessToast()).toBe("Asset returned successfully.");
  });
});
