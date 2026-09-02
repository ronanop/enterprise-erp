import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  ASSIGNMENT_DEEP_LINKS,
  assignmentNavigationPaths,
  buildAssignmentWizardHref,
  buildIssueWizardHref,
  buildReturnWizardHref,
  consumeInventoryFocusAsset,
  createAssignmentNavigation,
  stashInventoryFocusAsset,
} from "@/components/assets/navigation/assignment-navigation";
import {
  assignmentPropsFromSearchParams,
  returnPropsFromSearchParams,
} from "@/components/assets/assignment-wizard/assignment-wizard-page-props";

beforeEach(() => {
  sessionStorage.clear();
});

describe("assignmentNavigationPaths", () => {
  it("exposes list / new / return / inventory", () => {
    expect(assignmentNavigationPaths.list).toBe("/assets/asset-assignments");
    expect(assignmentNavigationPaths.new).toBe("/assets/asset-assignments/new");
    expect(assignmentNavigationPaths.return).toBe("/assets/asset-assignments/return");
    expect(assignmentNavigationPaths.inventory).toBe("/assets/assets");
  });
});

describe("buildAssignmentWizardHref", () => {
  it("builds blank new", () => {
    expect(buildAssignmentWizardHref()).toBe("/assets/asset-assignments/new");
  });

  it("builds assetId", () => {
    expect(buildAssignmentWizardHref({ assetId: "a1" })).toContain("assetId=a1");
  });

  it("builds employeeId", () => {
    expect(buildAssignmentWizardHref({ employeeId: "e1" })).toContain("employeeId=e1");
  });

  it("builds draftId", () => {
    expect(buildAssignmentWizardHref({ draftId: "d1" })).toContain("draftId=d1");
  });

  it("aliases buildIssueWizardHref", () => {
    expect(buildIssueWizardHref({ assetId: "x" })).toBe(buildAssignmentWizardHref({ assetId: "x" }));
  });
});

describe("buildReturnWizardHref", () => {
  it("builds assetId + intent", () => {
    expect(buildReturnWizardHref({ assetId: "a1" })).toBe(
      "/assets/asset-assignments/return?assetId=a1&intent=return",
    );
  });

  it("builds assignmentId", () => {
    expect(buildReturnWizardHref({ assignmentId: "asg-1" })).toContain("assignmentId=asg-1");
  });
});

describe("createAssignmentNavigation", () => {
  it("openAssignmentList", () => {
    const push = vi.fn();
    createAssignmentNavigation(push).openAssignmentList();
    expect(push).toHaveBeenCalledWith("/assets/asset-assignments");
  });

  it("openNewAssignment", () => {
    const push = vi.fn();
    createAssignmentNavigation(push).openNewAssignment();
    expect(push).toHaveBeenCalledWith("/assets/asset-assignments/new");
  });

  it("openDraft", () => {
    const push = vi.fn();
    createAssignmentNavigation(push).openDraft("d1");
    expect(push).toHaveBeenCalledWith(expect.stringContaining("draftId=d1"));
  });

  it("openIssue", () => {
    const push = vi.fn();
    createAssignmentNavigation(push).openIssue("a1", { employeeId: "e1" });
    expect(push).toHaveBeenCalledWith(expect.stringContaining("assetId=a1"));
    expect(push.mock.calls[0]?.[0]).toContain("employeeId=e1");
  });

  it("openReturn", () => {
    const push = vi.fn();
    createAssignmentNavigation(push).openReturn("a1");
    expect(push).toHaveBeenCalledWith(
      expect.stringContaining("/assets/asset-assignments/return?assetId=a1"),
    );
  });

  it("openReturnByAssignment", () => {
    const push = vi.fn();
    createAssignmentNavigation(push).openReturnByAssignment("asg-9");
    expect(push).toHaveBeenCalledWith(expect.stringContaining("assignmentId=asg-9"));
  });

  it("openInventory without asset", () => {
    const push = vi.fn();
    createAssignmentNavigation(push).openInventory();
    expect(push).toHaveBeenCalledWith("/assets/assets");
    expect(consumeInventoryFocusAsset()).toBeNull();
  });

  it("openInventory stashes focus asset once", () => {
    const push = vi.fn();
    createAssignmentNavigation(push).openInventory("asset-99");
    expect(push).toHaveBeenCalledWith("/assets/assets");
    expect(consumeInventoryFocusAsset()).toBe("asset-99");
    expect(consumeInventoryFocusAsset()).toBeNull();
  });

  it("exposes href builders on nav object", () => {
    const nav = createAssignmentNavigation(vi.fn());
    expect(nav.buildAssignmentWizardHref({ draftId: "d" })).toContain("draftId=d");
    expect(nav.buildReturnWizardHref({ assetId: "a" })).toContain("intent=return");
  });

  it("does not double-push on openIssue", () => {
    const push = vi.fn();
    createAssignmentNavigation(push).openIssue("a1");
    expect(push).toHaveBeenCalledTimes(1);
  });
});

