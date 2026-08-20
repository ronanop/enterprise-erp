import { describe, expect, it } from "vitest";

import {
  assertCanDeleteAssignment,
  getAssignmentCrudCapabilities,
} from "@/components/assets/assignment-wizard/assignment-crud-rules";

describe("assignment CRUD rules", () => {
  it("allows edit and delete only for draft", () => {
    const caps = getAssignmentCrudCapabilities("draft");
    expect(caps.canEdit).toBe(true);
    expect(caps.canDelete).toBe(true);
    expect(caps.canReturn).toBe(false);
    expect(caps.canChangeAsset).toBe(true);
  });

  it("allows return for active and locks asset", () => {
    const caps = getAssignmentCrudCapabilities("active");
    expect(caps.canEdit).toBe(false);
    expect(caps.canDelete).toBe(false);
    expect(caps.canReturn).toBe(true);
    expect(caps.canChangeAsset).toBe(false);
  });

  it("forbids deleting active assignments", () => {
    expect(() => assertCanDeleteAssignment("active")).toThrow(/Only draft/);
  });

  it("allows deleting draft assignments", () => {
    expect(() => assertCanDeleteAssignment("draft")).not.toThrow();
  });
});
