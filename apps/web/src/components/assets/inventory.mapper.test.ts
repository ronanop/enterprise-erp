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
      headerLocationId: BRANCH_ALL_VALUE,
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

  it("uses header location when set", () => {
    const q = buildInventoryListQuery({
      preset: "all",
      filters: EMPTY_INVENTORY_FILTERS,
      headerLocationId: "loc-mumbai",
      page: 1,
      pageSize: 25,
    });
    expect(q.location_id).toBe("loc-mumbai");
    expect(q.branch_id).toBeUndefined();
  });

  it("ignores removed advanced filters in the list query", () => {
    const q = buildInventoryListQuery({
      preset: "all",
      filters: {
        ...EMPTY_INVENTORY_FILTERS,
        lifecycleStatus: "active",
        categoryId: "cat-1",
        departmentId: "dept-1",
        assetType: "type-1",
        locationId: "loc-1",
        assignmentState: "assigned",
        branchId: "b1",
      },
      headerLocationId: BRANCH_ALL_VALUE,
      page: 1,
      pageSize: 25,
    });
    expect(q).toEqual({
      page: 1,
      page_size: 25,
      q: undefined,
      operational_status: undefined,
      location_id: undefined,
    });
  });

  it("does not send location_id when All locations selected", () => {
    const q = buildInventoryListQuery({
      preset: "all",
      filters: { ...EMPTY_INVENTORY_FILTERS, locationId: BRANCH_ALL_VALUE },
      headerLocationId: BRANCH_ALL_VALUE,
      page: 1,
      pageSize: 25,
    });
    expect(q.location_id).toBeUndefined();
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
              allocation_type: "employee",
            },
          ],
        ]),
        employeeLookup: {
          "emp-1": {
            label: "Asha Nair (EMP-001)",
            displayName: "Asha Nair",
            employeeCode: "EMP-001",
            mobile: "9000000001",
          },
        },
      },
    );
    expect(row.assetTag).toBe("AST-9");
    expect(row.manufacturer).toBe("Dell");
    expect(row.serialNumber).toBe("—");
    expect(row.branch).toBe("Noida");
    expect(row.department).toBe("IT");
    expect(row.operationalStatus).toBe("ASSIGNED");
    expect(row.issueDate).toContain("2026");
    expect(row.location).toBe("—");
    expect(row.employeeId).toBe("EMP-001");
    expect(row.currentHolder).toContain("Asha");
    expect(row.expandable.phoneNumber).toBe("9000000001");
    expect(row.activeAssignmentId).toBe("asn-1");
    expect(row.assignmentAllocationType).toBe("employee");
  });

  it("prefers persisted make/model/configuration and asset location", () => {
    const row = mapAssetToInventoryRow(
      {
        id: "asset-2",
        asset_code: "AST-2",
        asset_name: "Laptop",
        branch_id: "b1",
        serial_number: "SN-99",
        make: "Lenovo",
        model: "T14",
        configuration: "i7 · 32GB",
        discovery_profile_json: { manufacturer: "Dell", model: "XPS" },
      },
      {
        branchLabels: { b1: "Noida" },
        departmentLabels: {},
        categoryLabels: {},
        locationLabels: { "asset-2": "Rack A-12" },
        assignmentsByAssetId: new Map(),
      },
    );
    expect(row.manufacturer).toBe("Lenovo");
    expect(row.model).toBe("T14");
    expect(row.configuration).toBe("i7 · 32GB");
    expect(row.serialNumber).toBe("SN-99");
    expect(row.location).toBe("Rack A-12");
  });
});

describe("applyClientInventoryFilters", () => {
  it("is a no-op (Phase 5F server-side filtering)", () => {
    const rows = [
      {
        id: "1",
        assetTag: "A",
        laptopName: "X",
        serialNumber: "—",
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
      { ...EMPTY_INVENTORY_FILTERS, departmentId: "other" },
      [{ id: "1", department_id: "d1" }],
    );
    expect(filtered).toHaveLength(1);
  });
});