describe("ASSIGNMENT_DEEP_LINKS catalog", () => {
  it("newBlank", () => {
    expect(ASSIGNMENT_DEEP_LINKS.newBlank()).toBe("/assets/asset-assignments/new");
  });

  it("newAsset", () => {
    expect(ASSIGNMENT_DEEP_LINKS.newAsset("a")).toContain("assetId=a");
  });

  it("newEmployee", () => {
    expect(ASSIGNMENT_DEEP_LINKS.newEmployee("e")).toContain("employeeId=e");
  });

  it("newDraft", () => {
    expect(ASSIGNMENT_DEEP_LINKS.newDraft("d")).toContain("draftId=d");
  });

  it("returnAsset", () => {
    expect(ASSIGNMENT_DEEP_LINKS.returnAsset("a")).toContain("intent=return");
  });

  it("returnAssignment", () => {
    expect(ASSIGNMENT_DEEP_LINKS.returnAssignment("asg")).toContain("assignmentId=asg");
  });

  it("returnAssetIntent matches returnAsset", () => {
    expect(ASSIGNMENT_DEEP_LINKS.returnAssetIntent("a")).toBe(
      ASSIGNMENT_DEEP_LINKS.returnAsset("a"),
    );
  });
});

describe("deep link → container props validation", () => {
  it("/new", () => {
    const props = assignmentPropsFromSearchParams(new URLSearchParams(""));
    expect(props.draftId).toBeUndefined();
    expect(props.initialState).toBeUndefined();
  });

  it("/new?assetId=", () => {
    const href = ASSIGNMENT_DEEP_LINKS.newAsset("asset-1");
    const qs = href.split("?")[1] ?? "";
    const props = assignmentPropsFromSearchParams(new URLSearchParams(qs));
    expect(props.initialState?.assetId).toBe("asset-1");
  });

  it("/new?employeeId=", () => {
    const href = ASSIGNMENT_DEEP_LINKS.newEmployee("emp-1");
    const qs = href.split("?")[1] ?? "";
    const props = assignmentPropsFromSearchParams(new URLSearchParams(qs));
    expect(props.initialState?.employeeId).toBe("emp-1");
  });

  it("/new?draftId=", () => {
    const href = ASSIGNMENT_DEEP_LINKS.newDraft("draft-1");
    const qs = href.split("?")[1] ?? "";
    const props = assignmentPropsFromSearchParams(new URLSearchParams(qs));
    expect(props.draftId).toBe("draft-1");
  });

  it("/return?assetId=", () => {
    const href = ASSIGNMENT_DEEP_LINKS.returnAsset("a1");
    const qs = href.split("?")[1] ?? "";
    const props = returnPropsFromSearchParams(new URLSearchParams(qs));
    expect(props.assetId).toBe("a1");
    expect(props.isReturnIntent).toBe(true);
  });

  it("/return?assignmentId=", () => {
    const href = ASSIGNMENT_DEEP_LINKS.returnAssignment("asg-1");
    const qs = href.split("?")[1] ?? "";
    const props = returnPropsFromSearchParams(new URLSearchParams(qs));
    expect(props.assignmentId).toBe("asg-1");
  });

  it("/return?assetId=&intent=return", () => {
    const href = ASSIGNMENT_DEEP_LINKS.returnAssetIntent("a9");
    const qs = href.split("?")[1] ?? "";
    const props = returnPropsFromSearchParams(new URLSearchParams(qs));
    expect(props.query.intent).toBe("return");
    expect(props.assetId).toBe("a9");
  });
});

describe("focus asset stash", () => {
  it("stash then consume", () => {
    stashInventoryFocusAsset("x");
    expect(consumeInventoryFocusAsset()).toBe("x");
  });

  it("ignores blank", () => {
    stashInventoryFocusAsset("  ");
    expect(consumeInventoryFocusAsset()).toBeNull();
  });
});
