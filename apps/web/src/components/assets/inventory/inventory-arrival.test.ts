import { beforeEach, describe, expect, it } from "vitest";

import {
  consumeInventoryArrival,
  buildAllocationSuccessToast,
  buildReturnSuccessToast,
  inventoryArrivalKeys,
  stashInventoryArrival,
} from "@/components/assets/inventory/inventory-arrival";

beforeEach(() => {
  sessionStorage.removeItem(inventoryArrivalKeys.arrival);
});

describe("inventory arrival payload", () => {
  it("stashes and consumes registration arrival once", () => {
    stashInventoryArrival({
      reason: "register",
      assetId: "asset-1",
      toastMessage: "Asset registered successfully.",
    });
    expect(consumeInventoryArrival()).toMatchObject({
      reason: "register",
      assetId: "asset-1",
      toastMessage: "Asset registered successfully.",
    });
    expect(consumeInventoryArrival()).toBeNull();
  });

  it("stashes and consumes issue arrival once", () => {
    stashInventoryArrival({
      reason: "issue",
      assetId: "asset-9",
      toastMessage: "Asset successfully allocated to Rahul Sharma.",
    });
    expect(consumeInventoryArrival()).toMatchObject({
      reason: "issue",
      assetId: "asset-9",
      toastMessage: "Asset successfully allocated to Rahul Sharma.",
    });
  });

  it("stashes and consumes return arrival once", () => {
    stashInventoryArrival({
      reason: "return",
      assetId: "asset-7",
      toastMessage: "Dell Latitude 7440 returned successfully.",
    });
    expect(consumeInventoryArrival()).toMatchObject({
      reason: "return",
      assetId: "asset-7",
      toastMessage: "Dell Latitude 7440 returned successfully.",
    });
  });

  it("builds allocation toast with employee name", () => {
    expect(buildAllocationSuccessToast("Rahul Sharma")).toBe(
      "Asset successfully allocated to Rahul Sharma.",
    );
    expect(buildAllocationSuccessToast("  ")).toBe("Asset successfully allocated.");
    expect(buildAllocationSuccessToast(null)).toBe("Asset successfully allocated.");
  });

  it("builds return toast with asset name", () => {
    expect(buildReturnSuccessToast("Dell Latitude 7440")).toBe(
      "Dell Latitude 7440 returned successfully.",
    );
    expect(buildReturnSuccessToast("—")).toBe("Asset returned successfully.");
    expect(buildReturnSuccessToast(null)).toBe("Asset returned successfully.");
  });

  it("rejects corrupt JSON", () => {
    sessionStorage.setItem(inventoryArrivalKeys.arrival, "{bad");
    expect(consumeInventoryArrival()).toBeNull();
  });

  it("rejects invalid payloads", () => {
    sessionStorage.setItem(
      inventoryArrivalKeys.arrival,
      JSON.stringify({ reason: "other", assetId: "", toastMessage: "" }),
    );
    expect(consumeInventoryArrival()).toBeNull();
  });
});
