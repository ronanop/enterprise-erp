/**
 * PRD mapping tests (Node built-in test runner).
 * Run: node --test src/domain/asset-prd.test.mjs
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

function isActiveAssignment(row) {
  const s = String(row.status ?? "").toLowerCase();
  return s === "active" || s === "approved";
}

function mapAssetToPrdStatus(asset, assignments = []) {
  const backend = String(asset.status ?? "").toLowerCase();
  const assetId = String(asset.id ?? "");
  if (backend === "disposed" || backend === "written_off") return "disposed";
  if (backend === "in_maintenance") return "under_maintenance";
  if (backend === "cancelled") return "lost";
  if (backend === "submitted" || backend === "approved") return "reserved";
  const hasActive = assignments.some(
    (a) => String(a.asset_id ?? "") === assetId && isActiveAssignment(a),
  );
  if (hasActive) return "assigned";
  if (backend === "active" || backend === "transferred" || backend === "draft") {
    return backend === "draft" ? "reserved" : "available";
  }
  return "available";
}

const ASSET_MANAGEMENT_DASHBOARD_PATHS = [
  "/assets/asset-categories",
  "/assets/assets",
  "/assets/asset-assignments",
  "/assets/asset-maintenances",
];

describe("mapAssetToPrdStatus", () => {
  it("maps disposed backend status", () => {
    assert.equal(mapAssetToPrdStatus({ id: "1", status: "disposed" }, []), "disposed");
  });

  it("maps active asset with assignment to assigned", () => {
    assert.equal(
      mapAssetToPrdStatus({ id: "a1", status: "active" }, [{ asset_id: "a1", status: "active" }]),
      "assigned",
    );
  });

  it("maps active asset without assignment to available", () => {
    assert.equal(mapAssetToPrdStatus({ id: "a1", status: "active" }, []), "available");
  });
});

describe("ASSET_MANAGEMENT_DASHBOARD_PATHS", () => {
  it("excludes legacy component and depreciation endpoints", () => {
    assert.equal(ASSET_MANAGEMENT_DASHBOARD_PATHS.length, 4);
    assert.ok(!ASSET_MANAGEMENT_DASHBOARD_PATHS.some((p) => p.includes("component")));
    assert.ok(!ASSET_MANAGEMENT_DASHBOARD_PATHS.some((p) => p.includes("depreciation")));
  });
});
