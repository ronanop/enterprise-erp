/** @vitest-environment node */

import { describe, expect, it } from "vitest";
import { formatDropdownLabel } from "@/components/assets/shared/format-dropdown-label";

describe("formatDropdownLabel", () => {
  it("capitalizes the first letter and replaces underscores", () => {
    expect(formatDropdownLabel("draft")).toBe("Draft");
    expect(formatDropdownLabel("in_progress")).toBe("In progress");
    expect(formatDropdownLabel("annual_service")).toBe("Annual service");
    expect(formatDropdownLabel("straight_line")).toBe("Straight line");
  });

  it("leaves already-capitalized labels intact at the first character", () => {
    expect(formatDropdownLabel("Ready to Move")).toBe("Ready to Move");
  });

  it("returns empty for blank input", () => {
    expect(formatDropdownLabel("")).toBe("");
    expect(formatDropdownLabel(null)).toBe("");
    expect(formatDropdownLabel(undefined)).toBe("");
  });
});
