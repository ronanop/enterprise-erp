import { describe, expect, it, vi } from "vitest";

import { fetchAssetOperationsData } from "@/components/assets/asset-operations-fetch";
import { BRANCH_ALL_VALUE } from "@/components/assets/shared";

describe("fetchAssetOperationsData", () => {
  it("calls dashboard summary", async () => {
    const getDashboardSummary = vi.fn().mockResolvedValue({
      company_id: "c",
      total_assets: 1,
      ready_to_move: 0,
      assigned: 0,
      retired: 0,
      pending_disposal: 0,
      disposed: 0,
    });

    await fetchAssetOperationsData(BRANCH_ALL_VALUE, { getDashboardSummary });

    expect(getDashboardSummary).toHaveBeenCalledOnce();
    expect(getDashboardSummary).toHaveBeenCalledWith({});
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

    await fetchAssetOperationsData("location-uuid", { getDashboardSummary });

    expect(getDashboardSummary).toHaveBeenCalledWith({ location_id: "location-uuid" });
  });

  it("captures summary failures", async () => {
    const getDashboardSummary = vi.fn().mockRejectedValue(new Error("summary down"));

    const result = await fetchAssetOperationsData(BRANCH_ALL_VALUE, { getDashboardSummary });

    expect(result.summary).toBeNull();
    expect(result.errors.summary).toBe("summary down");
  });
});
