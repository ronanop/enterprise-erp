import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiClientError, resourceService } from "@/services/api-client";
import {
  AssignmentError,
  assignmentFrontendService,
  toAssignmentError,
  type AssignmentDraft,
  type AssignmentResponse,
  type AssignmentReturnRequest,
} from "@/services/assignment-frontend-service";

vi.mock("@/services/api-client", async () => {
  const actual = await vi.importActual<typeof import("@/services/api-client")>("@/services/api-client");
  return {
    ...actual,
    resourceService: {
      get: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      action: vi.fn(),
      list: vi.fn(),
      delete: vi.fn(),
    },
  };
});

const draftBody: AssignmentDraft = {
  asset_id: "asset-1",
  branch_id: "branch-1",
  allocation_type: "employee",
  employee_id: "emp-1",
  delivery_reference_status: "pending",
  assignment_remarks: "demo",
};

const draftResponse: AssignmentResponse = {
  id: "asg-1",
  document_number: "ASN-001",
  asset_id: "asset-1",
  allocation_type: "employee",
  employee_id: "emp-1",
  status: "draft",
  delivery_reference_status: "pending",
  assignment_remarks: "demo",
  branch_id: "branch-1",
  version: 1,
};

const returnBody: AssignmentReturnRequest = {
  return_condition: "good",
  return_remarks: "ok",
  reason: "offboarding",
};

