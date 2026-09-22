import { describe, expect, it } from "vitest";

import { containsUnsafeMarkup, safeHref } from "@/lib/text-safety";

describe("text-safety XSS guards", () => {
  it("rejects iframe javascript payloads", () => {
    const payload = `25KVIVPDUOJL1Z — <iframe src="javascript:alert('XSS')"></iframe>`;
    expect(containsUnsafeMarkup(payload)).toBe(true);
  });

  it("allows plain serials", () => {
    expect(containsUnsafeMarkup("25KVIVPDUOJL1Z")).toBe(false);
  });

  it("blocks javascript hrefs", () => {
    expect(safeHref("javascript:alert(1)")).toBe("#");
    expect(safeHref("/procurement/orders")).toBe("/procurement/orders");
  });
});
