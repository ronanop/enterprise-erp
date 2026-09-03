import { describe, expect, it } from "vitest";

import {
  formatGeneratedGrnNumbers,
  uniqueGeneratedGrnNumbers,
} from "@/utils/grn-number-display";

describe("grn-number-display", () => {
  it("splits comma-separated stored GRN labels and dedupes", () => {
    const raw =
      "PO/CDT/017/001, PO/CDT/016/001, PO/CDT/017/001, PO/CDT/016/001";
    expect(uniqueGeneratedGrnNumbers([raw])).toEqual([
      "PO/CDT/017/001",
      "PO/CDT/016/001",
    ]);
    expect(formatGeneratedGrnNumbers([raw])).toBe(
      "PO/CDT/017/001, PO/CDT/016/001",
    );
  });
});
