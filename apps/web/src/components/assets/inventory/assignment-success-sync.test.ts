/** @vitest-environment jsdom */

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildAllocationSuccessToast,
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
 * Mirrors IssueAssetWizardPage onSuccess side effects without mounting Next.js page.
 */
function completeAssignmentSuccess(input: {
  assetId: string;
  employeeLabel?: string;
  push: (href: string) => void;
}) {
  const assignmentNav = createAssignmentNavigation(input.push);
  stashInventoryArrival({
    reason: "issue",
    assetId: input.assetId,
    toastMessage: buildAllocationSuccessToast(input.employeeLabel),
  });
  markInventoryStale({ reason: "issue", assetId: input.assetId });
  assignmentNav.openInventory(input.assetId);
}

beforeEach(() => {
  sessionStorage.clear();
  clearInventoryStale();
});

describe("Assignment success → register synchronization", () => {
  it("marks inventory stale for issue reason", () => {
    const push = vi.fn();
    completeAssignmentSuccess({ assetId: "asset-1", employeeLabel: "Rahul Sharma", push });
    expect(peekInventoryStale()).toBe(true);
    expect(consumeInventoryStale()).toMatchObject({ reason: "issue", assetId: "asset-1" });
  });

  it("stashes allocation toast arrival payload", () => {
    const push = vi.fn();
    completeAssignmentSuccess({ assetId: "asset-1", employeeLabel: "Rahul Sharma", push });
    expect(consumeInventoryArrival()).toMatchObject({
      reason: "issue",
      assetId: "asset-1",
      toastMessage: "Asset successfully allocated to Rahul Sharma.",
    });
  });

  it("navigates to inventory with focus asset", () => {
    const push = vi.fn();
    completeAssignmentSuccess({ assetId: "asset-42", employeeLabel: "Asha", push });
    expect(push).toHaveBeenCalledWith("/assets/assets");
    expect(consumeInventoryFocusAsset()).toBe("asset-42");
  });

  it("does not mark stale when caller skips success path", () => {
    expect(peekInventoryStale()).toBe(false);
    expect(consumeInventoryArrival()).toBeNull();
  });

  it("builds toast without employee fallback", () => {
    expect(buildAllocationSuccessToast()).toBe("Asset successfully allocated.");
  });
});
