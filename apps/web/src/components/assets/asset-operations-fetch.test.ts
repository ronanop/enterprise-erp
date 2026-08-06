import { describe, expect, it, vi } from "vitest";

import { fetchAssetOperationsData } from "@/components/assets/asset-operations-fetch";
import { BRANCH_ALL_VALUE } from "@/components/assets/shared";

describe("fetchAssetOperationsData", () => {
  it("calls all four APIs in parallel", async () => {
    const getDashboardSummary = vi.fn().mockResolvedValue({
      company_id: "c",
      total_assets: 1,
      ready_to_move: 0,
      assigned: 0,
      retired: 0,
      pending_disposal: 0,
      disposed: 0,
    });
    const listAssets = vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, page_size: 10 });
    const listAssignments = vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, page_size: 10 });

    await fetchAssetOperationsData(BRANCH_ALL_VALUE, {
      getDashboardSummary,
      listAssets,
      listAssignments,
    });

    expect(getDashboardSummary).toHaveBeenCalledOnce();
    expect(listAssets).toHaveBeenCalledTimes(2);
    expect(listAssignments).toHaveBeenCalledOnce();
    expect(listAssets).toHaveBeenCalledWith(
      expect.objectContaining({ operational_status: "READY_TO_MOVE", page_size: 10 }),
    );
    expect(listAssets).toHaveBeenCalledWith(
      expect.objectContaining({ operational_status: "PENDING_DISPOSAL", page_size: 10 }),
    );
  });

  it("passes branch_id when branch is selected", async () => {
    const getDashboardSummary = vi.fn().mockResolvedValue({
      company_id: "c",
      total_assets: 0,
      ready_to_move: 0,
      assigned: 0,
      retired: 0,
      pending_disposal: 0,
      disposed: 0,
    });
    const listAssets = vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, page_size: 10 });
    const listAssignments = vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, page_size: 10 });

    await fetchAssetOperationsData("branch-uuid", {
      getDashboardSummary,
      listAssets,
      listAssignments,
    });

    expect(getDashboardSummary).toHaveBeenCalledWith({ branch_id: "branch-uuid" });
    expect(listAssets).toHaveBeenCalledWith(expect.objectContaining({ branch_id: "branch-uuid" }));
    expect(listAssignments).toHaveBeenCalledWith(expect.objectContaining({ branch_id: "branch-uuid" }));
  });

  it("omits branch_id for All", async () => {
    const getDashboardSummary = vi.fn().mockResolvedValue({
      company_id: "c",
      total_assets: 0,
      ready_to_move: 0,
      assigned: 0,
      retired: 0,
      pending_disposal: 0,
      disposed: 0,
    });
    const listAssets = vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, page_size: 10 });
    const listAssignments = vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, page_size: 10 });

    await fetchAssetOperationsData(BRANCH_ALL_VALUE, {
      getDashboardSummary,
      listAssets,
      listAssignments,
    });

    expect(getDashboardSummary).toHaveBeenCalledWith({});
    expect(listAssets).toHaveBeenCalledWith(expect.objectContaining({ branch_id: undefined }));
  });

  it("captures partial API failures", async () => {
    const getDashboardSummary = vi.fn().mockRejectedValue(new Error("summary down"));
    const listAssets = vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, page_size: 10 });
    const listAssignments = vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, page_size: 10 });

    const result = await fetchAssetOperationsData(BRANCH_ALL_VALUE, {
      getDashboardSummary,
      listAssets,
      listAssignments,
    });

    expect(result.summary).toBeNull();
    expect(result.readyList).not.toBeNull();
    expect(result.errors.summary).toBe("summary down");
  });

  it("captures all failures", async () => {
    const getDashboardSummary = vi.fn().mockRejectedValue(new Error("a"));
    const listAssets = vi.fn().mockRejectedValue(new Error("b"));
    const listAssignments = vi.fn().mockRejectedValue(new Error("c"));

    const result = await fetchAssetOperationsData(BRANCH_ALL_VALUE, {
      getDashboardSummary,
      listAssets,
      listAssignments,
    });

    expect(result.summary).toBeNull();
    expect(result.readyList).toBeNull();
    expect(result.disposalList).toBeNull();
    expect(result.assignmentsList).toBeNull();
    expect(result.errors.ready).toBe("b");
    expect(result.errors.disposal).toBe("b");
    expect(result.errors.assignments).toBe("c");
  });
});
