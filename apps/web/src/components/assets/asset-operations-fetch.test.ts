import { describe, expect, it, vi } from "vitest";

import { fetchAssetOperationsData } from "@/components/assets/asset-operations-fetch";
import { BRANCH_ALL_VALUE } from "@/components/assets/shared";

describe("fetchAssetOperationsData", () => {
  it("calls summary, transfers, and assets in parallel", async () => {
    const getDashboardSummary = vi.fn().mockResolvedValue({
      company_id: "c",
      total_assets: 1,
      ready_to_move: 0,
      assigned: 0,
      retired: 0,
      pending_disposal: 0,
      disposed: 0,
    });
    const listTransfers = vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, page_size: 50 });
    const listAssets = vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, page_size: 200 });

    await fetchAssetOperationsData(BRANCH_ALL_VALUE, {
      getDashboardSummary,
      listTransfers,
      listAssets,
    });

    expect(getDashboardSummary).toHaveBeenCalledOnce();
    expect(listTransfers).toHaveBeenCalledWith({ page: 1, page_size: 50 });
    expect(listAssets).toHaveBeenCalledWith({ page: 1, page_size: 200 });
  });

  it("passes location_id when location is selected", async () => {
    const getDashboardSummary = vi.fn().mockResolvedValue({
      company_id: "c",
      total_assets: 0,
      ready_to_move: 0,
      assigned: 0,
      retired: 0,
      pending_disposal: 0,
      disposed: 0,
    });
    const listTransfers = vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, page_size: 50 });
    const listAssets = vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, page_size: 200 });

    await fetchAssetOperationsData("location-uuid", {
      getDashboardSummary,
      listTransfers,
      listAssets,
    });

    expect(getDashboardSummary).toHaveBeenCalledWith({ location_id: "location-uuid" });
  });

  it("omits location_id for All", async () => {
    const getDashboardSummary = vi.fn().mockResolvedValue({
      company_id: "c",
      total_assets: 0,
      ready_to_move: 0,
      assigned: 0,
      retired: 0,
      pending_disposal: 0,
      disposed: 0,
    });
    const listTransfers = vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, page_size: 50 });
    const listAssets = vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, page_size: 200 });

    await fetchAssetOperationsData(BRANCH_ALL_VALUE, {
      getDashboardSummary,
      listTransfers,
      listAssets,
    });

    expect(getDashboardSummary).toHaveBeenCalledWith({});
  });

  it("captures partial API failures", async () => {
    const getDashboardSummary = vi.fn().mockRejectedValue(new Error("summary down"));
    const listTransfers = vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, page_size: 50 });
    const listAssets = vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, page_size: 200 });

    const result = await fetchAssetOperationsData(BRANCH_ALL_VALUE, {
      getDashboardSummary,
      listTransfers,
      listAssets,
    });

    expect(result.summary).toBeNull();
    expect(result.transfersList).not.toBeNull();
    expect(result.errors.summary).toBe("summary down");
  });

  it("captures all failures", async () => {
    const getDashboardSummary = vi.fn().mockRejectedValue(new Error("a"));
    const listTransfers = vi.fn().mockRejectedValue(new Error("b"));
    const listAssets = vi.fn().mockRejectedValue(new Error("c"));

    const result = await fetchAssetOperationsData(BRANCH_ALL_VALUE, {
      getDashboardSummary,
      listTransfers,
      listAssets,
    });

    expect(result.summary).toBeNull();
    expect(result.transfersList).toBeNull();
    expect(result.assetsList).toBeNull();
    expect(result.errors.transfers).toBe("b");
    expect(result.errors.assets).toBe("c");
  });
});
