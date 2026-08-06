/** @vitest-environment jsdom */

import { describe, expect, it } from "vitest";

import {
  buildIssueWizardHref,
  buildReturnWizardHref,
  parseAssignmentWizardQuery,
  parseReturnWizardQuery,
} from "@/components/assets/assignment-wizard/assignment-wizard-query";

describe("parseAssignmentWizardQuery", () => {
  it("reads assetId and aliases", () => {
    const q = parseAssignmentWizardQuery(new URLSearchParams("assetId=a1&employee_id=e2"));
    expect(q.assetId).toBe("a1");
    expect(q.employeeId).toBe("e2");
  });

  it("reads draftId and submit flag", () => {
    const q = parseAssignmentWizardQuery(new URLSearchParams("draft_id=d1&submit=true"));
    expect(q.draftId).toBe("d1");
    expect(q.submit).toBe(true);
  });

  it("treats submit=1 as true", () => {
    expect(parseAssignmentWizardQuery(new URLSearchParams("submit=1")).submit).toBe(true);
  });

  it("defaults missing params", () => {
    const q = parseAssignmentWizardQuery(new URLSearchParams(""));
    expect(q.assetId).toBeUndefined();
    expect(q.submit).toBe(false);
  });
});

describe("parseReturnWizardQuery", () => {
  it("reads assetId and intent", () => {
    const q = parseReturnWizardQuery(new URLSearchParams("assetId=x&intent=return"));
    expect(q.assetId).toBe("x");
    expect(q.intent).toBe("return");
  });

  it("reads assignmentId alias", () => {
    const q = parseReturnWizardQuery(new URLSearchParams("assignment_id=asg-1"));
    expect(q.assignmentId).toBe("asg-1");
  });
});

describe("buildIssueWizardHref", () => {
  it("builds base path without query", () => {
    expect(buildIssueWizardHref({})).toBe("/assets/asset-assignments/new");
  });

  it("encodes query params", () => {
    const href = buildIssueWizardHref({ assetId: "a b", employeeId: "e1", draftId: "d1" });
    expect(href).toContain("/assets/asset-assignments/new?");
    expect(href).toContain("assetId=a+b");
    expect(href).toContain("employeeId=e1");
    expect(href).toContain("draftId=d1");
  });
});

describe("buildReturnWizardHref", () => {
  it("includes intent=return", () => {
    expect(buildReturnWizardHref({ assetId: "aid" })).toBe(
      "/assets/asset-assignments/return?assetId=aid&intent=return",
    );
  });
});
