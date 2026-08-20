import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  clearInventoryStale,
  consumeInventoryStale,
  inventoryRefreshKeys,
  markInventoryStale,
  peekInventoryStale,
} from "@/components/assets/inventory/inventory-refresh";

beforeEach(() => {
  clearInventoryStale();
});

describe("markInventoryStale / consumeInventoryStale", () => {
  it("marks issue stale with assetId", () => {
    markInventoryStale({ reason: "issue", assetId: "a1" });
    expect(peekInventoryStale()).toBe(true);
    const payload = consumeInventoryStale();
    expect(payload).toMatchObject({ reason: "issue", assetId: "a1" });
    expect(typeof payload?.at).toBe("number");
  });

  it("marks return stale", () => {
    markInventoryStale({ reason: "return", assetId: "a2" });
    expect(consumeInventoryStale()?.reason).toBe("return");
  });

  it("marks register stale", () => {
    markInventoryStale({ reason: "register", assetId: "a3" });
    expect(consumeInventoryStale()).toMatchObject({ reason: "register", assetId: "a3" });
  });

  it("consume clears the flag", () => {
    markInventoryStale({ reason: "issue" });
    consumeInventoryStale();
    expect(peekInventoryStale()).toBe(false);
    expect(consumeInventoryStale()).toBeNull();
  });

  it("returns null when empty", () => {
    expect(consumeInventoryStale()).toBeNull();
  });

  it("clearInventoryStale removes key", () => {
    markInventoryStale({ reason: "return" });
    clearInventoryStale();
    expect(peekInventoryStale()).toBe(false);
  });

  it("rejects corrupt JSON", () => {
    sessionStorage.setItem(inventoryRefreshKeys.stale, "{not-json");
    expect(consumeInventoryStale()).toBeNull();
    expect(peekInventoryStale()).toBe(false);
  });

  it("rejects invalid reason payload", () => {
    sessionStorage.setItem(
      inventoryRefreshKeys.stale,
      JSON.stringify({ reason: "other", at: 1 }),
    );
    expect(consumeInventoryStale()).toBeNull();
  });

  it("allows issue without assetId", () => {
    markInventoryStale({ reason: "issue" });
    expect(consumeInventoryStale()?.assetId).toBeUndefined();
  });
});