function ok<T>(data: T) {
  return { success: true as const, data };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("toAssignmentError", () => {
  it("passes through AssignmentError", () => {
    const err = new AssignmentError("x", 400);
    expect(toAssignmentError(err)).toBe(err);
  });

  it("maps ApiClientError", () => {
    const err = toAssignmentError(new ApiClientError("bad", 422, ["field"]));
    expect(err).toBeInstanceOf(AssignmentError);
    expect(err.message).toBe("bad");
    expect(err.status).toBe(422);
    expect(err.errors).toEqual(["field"]);
  });

  it("maps network Error", () => {
    const err = toAssignmentError(new Error("offline"));
    expect(err.message).toBe("offline");
    expect(err.status).toBe(0);
  });

  it("uses fallback for unknown", () => {
    expect(toAssignmentError(null, "fb").message).toBe("fb");
  });
});

describe("createDraft", () => {
  it("POSTs draft body and returns response", async () => {
    vi.mocked(resourceService.create).mockResolvedValue(ok(draftResponse));
    const row = await assignmentFrontendService.createDraft(draftBody);
    expect(resourceService.create).toHaveBeenCalledWith("/assets/asset-assignments", draftBody);
    expect(row.id).toBe("asg-1");
    expect(row.status).toBe("draft");
  });

  it("maps API failure to AssignmentError", async () => {
    vi.mocked(resourceService.create).mockRejectedValue(new ApiClientError("validation failed", 400));
    await expect(assignmentFrontendService.createDraft(draftBody)).rejects.toMatchObject({
      name: "AssignmentError",
      message: "validation failed",
      status: 400,
    });
  });

  it("maps network failure", async () => {
    vi.mocked(resourceService.create).mockRejectedValue(
      new ApiClientError("Cannot reach the API. Confirm the backend is running on port 8000.", 0),
    );
    await expect(assignmentFrontendService.createDraft(draftBody)).rejects.toMatchObject({
      status: 0,
      message: expect.stringContaining("Cannot reach"),
    });
  });
});

describe("loadAssignment", () => {
  it("GETs assignment by id", async () => {
    vi.mocked(resourceService.get).mockResolvedValue(ok({ ...draftResponse, status: "active" }));
    const row = await assignmentFrontendService.loadAssignment("asg-1");
    expect(resourceService.get).toHaveBeenCalledWith("/assets/asset-assignments", "asg-1");
    expect(row.status).toBe("active");
  });

  it("throws AssignmentError on 404", async () => {
    vi.mocked(resourceService.get).mockRejectedValue(new ApiClientError("Not found", 404));
    await expect(assignmentFrontendService.loadAssignment("missing")).rejects.toBeInstanceOf(
      AssignmentError,
    );
  });
});

describe("loadDraft", () => {
  it("returns draft when status is draft", async () => {
    vi.mocked(resourceService.get).mockResolvedValue(ok(draftResponse));
    const row = await assignmentFrontendService.loadDraft("asg-1");
    expect(row.status).toBe("draft");
  });

  it("rejects non-draft assignments", async () => {
    vi.mocked(resourceService.get).mockResolvedValue(ok({ ...draftResponse, status: "active" }));
    await expect(assignmentFrontendService.loadDraft("asg-1")).rejects.toMatchObject({
      name: "AssignmentError",
      status: 409,
      message: expect.stringContaining("not a draft"),
    });
  });

  it("propagates load failures", async () => {
    vi.mocked(resourceService.get).mockRejectedValue(new Error("timeout"));
    await expect(assignmentFrontendService.loadDraft("asg-1")).rejects.toMatchObject({
      message: "timeout",
    });
  });
});

describe("updateDraft", () => {
  it("PATCHes draft with version", async () => {
    const body: AssignmentDraft = {
      allocation_type: "employee",
      employee_id: "emp-2",
      version: 1,
      delivery_reference_status: "issued",
      delivery_reference_number: "DR-1",
    };
    vi.mocked(resourceService.update).mockResolvedValue(ok({ ...draftResponse, version: 2 }));
    const row = await assignmentFrontendService.updateDraft("asg-1", body);
    expect(resourceService.update).toHaveBeenCalledWith("/assets/asset-assignments", "asg-1", body);
    expect(row.version).toBe(2);
  });

  it("maps conflict errors", async () => {
    vi.mocked(resourceService.update).mockRejectedValue(new ApiClientError("version conflict", 409));
    await expect(
      assignmentFrontendService.updateDraft("asg-1", { version: 1 }),
    ).rejects.toMatchObject({ status: 409, message: "version conflict" });
  });
});

describe("submitDraft", () => {
  it("POSTs submit action", async () => {
    vi.mocked(resourceService.action).mockResolvedValue(
      ok({ ...draftResponse, status: "submitted" }),
    );
    const row = await assignmentFrontendService.submitDraft("asg-1");
    expect(resourceService.action).toHaveBeenCalledWith(
      "/assets/asset-assignments",
      "asg-1",
      "submit",
    );
    expect(row.status).toBe("submitted");
  });

  it("maps submit API failure", async () => {
    vi.mocked(resourceService.action).mockRejectedValue(new ApiClientError("cannot submit", 422));
    await expect(assignmentFrontendService.submitDraft("asg-1")).rejects.toMatchObject({
      status: 422,
    });
  });
});

describe("activateAssignment", () => {
  it("POSTs approve action", async () => {
    vi.mocked(resourceService.action).mockResolvedValue(ok({ ...draftResponse, status: "active" }));
    const row = await assignmentFrontendService.activateAssignment("asg-1");
    expect(resourceService.action).toHaveBeenCalledWith(
      "/assets/asset-assignments",
      "asg-1",
      "approve",
      { comments: undefined },
    );
    expect(row.status).toBe("active");
  });

  it("forwards optional comments", async () => {
    vi.mocked(resourceService.action).mockResolvedValue(ok({ ...draftResponse, status: "active" }));
    await assignmentFrontendService.activateAssignment("asg-1", "ok");
    expect(resourceService.action).toHaveBeenCalledWith(
      "/assets/asset-assignments",
      "asg-1",
      "approve",
      { comments: "ok" },
    );
  });

  it("maps activate failure", async () => {
    vi.mocked(resourceService.action).mockRejectedValue(new ApiClientError("forbidden", 403));
    await expect(assignmentFrontendService.activateAssignment("asg-1")).rejects.toMatchObject({
      status: 403,
    });
  });
});

describe("returnAsset", () => {
  it("POSTs return with typed body", async () => {
    vi.mocked(resourceService.action).mockResolvedValue(
      ok({ ...draftResponse, status: "returned" }),
    );
    const row = await assignmentFrontendService.returnAsset("asg-1", returnBody);
    expect(resourceService.action).toHaveBeenCalledWith(
      "/assets/asset-assignments",
      "asg-1",
      "return",
      returnBody,
    );
    expect(row.status).toBe("returned");
  });

  it("maps return API failure", async () => {
    vi.mocked(resourceService.action).mockRejectedValue(new ApiClientError("not active", 422));
    await expect(assignmentFrontendService.returnAsset("asg-1", returnBody)).rejects.toMatchObject({
      status: 422,
    });
  });

  it("maps network failure on return", async () => {
    vi.mocked(resourceService.action).mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(assignmentFrontendService.returnAsset("asg-1", returnBody)).rejects.toMatchObject({
      name: "AssignmentError",
      message: "Failed to fetch",
      status: 0,
    });
  });
});

describe("payload mapping", () => {
  it("createDraft forwards enrichment fields", async () => {
    vi.mocked(resourceService.create).mockResolvedValue(ok(draftResponse));
    const body: AssignmentDraft = {
      ...draftBody,
      delivery_reference_number: "DR-9",
      delivery_reference_status: "received",
      expected_return_at: "2026-12-01",
    };
    await assignmentFrontendService.createDraft(body);
    expect(resourceService.create).toHaveBeenCalledWith(
      "/assets/asset-assignments",
      expect.objectContaining({
        delivery_reference_number: "DR-9",
        delivery_reference_status: "received",
        expected_return_at: "2026-12-01",
      }),
    );
  });

  it("returnAsset forwards condition and remarks", async () => {
    vi.mocked(resourceService.action).mockResolvedValue(ok({ ...draftResponse, status: "returned" }));
    await assignmentFrontendService.returnAsset("asg-1", {
      return_condition: "outdated",
      return_remarks: "screen crack",
      reason: "upgrade",
    });
    expect(resourceService.action).toHaveBeenCalledWith(
      "/assets/asset-assignments",
      "asg-1",
      "return",
      {
        return_condition: "outdated",
        return_remarks: "screen crack",
        reason: "upgrade",
      },
    );
  });

  it("list calls existing search endpoint", async () => {
    vi.mocked(resourceService.list).mockResolvedValue(
      ok({ items: [draftResponse], total: 1, page: 1, page_size: 10 }),
    );
    const page = await assignmentFrontendService.list({ status: "draft", page: 1 });
    expect(page.items).toHaveLength(1);
    expect(resourceService.list).toHaveBeenCalledWith("/assets/asset-assignments", {
      status: "draft",
      page: 1,
    });
  });

  it("cancelDraft rejects non-draft assignments", async () => {
    vi.mocked(resourceService.get).mockResolvedValue(ok({ ...draftResponse, status: "active" }));
    await expect(assignmentFrontendService.cancelDraft("asg-1")).rejects.toThrow(/Only draft/);
  });

  it("cancelDraft soft-deletes draft via cancel action", async () => {
    vi.mocked(resourceService.get).mockResolvedValue(ok(draftResponse));
    vi.mocked(resourceService.action).mockResolvedValue(ok({ ...draftResponse, status: "cancelled" }));
    const row = await assignmentFrontendService.cancelDraft("asg-1");
    expect(row.status).toBe("cancelled");
    expect(resourceService.action).toHaveBeenCalledWith(
      "/assets/asset-assignments",
      "asg-1",
      "cancel",
    );
  });
});

describe("compatibility aliases", () => {
  it("getAssignment delegates to loadAssignment", async () => {
    vi.mocked(resourceService.get).mockResolvedValue(ok(draftResponse));
    const row = await assignmentFrontendService.getAssignment("asg-1");
    expect(row.id).toBe("asg-1");
  });

  it("submit delegates to submitDraft", async () => {
    vi.mocked(resourceService.action).mockResolvedValue(
      ok({ ...draftResponse, status: "submitted" }),
    );
    await assignmentFrontendService.submit("asg-1");
    expect(resourceService.action).toHaveBeenCalledWith(
      "/assets/asset-assignments",
      "asg-1",
      "submit",
    );
  });

  it("formatError uses AssignmentError message", () => {
    expect(
      assignmentFrontendService.formatError(new AssignmentError("boom", 500), "fb"),
    ).toBe("boom");
  });
});
