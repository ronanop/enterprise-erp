/** @vitest-environment jsdom */

import { describe, expect, it } from "vitest";

import {
  branchLookupFromOptions,
  formatAssignmentTimestamp,
  kpiShareOfTotal,
  mapAssetListToDisposalQueueRows,
  mapAssetListToReadyQueueRows,
  mapAssignmentsToActivityRows,
  mapDashboardPayloadToViewModel,
  mapDashboardSummaryToKpis,
  resolveBranchLabel,
} from "@/components/assets/dashboard.mapper";
import type { AssetDashboardSummaryDto, AssetPaginatedListResult } from "@/services/assets-service";

const summaryFixture: AssetDashboardSummaryDto = {
  company_id: "c1",
  total_assets: 100,
  ready_to_move: 10,
  assigned: 70,
  retired: 5,
  pending_disposal: 8,
  disposed: 7,
};

const branchLookup = { "b-noida": "Noida", "b-mumbai": "Mumbai" };

describe("mapDashboardSummaryToKpis", () => {
  it("maps all operational buckets", () => {
    expect(mapDashboardSummaryToKpis(summaryFixture)).toEqual({
      totalAssets: 100,
      readyToMove: 10,
      assigned: 70,
      retired: 5,
      pendingDisposal: 8,
      disposed: 7,
    });
  });

  it("defaults missing counts to zero", () => {
    expect(
      mapDashboardSummaryToKpis({
        company_id: "x",
        total_assets: 0,
        ready_to_move: 0,
        assigned: 0,
        retired: 0,
        pending_disposal: 0,
        disposed: 0,
      }),
    ).toEqual({
      totalAssets: 0,
      readyToMove: 0,
      assigned: 0,
      retired: 0,
      pendingDisposal: 0,
      disposed: 0,
    });
  });
});

describe("resolveBranchLabel", () => {
  it("returns label from lookup", () => {
    expect(resolveBranchLabel("b-noida", branchLookup)).toBe("Noida");
  });

  it("returns dash for empty branch", () => {
    expect(resolveBranchLabel(null, branchLookup)).toBe("—");
  });

  it("falls back to short id", () => {
    expect(resolveBranchLabel("abcdefgh-1234", {})).toBe("abcdefgh");
  });
});

describe("mapAssetListToReadyQueueRows", () => {
  const list: AssetPaginatedListResult = {
    items: [
      {
        id: "a1",
        asset_code: "AST-1",
        asset_name: "Laptop",
        branch_id: "b-noida",
      },
    ],
    total: 1,
    page: 1,
    page_size: 10,
  };

  it("maps tag, name, and branch label", () => {
    const rows = mapAssetListToReadyQueueRows(list, branchLookup);
    expect(rows).toHaveLength(1);
    expect(rows[0].cells).toEqual(["AST-1", "Laptop", "Noida"]);
  });

  it("returns empty array for no items", () => {
    expect(mapAssetListToReadyQueueRows({ items: [], total: 0, page: 1, page_size: 10 }, {})).toEqual(
      [],
    );
  });
});

describe("mapAssetListToDisposalQueueRows", () => {
  it("includes operational status badge cell", () => {
    const list: AssetPaginatedListResult = {
      items: [
        {
          id: "a2",
          asset_code: "AST-2",
          asset_name: "Desktop",
          branch_id: "b-mumbai",
          status: "active",
          operational_status: "PENDING_DISPOSAL",
        },
      ],
      total: 1,
      page: 1,
      page_size: 10,
    };
    const rows = mapAssetListToDisposalQueueRows(list, branchLookup);
    expect(rows[0].cells[0]).toBe("AST-2");
    expect(rows[0].cells[1]).toBe("Desktop");
    expect(rows[0].cells[2]).toBe("Mumbai");
    expect(rows[0].cells[3]).toBeTruthy();
  });
});

describe("mapAssignmentsToActivityRows", () => {
  it("maps status, document, and allocated time for active assignments", () => {
    const list: AssetPaginatedListResult = {
      items: [
        {
          id: "as1",
          document_number: "ASN-100",
          asset_id: "asset-uuid",
          status: "active",
          allocated_at: "2026-08-01T10:30:00.000Z",
          returned_at: "2026-08-05T10:30:00.000Z",
        },
      ],
      total: 1,
      page: 1,
      page_size: 10,
    };
    const rows = mapAssignmentsToActivityRows(list);
    expect(rows[0].cells[0]).toBe("active");
    expect(rows[0].cells[1]).toBe("ASN-100");
    expect(rows[0].cells[2]).toContain("2026");
    expect(rows[0].cells[2]).toBe(formatAssignmentTimestamp("2026-08-01T10:30:00.000Z"));
  });

  it("uses returned_at for returned assignments", () => {
    const list: AssetPaginatedListResult = {
      items: [
        {
          id: "as2",
          document_number: "ASN-200",
          status: "returned",
          allocated_at: "2026-07-01T10:30:00.000Z",
          returned_at: "2026-08-05T12:00:00.000Z",
        },
      ],
      total: 1,
      page: 1,
      page_size: 10,
    };
    const rows = mapAssignmentsToActivityRows(list);
    expect(rows[0].cells[2]).toBe(formatAssignmentTimestamp("2026-08-05T12:00:00.000Z"));
  });
});

describe("formatAssignmentTimestamp", () => {
  it("returns dash for invalid values", () => {
    expect(formatAssignmentTimestamp(null)).toBe("—");
    expect(formatAssignmentTimestamp("")).toBe("—");
  });
});

describe("mapDashboardPayloadToViewModel", () => {
  it("combines summary and lists", () => {
    const view = mapDashboardPayloadToViewModel({
      summary: {
        ...summaryFixture,
        by_branch: [
          {
            branch_id: "b-noida",
            total_assets: 40,
            ready_to_move: 5,
            assigned: 30,
            retired: 2,
            pending_disposal: 2,
            disposed: 1,
          },
        ],
      },
      readyList: {
        items: [{ id: "1", asset_code: "AST-9", asset_name: "Tab", branch_id: "b-noida" }],
        total: 4,
        page: 1,
        page_size: 10,
      },
      disposalList: { items: [], total: 2, page: 1, page_size: 10 },
      assignmentsList: { items: [], total: 9, page: 1, page_size: 10 },
      branchLookup,
    });
    expect(view.kpis.totalAssets).toBe(100);
    expect(view.kpiTrends.assigned?.label).toBe("70% of total");
    expect(view.queues.readyRows).toHaveLength(1);
    expect(view.queueTotals).toEqual({ ready: 4, disposal: 2, assignments: 9 });
    expect(view.byBranch).toEqual([
      {
        branchId: "b-noida",
        label: "Noida",
        totalAssets: 40,
        readyToMove: 5,
        assigned: 30,
        retired: 2,
        pendingDisposal: 2,
        disposed: 1,
      },
    ]);
  });
});

describe("kpiShareOfTotal", () => {
  it("returns undefined when total is zero", () => {
    expect(kpiShareOfTotal(5, 0)).toBeUndefined();
  });

  it("rounds percentage of total", () => {
    expect(kpiShareOfTotal(1, 3)?.label).toBe("33% of total");
  });
});

describe("branchLookupFromOptions", () => {
  it("builds id to label map", () => {
    expect(
      branchLookupFromOptions([
        { id: "1", label: "Noida" },
        { id: "2", label: "Mumbai" },
      ]),
    ).toEqual({ "1": "Noida", "2": "Mumbai" });
  });
});
