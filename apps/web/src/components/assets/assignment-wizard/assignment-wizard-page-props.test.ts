import { describe, expect, it } from "vitest";

import {
  assignmentPropsFromSearchParams,
  hasReturnTarget,
  mapAssignmentQueryToContainerProps,
  mapReturnQueryToContainerProps,
  normalizeQueryId,
  returnPropsFromSearchParams,
} from "@/components/assets/assignment-wizard/assignment-wizard-page-props";
import {
  buildIssueWizardHref,
  buildReturnWizardHref,
  parseAssignmentWizardQuery,
  parseReturnWizardQuery,
} from "@/components/assets/assignment-wizard/assignment-wizard-query";

describe("normalizeQueryId", () => {
  it("returns trimmed id", () => {
    expect(normalizeQueryId("  a1  ")).toBe("a1");
  });

  it("returns undefined for empty / whitespace / null", () => {
    expect(normalizeQueryId("")).toBeUndefined();
    expect(normalizeQueryId("   ")).toBeUndefined();
    expect(normalizeQueryId(null)).toBeUndefined();
    expect(normalizeQueryId(undefined)).toBeUndefined();
  });
});

describe("parseAssignmentWizardQuery — Task 5 params", () => {
  it("reads assetId", () => {
    expect(parseAssignmentWizardQuery(new URLSearchParams("assetId=asset-1")).assetId).toBe(
      "asset-1",
    );
  });

  it("reads employeeId", () => {
    expect(parseAssignmentWizardQuery(new URLSearchParams("employeeId=emp-9")).employeeId).toBe(
      "emp-9",
    );
  });

  it("reads draftId", () => {
    expect(parseAssignmentWizardQuery(new URLSearchParams("draftId=d-1")).draftId).toBe("d-1");
  });

  it("supports snake_case aliases", () => {
    const q = parseAssignmentWizardQuery(
      new URLSearchParams("asset_id=a&employee_id=e&draft_id=d"),
    );
    expect(q).toMatchObject({ assetId: "a", employeeId: "e", draftId: "d" });
  });

  it("reads all three together", () => {
    const q = parseAssignmentWizardQuery(
      new URLSearchParams("assetId=a1&employeeId=e1&draftId=d1"),
    );
    expect(q.assetId).toBe("a1");
    expect(q.employeeId).toBe("e1");
    expect(q.draftId).toBe("d1");
  });

  it("missing params are undefined", () => {
    const q = parseAssignmentWizardQuery(new URLSearchParams(""));
    expect(q.assetId).toBeUndefined();
    expect(q.employeeId).toBeUndefined();
    expect(q.draftId).toBeUndefined();
  });
});

describe("parseReturnWizardQuery — Task 5 params", () => {
  it("reads assetId", () => {
    expect(parseReturnWizardQuery(new URLSearchParams("assetId=a1")).assetId).toBe("a1");
  });

  it("reads assignmentId", () => {
    expect(parseReturnWizardQuery(new URLSearchParams("assignmentId=asg-1")).assignmentId).toBe(
      "asg-1",
    );
  });

  it("reads intent=return", () => {
    expect(parseReturnWizardQuery(new URLSearchParams("intent=return")).intent).toBe("return");
  });

  it("supports snake_case aliases", () => {
    const q = parseReturnWizardQuery(
      new URLSearchParams("asset_id=a&assignment_id=asg&intent=return"),
    );
    expect(q).toMatchObject({ assetId: "a", assignmentId: "asg", intent: "return" });
  });

  it("missing params are undefined", () => {
    const q = parseReturnWizardQuery(new URLSearchParams(""));
    expect(q.assetId).toBeUndefined();
    expect(q.assignmentId).toBeUndefined();
    expect(q.intent).toBeUndefined();
  });
});

