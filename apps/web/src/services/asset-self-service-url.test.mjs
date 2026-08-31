/**
 * CR-002 self-service URL builder tests (Node built-in test runner).
 * Run: node --test src/services/asset-self-service-url.test.mjs
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

function buildSelfServiceUrl(assetId, origin) {
  const base = (origin ?? "").replace(/\/$/, "");
  return `${base}/assets/self-service/${assetId}`;
}

describe("buildSelfServiceUrl (CR-002)", () => {
  it("builds absolute path from origin and asset id", () => {
    const id = "11111111-1111-4111-8111-111111111111";
    assert.equal(
      buildSelfServiceUrl(id, "http://localhost:3000"),
      `http://localhost:3000/assets/self-service/${id}`,
    );
  });

  it("strips trailing slash on origin", () => {
    const id = "22222222-2222-4222-8222-222222222222";
    assert.equal(
      buildSelfServiceUrl(id, "https://erp.example.com/"),
      `https://erp.example.com/assets/self-service/${id}`,
    );
  });
});
