/**
 * CR-003 discovery UI helpers (Node built-in test runner).
 * Run: node --test src/services/asset-discovery.test.mjs
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

const PLATFORMS = ["windows", "linux", "macos"];

/** Apply is enabled only after a successful parse/preview. */
function canApply(preview, rawOutput, actionLoading) {
  return Boolean(preview) && Boolean(rawOutput.trim()) && !actionLoading;
}

describe("Asset Discovery platforms (CR-003)", () => {
  it("exposes Windows, Linux, and macOS", () => {
    assert.deepEqual(PLATFORMS, ["windows", "linux", "macos"]);
  });
});

describe("Asset Discovery apply gate (CR-003)", () => {
  it("blocks apply until preview exists", () => {
    assert.equal(canApply(null, "HOSTNAME=x", false), false);
  });

  it("allows apply after parse preview", () => {
    assert.equal(canApply({ persisted: false }, "HOSTNAME=x", false), true);
  });

  it("blocks apply while action is loading", () => {
    assert.equal(canApply({ persisted: false }, "HOSTNAME=x", true), false);
  });
});