describe("mapAssignmentQueryToContainerProps", () => {
  it("maps assetId to initialState.assetId", () => {
    const props = mapAssignmentQueryToContainerProps({ assetId: "a1", submit: false });
    expect(props.initialState).toEqual({ assetId: "a1" });
    expect(props.draftId).toBeUndefined();
  });

  it("maps employeeId to initialState.employeeId", () => {
    const props = mapAssignmentQueryToContainerProps({ employeeId: "e1", submit: false });
    expect(props.initialState).toEqual({ employeeId: "e1" });
  });

  it("maps draftId for draft resume", () => {
    const props = mapAssignmentQueryToContainerProps({ draftId: "d1", submit: false });
    expect(props.draftId).toBe("d1");
  });

  it("combines assetId + employeeId prefill", () => {
    const props = mapAssignmentQueryToContainerProps({
      assetId: "a1",
      employeeId: "e1",
      submit: false,
    });
    expect(props.initialState).toEqual({ assetId: "a1", employeeId: "e1" });
  });

  it("draftId with asset/employee still passes both (draft load wins in container)", () => {
    const props = mapAssignmentQueryToContainerProps({
      draftId: "d1",
      assetId: "a1",
      employeeId: "e1",
      submit: false,
    });
    expect(props.draftId).toBe("d1");
    expect(props.initialState).toEqual({ assetId: "a1", employeeId: "e1" });
  });

  it("treats blank assetId as missing", () => {
    const props = mapAssignmentQueryToContainerProps({ assetId: "  ", submit: false });
    expect(props.initialState).toBeUndefined();
    expect(props.query.assetId).toBeUndefined();
  });

  it("treats blank draftId as missing", () => {
    const props = mapAssignmentQueryToContainerProps({ draftId: "", submit: false });
    expect(props.draftId).toBeUndefined();
  });

  it("treats blank employeeId as missing", () => {
    const props = mapAssignmentQueryToContainerProps({ employeeId: "\t", submit: false });
    expect(props.initialState).toBeUndefined();
  });
});

describe("mapReturnQueryToContainerProps", () => {
  it("maps assetId for active assignment lookup", () => {
    const props = mapReturnQueryToContainerProps({ assetId: "a1", intent: "return" });
    expect(props.assetId).toBe("a1");
    expect(props.assignmentId).toBeUndefined();
    expect(props.isReturnIntent).toBe(true);
  });

  it("maps assignmentId for direct load", () => {
    const props = mapReturnQueryToContainerProps({ assignmentId: "asg-1", intent: "return" });
    expect(props.assignmentId).toBe("asg-1");
  });

  it("prefers both when present (container prefers assignmentId)", () => {
    const props = mapReturnQueryToContainerProps({
      assetId: "a1",
      assignmentId: "asg-1",
      intent: "return",
    });
    expect(props.assetId).toBe("a1");
    expect(props.assignmentId).toBe("asg-1");
  });

  it("intent=return is valid", () => {
    const props = mapReturnQueryToContainerProps({ intent: "return" });
    expect(props.isReturnIntent).toBe(true);
    expect(props.hasInvalidIntent).toBe(false);
  });

  it("missing intent is treated as return intent", () => {
    const props = mapReturnQueryToContainerProps({ assetId: "a1" });
    expect(props.isReturnIntent).toBe(true);
    expect(props.hasInvalidIntent).toBe(false);
  });

  it("invalid intent is flagged", () => {
    const props = mapReturnQueryToContainerProps({ assetId: "a1", intent: "issue" });
    expect(props.hasInvalidIntent).toBe(true);
    expect(props.isReturnIntent).toBe(false);
  });

  it("blank assetId is invalid/missing", () => {
    const props = mapReturnQueryToContainerProps({ assetId: "  ", intent: "return" });
    expect(props.assetId).toBeUndefined();
    expect(hasReturnTarget(props)).toBe(false);
  });

  it("blank assignmentId is missing", () => {
    const props = mapReturnQueryToContainerProps({ assignmentId: "" });
    expect(props.assignmentId).toBeUndefined();
  });
});

