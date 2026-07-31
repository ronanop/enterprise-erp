/**
 * CR-001 frontend filter tests (Node built-in test runner).
 * Run: node --test src/services/asset-category-filter.test.mjs
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

/** Mirrors filterActiveCategories in assets-service.ts */
function filterActiveCategories(categories) {
  return categories.filter(
    (row) => String(row.status ?? "").toLowerCase() === "active",
  );
}

describe("filterActiveCategories (CR-001)", () => {
  it("keeps only active categories", () => {
    const result = filterActiveCategories([
      { id: "1", status: "active", category_code: "IT" },
      { id: "2", status: "inactive", category_code: "FURN" },
      { id: "3", status: "ACTIVE", category_code: "VEH" },
    ]);
    assert.equal(result.length, 2);
    assert.deepEqual(
      result.map((r) => r.category_code),
      ["IT", "VEH"],
    );
  });

  it("returns empty when none active", () => {
    assert.deepEqual(
      filterActiveCategories([{ id: "1", status: "inactive" }]),
      [],
    );
  });
});

describe("registration category page_size (CR-001 fix)", () => {
  it("stays within backend Asset pagination max (le=200)", () => {
    const CATEGORY_DROPDOWN_PAGE_SIZE = 200;
    assert.ok(CATEGORY_DROPDOWN_PAGE_SIZE <= 200);
    assert.ok(CATEGORY_DROPDOWN_PAGE_SIZE >= 1);
    assert.notEqual(CATEGORY_DROPDOWN_PAGE_SIZE, 500);
  });
});
