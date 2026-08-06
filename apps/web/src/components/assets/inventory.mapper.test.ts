import { describe, expect, it } from "vitest";

import {
  applyClientInventoryFilters,
  buildInventoryListQuery,
  indexActiveAssignments,
  mapAssetToInventoryRow,
  resolveOperationalStatusForQuery,
} from "@/components/assets/inventory.mapper";
import { EMPTY_INVENTORY_FILTERS } from "@/components/assets/shared";
import { BRANCH_ALL_VALUE } from "@/components/assets/shared";

describe("resolveOperationalStatusForQuery", () => {
  it("uses preset when filter operational is empty", () => {
    expect(resolveOperationalStatusForQuery("ready", EMPTY_INVENTORY_FILTERS)).toBe("READY_TO_MOVE");
  });

  it("prefers explicit filter over preset", () => {
    expect(
      resolveOperationalStatusForQuery("all", {
        ...EMPTY_INVENTORY_FILTERS,
        operationalStatus: "ASSIGNED",
      }),
    ).toBe("ASSIGNED");
  });
});

describe("buildInventoryListQuery", () => {
  it("maps search and preset operational status", () => {
    const q = buildInventoryListQuery({
      preset: "assigned",
      filters: { ...EMPTY_INVENTORY_FILTERS, search: "laptop" },
      headerBranchId: BRANCH_ALL_VALUE,
      page: 2,
      pageSize: 25,
    });
    expect(q).toMatchObject({
      page: 2,
      page_size: 25,
      q: "laptop",
      operational_status: "ASSIGNED",
    });
  });

  it("uses header branch when set", () => {
    const q = buildInventoryListQuery({
      preset: "all",
      filters: EMPTY_INVENTORY_FILTERS,
      headerBranchId: "branch-1",
      page: 1,
      pageSize: 25,
    });
    expect(q.branch_id).toBe("branch-1");
  });

  it("includes lifecycle and category filters", () => {
    const q = buildInventoryListQuery({
      preset: "all",
      filters: {
        ...EMPTY_INVENTORY_FILTERS,
        lifecycleStatus: "active",
        categoryId: "cat-1",
      },
      headerBranchId: BRANCH_ALL_VALUE,
      page: 1,
      pageSize: 25,
    });
    expect(q.status).toBe("active");
    expect(q.asset_category_id).toBe("cat-1");
  });
});

describe("indexActiveAssignments", () => {
  it("indexes only active assignments per asset", () => {
    const map = indexActiveAssignments([
      { id: "1", asset_id: "a1", status: "active" },
      { id: "2", asset_id: "a1", status: "returned" },
      { id: "3", asset_id: "a2", status: "approved" },
    ]);
    expect(map.size).toBe(2);
    expect(map.get("a1")?.id).toBe("1");
  });
});

describe("mapAssetToInventoryRow", () => {
  it("maps core columns from asset and assignment", () => {
    const row = mapAssetToInventoryRow(
      {
        id: "asset-1",
        asset_code: "AST-9",
        asset_name: "Laptop",
        branch_id: "b1",
        department_id: "d1",
        operational_status: "ASSIGNED",
        status: "active",
        discovery_profile_json: { manufacturer: "Dell", model: "XPS", cpu: "i7", ram: "16GB" },
      },
      {
        branchLabels: { b1: "Noida" },
        departmentLabels: { d1: "IT" },
        categoryLabels: {},
        locationLabels: { b1: "Noida HQ" },
        assignmentsByAssetId: new Map([
          [
            "asset-1",
            {
              id: "asn-1",
              employee_id: "emp-1",
              allocated_at: "2026-08-01T10:00:00.000Z",
              status: "active",
            },
          ],
        ]),
      },
    );
    expect(row.assetTag).toBe("AST-9");
    expect(row.manufacturer).toBe("Dell");
    expect(row.branch).toBe("Noida");
    expect(row.department).toBe("IT");
    expect(row.operationalStatus).toBe("ASSIGNED");
    expect(row.issueDate).toContain("2026");
  });
});

describe("applyClientInventoryFilters", () => {
  it("filters by department and asset type", () => {
    const rows = [
      {
        id: "1",
        assetTag: "A",
        laptopName: "X",
        manufacturer: "—",
        model: "—",
        configuration: "—",
        currentHolder: "—",
        employeeId: "—",
        department: "IT",
        branch: "—",
        operationalStatus: "—",
        lifecycleStatus: "—",
        issueDate: "—",
        location: "—",
        expandable: {
          earlierUsedBy: "—",
          deliveryChallan: "—",
          deliveryReferenceStatus: "—",
          phoneNumber: "—",
          remarks: "—",
          assignmentRemarks: "—",
          returnRemarks: "—",
        },
        assignmentHistory: [],
      },
    ];
    const filtered = applyClientInventoryFilters(
      rows,
      { ...EMPTY_INVENTORY_FILTERS, departmentId: "d1" },
      [{ id: "1", department_id: "d1", asset_type: "fixed" }],
    );
    expect(filtered).toHaveLength(1);

    const none = applyClientInventoryFilters(
      rows,
      { ...EMPTY_INVENTORY_FILTERS, departmentId: "other" },
      [{ id: "1", department_id: "d1" }],
    );
    expect(none).toHaveLength(0);
  });
});