describe("hasReturnTarget", () => {
  it("true when assetId set", () => {
    expect(hasReturnTarget(mapReturnQueryToContainerProps({ assetId: "a" }))).toBe(true);
  });

  it("true when assignmentId set", () => {
    expect(hasReturnTarget(mapReturnQueryToContainerProps({ assignmentId: "x" }))).toBe(true);
  });

  it("false when neither set", () => {
    expect(hasReturnTarget(mapReturnQueryToContainerProps({}))).toBe(false);
  });
});

describe("assignmentPropsFromSearchParams", () => {
  it("end-to-end maps search string", () => {
    const props = assignmentPropsFromSearchParams(
      new URLSearchParams("assetId=a1&employeeId=e1&draftId=d1"),
    );
    expect(props.draftId).toBe("d1");
    expect(props.initialState).toEqual({ assetId: "a1", employeeId: "e1" });
    expect(props.query).toEqual({ assetId: "a1", employeeId: "e1", draftId: "d1" });
  });

  it("handles missing params", () => {
    const props = assignmentPropsFromSearchParams(new URLSearchParams(""));
    expect(props.draftId).toBeUndefined();
    expect(props.initialState).toBeUndefined();
  });

  it("ignores unknown params", () => {
    const props = assignmentPropsFromSearchParams(new URLSearchParams("foo=bar&assetId=a1"));
    expect(props.initialState).toEqual({ assetId: "a1" });
  });
});

describe("returnPropsFromSearchParams", () => {
  it("end-to-end maps inventory deep link", () => {
    const props = returnPropsFromSearchParams(
      new URLSearchParams("assetId=a1&intent=return"),
    );
    expect(props.assetId).toBe("a1");
    expect(props.isReturnIntent).toBe(true);
    expect(hasReturnTarget(props)).toBe(true);
  });

  it("maps assignmentId deep link", () => {
    const props = returnPropsFromSearchParams(
      new URLSearchParams("assignmentId=asg-9&intent=return"),
    );
    expect(props.assignmentId).toBe("asg-9");
  });

  it("handles missing target params", () => {
    const props = returnPropsFromSearchParams(new URLSearchParams("intent=return"));
    expect(hasReturnTarget(props)).toBe(false);
  });

  it("flags invalid intent", () => {
    const props = returnPropsFromSearchParams(new URLSearchParams("assetId=a1&intent=xfer"));
    expect(props.hasInvalidIntent).toBe(true);
  });
});

describe("buildIssueWizardHref — deep links", () => {
  it("builds assetId only", () => {
    expect(buildIssueWizardHref({ assetId: "a1" })).toBe(
      "/assets/asset-assignments/new?assetId=a1",
    );
  });

  it("builds employeeId only", () => {
    expect(buildIssueWizardHref({ employeeId: "e1" })).toContain("employeeId=e1");
  });

  it("builds draftId resume link", () => {
    expect(buildIssueWizardHref({ draftId: "d1" })).toBe(
      "/assets/asset-assignments/new?draftId=d1",
    );
  });

  it("builds full prefill + draft", () => {
    const href = buildIssueWizardHref({ assetId: "a", employeeId: "e", draftId: "d" });
    expect(href).toContain("assetId=a");
    expect(href).toContain("employeeId=e");
    expect(href).toContain("draftId=d");
  });
});

describe("buildReturnWizardHref — deep links", () => {
  it("builds assetId + intent=return", () => {
    expect(buildReturnWizardHref({ assetId: "aid" })).toBe(
      "/assets/asset-assignments/return?assetId=aid&intent=return",
    );
  });

  it("builds assignmentId + intent", () => {
    const href = buildReturnWizardHref({ assignmentId: "asg-1" });
    expect(href).toContain("assignmentId=asg-1");
    expect(href).toContain("intent=return");
  });

  it("can include both ids", () => {
    const href = buildReturnWizardHref({ assetId: "a1", assignmentId: "asg-1" });
    expect(href).toContain("assetId=a1");
    expect(href).toContain("assignmentId=asg-1");
  });
});
