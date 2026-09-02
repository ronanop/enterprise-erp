/** @vitest-environment jsdom */

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as XLSX from "xlsx";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { InventoryRowViewModel } from "@/components/assets/inventory.mapper";
import {
  assertExportColumnOrder,
  buildInventoryCsvString,
  buildInventoryExportFilename,
  buildInventoryXlsxArrayBuffer,
  createInventoryExportBlob,
  escapeCsvCell,
  exportInventoryRegister,
  fetchAllInventoryRowsForExport,
  getInventoryExportColumnLabels,
  getInventoryExportColumns,
  InventoryExportError,
  INVENTORY_EXPORT_API_PAGE_SIZE,
  INVENTORY_EXPORT_COLUMNS,
  InventoryExportToolbar,
  mapInventoryRowToExportRow,
  mapInventoryRowsToExportRows,
  parseCsvLines,
  triggerInventoryDownload,
} from "@/components/assets/inventory/export";
import { EMPTY_INVENTORY_FILTERS, BRANCH_ALL_VALUE } from "@/components/assets/shared";

afterEach(() => cleanup());

function sampleRow(overrides: Partial<InventoryRowViewModel> = {}): InventoryRowViewModel {
  return {
    id: "a1",
    assetTag: "AST-1",
    laptopName: "ThinkPad",
    serialNumber: "SN-1",
    manufacturer: "Lenovo",
    model: "T14",
    configuration: "i7 · 16GB",
    currentHolder: "Asha Nair",
    employeeId: "emp-1",
    department: "IT",
    branch: "Noida",
    operationalStatus: "ASSIGNED",
    lifecycleStatus: "active",
    issueDate: "Aug 1, 2026",
    location: "Noida HQ",
    expandable: {
      earlierUsedBy: "Priya",
      deliveryChallan: "DR-42",
      deliveryReferenceStatus: "Issued",
      phoneNumber: "—",
      remarks: "Handle carefully",
      assignmentRemarks: "Handle carefully",
      returnRemarks: "ok",
    },
    assignmentHistory: [],
    ...overrides,
  };
}

describe("INVENTORY_EXPORT_COLUMNS", () => {
  it("includes required register columns", () => {
    const labels = getInventoryExportColumnLabels();
    expect(labels).toContain("Asset Tag");
    expect(labels).toContain("Earlier Used By");
    expect(labels).toContain("Delivery Reference");
    expect(labels).toContain("Delivery Status");
    expect(labels).toContain("Assignment Remarks");
    expect(labels).toContain("Return Remarks");
    expect(labels).toContain("Location");
  });

  it("has no duplicate labels", () => {
    const labels = getInventoryExportColumnLabels();
    expect(new Set(labels).size).toBe(labels.length);
  });

  it("locks column count at 18", () => {
    expect(INVENTORY_EXPORT_COLUMNS).toHaveLength(18);
    expect(getInventoryExportColumns()).toHaveLength(18);
  });

  it("assertExportColumnOrder validates key order", () => {
    expect(assertExportColumnOrder(INVENTORY_EXPORT_COLUMNS.map((c) => c.key))).toBe(true);
    expect(assertExportColumnOrder(["assetTag", "laptopName"] as never)).toBe(false);
  });

  it("API page size matches backend ceiling", () => {
    expect(INVENTORY_EXPORT_API_PAGE_SIZE).toBe(200);
  });
});

describe("mapInventoryRowToExportRow", () => {
  it("maps all fields from inventory row", () => {
    const row = mapInventoryRowToExportRow(sampleRow());
    expect(row.assetTag).toBe("AST-1");
    expect(row.earlierUsedBy).toBe("Priya");
    expect(row.deliveryReference).toBe("DR-42");
    expect(row.deliveryStatus).toBe("Issued");
    expect(row.assignmentRemarks).toBe("Handle carefully");
    expect(row.returnRemarks).toBe("ok");
    expect(row.location).toBe("Noida HQ");
  });

  it("maps multiple rows preserving order", () => {
    const rows = mapInventoryRowsToExportRows([
      sampleRow({ id: "1", assetTag: "A" }),
      sampleRow({ id: "2", assetTag: "B" }),
    ]);
    expect(rows.map((r) => r.assetTag)).toEqual(["A", "B"]);
  });

  it("export row keys match column order", () => {
    const row = mapInventoryRowToExportRow(sampleRow());
    expect(assertExportColumnOrder(Object.keys(row) as never)).toBe(true);
  });
});

describe("filename", () => {
  it("builds xlsx filename with date", () => {
    expect(buildInventoryExportFilename("xlsx", new Date("2026-08-05T12:00:00Z"))).toBe(
      "asset-inventory-register-2026-08-05.xlsx",
    );
  });

  it("builds csv filename with date", () => {
    expect(buildInventoryExportFilename("csv", new Date("2026-08-05T12:00:00Z"))).toBe(
      "asset-inventory-register-2026-08-05.csv",
    );
  });
});

describe("CSV generation", () => {
  it("escapeCsvCell quotes commas", () => {
    expect(escapeCsvCell("a,b")).toBe('"a,b"');
  });

  it("escapeCsvCell doubles quotes", () => {
    expect(escapeCsvCell('say "hi"')).toBe('"say ""hi"""');
  });

  it("escapeCsvCell leaves plain text", () => {
    expect(escapeCsvCell("plain")).toBe("plain");
  });

  it("builds header row first", () => {
    const csv = buildInventoryCsvString([]);
    const lines = parseCsvLines(csv);
    expect(lines[0][0]).toBe("Asset Tag");
    expect(lines[0]).toEqual(getInventoryExportColumnLabels());
  });

  it("includes UTF-8 BOM", () => {
    expect(buildInventoryCsvString([]).charCodeAt(0)).toBe(0xfeff);
  });

  it("writes data rows", () => {
    const csv = buildInventoryCsvString(mapInventoryRowsToExportRows([sampleRow()]));
    const lines = parseCsvLines(csv);
    expect(lines).toHaveLength(2);
    expect(lines[1][0]).toBe("AST-1");
    expect(lines[1][12]).toBe("Priya");
  });

  it("escapes remarks with commas", () => {
    const csv = buildInventoryCsvString(
      mapInventoryRowsToExportRows([
        sampleRow({
          expandable: {
            ...sampleRow().expandable,
            assignmentRemarks: "a, b",
          },
        }),
      ]),
    );
    expect(csv).toContain('"a, b"');
  });

  it("empty export still has headers only", () => {
    expect(parseCsvLines(buildInventoryCsvString([]))).toHaveLength(1);
  });
});

describe("Excel generation", () => {
  it("produces non-empty array buffer", () => {
    const buf = buildInventoryXlsxArrayBuffer(mapInventoryRowsToExportRows([sampleRow()]));
    expect(buf.byteLength).toBeGreaterThan(100);
  });

  it("empty export still has workbook with headers", () => {
    const buf = buildInventoryXlsxArrayBuffer([]);
    const wb = XLSX.read(buf, { type: "array" });
    expect(wb.SheetNames[0]).toBe("Asset Register");
    const rows = XLSX.utils.sheet_to_json<string[]>(wb.Sheets["Asset Register"], {
      header: 1,
    });
    expect(rows[0]).toEqual(getInventoryExportColumnLabels());
  });

  it("round-trips column labels and values", () => {
    const exportRows = mapInventoryRowsToExportRows([sampleRow()]);
    const buf = buildInventoryXlsxArrayBuffer(exportRows);
    const wb = XLSX.read(buf, { type: "array" });
    const json = XLSX.utils.sheet_to_json<Record<string, string>>(wb.Sheets["Asset Register"]);
    expect(json[0]["Asset Tag"]).toBe("AST-1");
    expect(json[0]["Delivery Reference"]).toBe("DR-42");
    expect(json[0]["Return Remarks"]).toBe("ok");
  });

  it("createInventoryExportBlob csv type", () => {
    const blob = createInventoryExportBlob("csv", mapInventoryRowsToExportRows([sampleRow()]));
    expect(blob.type).toContain("csv");
    expect(blob.size).toBeGreaterThan(20);
  });

  it("createInventoryExportBlob xlsx type", () => {
    const blob = createInventoryExportBlob("xlsx", mapInventoryRowsToExportRows([sampleRow()]));
    expect(blob.type).toContain("spreadsheetml");
  });
});

describe("download trigger", () => {
  it("calls download with filename and blob", () => {
    const download = vi.fn();
    triggerInventoryDownload("csv", [], "test.csv", download);
    expect(download).toHaveBeenCalledOnce();
    expect(download.mock.calls[0][0]).toBe("test.csv");
    expect(download.mock.calls[0][1]).toBeInstanceOf(Blob);
  });

  it("wraps download failures", () => {
    expect(() =>
      triggerInventoryDownload("csv", [], "x.csv", () => {
        throw new Error("blocked");
      }),
    ).toThrow(InventoryExportError);
  });
});

describe("fetchAllInventoryRowsForExport", () => {
  const lookup = {
    branchLabels: { b1: "Noida" },
    departmentLabels: { d1: "IT" },
    categoryLabels: {},
    locationLabels: { b1: "Noida" },
    employeeLabels: { "emp-1": "Asha" },
  };

  it("pages through assets beyond UI page size", async () => {
    const page1 = Array.from({ length: 200 }, (_, i) => ({
      id: `a-${i}`,
      asset_code: `AST-${i}`,
      asset_name: `L-${i}`,
      branch_id: "b1",
      operational_status: "READY_TO_MOVE",
      status: "active",
    }));
    const page2 = [
      {
        id: "a-200",
        asset_code: "AST-200",
        asset_name: "Last",
        branch_id: "b1",
        operational_status: "READY_TO_MOVE",
        status: "active",
      },
    ];
    const listAssets = vi
      .fn()
      .mockResolvedValueOnce({ items: page1, total: 201, page: 1, page_size: 200 })
      .mockResolvedValueOnce({ items: page2, total: 201, page: 2, page_size: 200 });
    const listAssignments = vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, page_size: 200 });

    const rows = await fetchAllInventoryRowsForExport({
      preset: "ready",
      filters: EMPTY_INVENTORY_FILTERS,
      headerLocationId: "loc-mumbai",
      lookup,
      deps: { listAssets, listAssignments },
    });

    expect(listAssets).toHaveBeenCalledTimes(2);
    expect(listAssets.mock.calls[0][0].page_size).toBe(200);
    expect(listAssets.mock.calls[0][0].operational_status).toBe("READY_TO_MOVE");
    expect(rows).toHaveLength(201);
    expect(rows[200].assetTag).toBe("AST-200");
  });

  it("sends department_id to listAssets (server-side filter)", async () => {
    const listAssets = vi.fn().mockResolvedValue({
      items: [
        {
          id: "1",
          asset_code: "A",
          asset_name: "X",
          department_id: "d1",
          branch_id: "b1",
          operational_status: "READY_TO_MOVE",
          status: "active",
        },
      ],
      total: 1,
      page: 1,
      page_size: 200,
    });
    const listAssignments = vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, page_size: 200 });

    const rows = await fetchAllInventoryRowsForExport({
      preset: "all",
      filters: { ...EMPTY_INVENTORY_FILTERS, departmentId: "d1" },
      headerLocationId: BRANCH_ALL_VALUE,
      lookup,
      deps: { listAssets, listAssignments },
    });
    expect(listAssets).toHaveBeenCalledWith(
      expect.objectContaining({ department_id: "d1" }),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].assetTag).toBe("A");
  });

  it("enriches current holder from assignments", async () => {
    const listAssets = vi.fn().mockResolvedValue({
      items: [
        {
          id: "asset-1",
          asset_code: "AST-9",
          asset_name: "Laptop",
          branch_id: "b1",
          operational_status: "ASSIGNED",
          status: "active",
        },
      ],
      total: 1,
      page: 1,
      page_size: 200,
    });
    const listAssignments = vi.fn().mockResolvedValue({
      items: [
        {
          id: "asn-1",
          asset_id: "asset-1",
          status: "active",
          employee_id: "emp-1",
          delivery_reference_number: "DR-1",
          delivery_reference_status: "received",
          assignment_remarks: "note",
        },
      ],
      total: 1,
      page: 1,
      page_size: 200,
    });

    const rows = await fetchAllInventoryRowsForExport({
      preset: "assigned",
      filters: EMPTY_INVENTORY_FILTERS,
      headerLocationId: "loc-mumbai",
      lookup,
      deps: { listAssets, listAssignments },
    });
    expect(rows[0].currentHolder).toContain("Asha");
    expect(rows[0].expandable.deliveryChallan).toBe("DR-1");
  });

  it("wraps list failures as InventoryExportError", async () => {
    await expect(
      fetchAllInventoryRowsForExport({
        preset: "all",
        filters: EMPTY_INVENTORY_FILTERS,
        headerLocationId: BRANCH_ALL_VALUE,
        lookup,
        deps: {
          listAssets: vi.fn().mockRejectedValue(new Error("network")),
          listAssignments: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, page_size: 200 }),
        },
      }),
    ).rejects.toMatchObject({ code: "fetch_failed" });
  });

  it("pages assignment history", async () => {
    const asnPage1 = Array.from({ length: 200 }, (_, i) => ({
      id: `asn-${i}`,
      asset_id: "asset-x",
      status: "returned",
      employee_id: "emp-1",
      returned_at: `2025-01-${String((i % 28) + 1).padStart(2, "0")}T00:00:00Z`,
    }));
    const listAssignments = vi
      .fn()
      .mockResolvedValueOnce({ items: asnPage1, total: 201, page: 1, page_size: 200 })
      .mockResolvedValueOnce({
        items: [
          {
            id: "asn-200",
            asset_id: "asset-x",
            status: "returned",
            employee_id: "emp-1",
            returned_at: "2026-01-01T00:00:00Z",
          },
        ],
        total: 201,
        page: 2,
        page_size: 200,
      });
    const listAssets = vi.fn().mockResolvedValue({
      items: [
        {
          id: "asset-x",
          asset_code: "X",
          asset_name: "Y",
          branch_id: "b1",
          operational_status: "READY_TO_MOVE",
          status: "active",
        },
      ],
      total: 1,
      page: 1,
      page_size: 200,
    });

    await fetchAllInventoryRowsForExport({
      preset: "all",
      filters: EMPTY_INVENTORY_FILTERS,
      headerLocationId: "loc-mumbai",
      lookup,
      deps: { listAssets, listAssignments },
    });
    expect(listAssignments).toHaveBeenCalledTimes(2);
  });
});

describe("exportInventoryRegister", () => {
  const lookup = {
    branchLabels: {},
    departmentLabels: {},
    categoryLabels: {},
    locationLabels: {},
    employeeLabels: {},
  };

  it("exports csv and returns metadata", async () => {
    const download = vi.fn();
    const result = await exportInventoryRegister({
      format: "csv",
      preset: "all",
      filters: EMPTY_INVENTORY_FILTERS,
      headerLocationId: BRANCH_ALL_VALUE,
      lookup,
      stamp: new Date("2026-08-05T00:00:00Z"),
      download,
      deps: {
        listAssets: vi.fn().mockResolvedValue({
          items: [
            {
              id: "1",
              asset_code: "AST",
              asset_name: "L",
              operational_status: "READY_TO_MOVE",
              status: "active",
            },
          ],
          total: 1,
          page: 1,
          page_size: 200,
        }),
        listAssignments: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, page_size: 200 }),
      },
    });
    expect(result.filename).toBe("asset-inventory-register-2026-08-05.csv");
    expect(result.rowCount).toBe(1);
    expect(result.format).toBe("csv");
    expect(download).toHaveBeenCalledOnce();
  });

  it("exports xlsx", async () => {
    const download = vi.fn();
    const result = await exportInventoryRegister({
      format: "xlsx",
      preset: "all",
      filters: EMPTY_INVENTORY_FILTERS,
      headerLocationId: BRANCH_ALL_VALUE,
      lookup,
      stamp: new Date("2026-08-05T00:00:00Z"),
      download,
      deps: {
        listAssets: vi.fn().mockResolvedValue({
          items: [],
          total: 0,
          page: 1,
          page_size: 200,
        }),
        listAssignments: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, page_size: 200 }),
      },
    });
    expect(result.filename.endsWith(".xlsx")).toBe(true);
    expect(result.rowCount).toBe(0);
  });

  it("rejects empty when allowEmpty false", async () => {
    await expect(
      exportInventoryRegister({
        format: "csv",
        preset: "all",
        filters: EMPTY_INVENTORY_FILTERS,
        headerLocationId: BRANCH_ALL_VALUE,
        lookup,
        allowEmpty: false,
        download: vi.fn(),
        deps: {
          listAssets: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, page_size: 200 }),
          listAssignments: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, page_size: 200 }),
        },
      }),
    ).rejects.toMatchObject({ code: "empty" });
  });

  it("passes search filter into list query", async () => {
    const listAssets = vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, page_size: 200 });
    await exportInventoryRegister({
      format: "csv",
      preset: "all",
      filters: { ...EMPTY_INVENTORY_FILTERS, search: "thinkpad" },
      headerLocationId: BRANCH_ALL_VALUE,
      lookup,
      download: vi.fn(),
      deps: {
        listAssets,
        listAssignments: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, page_size: 200 }),
      },
    });
    expect(listAssets.mock.calls[0][0].q).toBe("thinkpad");
  });
});

describe("InventoryExportToolbar", () => {
  it("renders Export trigger", () => {
    render(
      <InventoryExportToolbar onExportExcel={vi.fn()} onExportCsv={vi.fn()} />,
    );
    expect(screen.getByTestId("inventory-export-trigger")).toHaveTextContent("Export");
  });

  it("opens menu with Excel and CSV", async () => {
    const user = userEvent.setup();
    render(<InventoryExportToolbar onExportExcel={vi.fn()} onExportCsv={vi.fn()} />);
    await user.click(screen.getByTestId("inventory-export-trigger"));
    expect(screen.getByTestId("inventory-export-menu")).toBeInTheDocument();
    expect(screen.getByTestId("inventory-export-xlsx")).toHaveTextContent("Export Excel");
    expect(screen.getByTestId("inventory-export-csv")).toHaveTextContent("Export CSV");
  });

  it("calls onExportExcel", async () => {
    const user = userEvent.setup();
    const onExportExcel = vi.fn();
    render(<InventoryExportToolbar onExportExcel={onExportExcel} onExportCsv={vi.fn()} />);
    await user.click(screen.getByTestId("inventory-export-trigger"));
    await user.click(screen.getByTestId("inventory-export-xlsx"));
    expect(onExportExcel).toHaveBeenCalledOnce();
  });

  it("calls onExportCsv", async () => {
    const user = userEvent.setup();
    const onExportCsv = vi.fn();
    render(<InventoryExportToolbar onExportExcel={vi.fn()} onExportCsv={onExportCsv} />);
    await user.click(screen.getByTestId("inventory-export-trigger"));
    await user.click(screen.getByTestId("inventory-export-csv"));
    expect(onExportCsv).toHaveBeenCalledOnce();
  });

  it("shows loading state", () => {
    render(
      <InventoryExportToolbar exporting onExportExcel={vi.fn()} onExportCsv={vi.fn()} />,
    );
    expect(screen.getByTestId("inventory-export-trigger")).toHaveTextContent("Exporting…");
    expect(screen.getByTestId("inventory-export-trigger")).toBeDisabled();
  });

  it("shows error", () => {
    render(
      <InventoryExportToolbar
        exportError="Export failed"
        onExportExcel={vi.fn()}
        onExportCsv={vi.fn()}
      />,
    );
    expect(screen.getByTestId("inventory-export-error")).toHaveTextContent("Export failed");
  });

  it("shows success", () => {
    render(
      <InventoryExportToolbar
        exportSuccess="Exported 3 rows"
        onExportExcel={vi.fn()}
        onExportCsv={vi.fn()}
      />,
    );
    expect(screen.getByTestId("inventory-export-success")).toHaveTextContent("Exported 3 rows");
  });

  it("disables when disabled prop set", () => {
    render(
      <InventoryExportToolbar disabled onExportExcel={vi.fn()} onExportCsv={vi.fn()} />,
    );
    expect(screen.getByTestId("inventory-export-trigger")).toBeDisabled();
  });

  it("closes menu on Escape", async () => {
    const user = userEvent.setup();
    render(<InventoryExportToolbar onExportExcel={vi.fn()} onExportCsv={vi.fn()} />);
    await user.click(screen.getByTestId("inventory-export-trigger"));
    expect(screen.getByTestId("inventory-export-menu")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await waitFor(() => {
      expect(screen.queryByTestId("inventory-export-menu")).not.toBeInTheDocument();
    });
  });
});

describe("workspace export wiring", () => {
  it("does not invent duplicate column keys", () => {
    const keys = INVENTORY_EXPORT_COLUMNS.map((c) => c.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("column labels include Lifecycle Status", () => {
    expect(getInventoryExportColumnLabels()).toContain("Lifecycle Status");
  });

  it("maps dash placeholders through", () => {
    const row = mapInventoryRowToExportRow(
      sampleRow({
        currentHolder: "—",
        expandable: {
          earlierUsedBy: "—",
          deliveryChallan: "—",
          deliveryReferenceStatus: "—",
          phoneNumber: "—",
          remarks: "—",
          assignmentRemarks: "—",
          returnRemarks: "—",
        },
      }),
    );
    expect(row.currentHolder).toBe("—");
    expect(row.earlierUsedBy).toBe("—");
  });

  it("filtered export query includes category", async () => {
    const listAssets = vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, page_size: 200 });
    await fetchAllInventoryRowsForExport({
      preset: "all",
      filters: { ...EMPTY_INVENTORY_FILTERS, categoryId: "cat-9" },
      headerLocationId: BRANCH_ALL_VALUE,
      lookup: {
        branchLabels: {},
        departmentLabels: {},
        categoryLabels: {},
        locationLabels: {},
        employeeLabels: {},
      },
      deps: {
        listAssets,
        listAssignments: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, page_size: 200 }),
      },
    });
    expect(listAssets.mock.calls[0][0].asset_category_id).toBe("cat-9");
  });

  it("filtered export query includes location header", async () => {
    const listAssets = vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, page_size: 200 });
    await fetchAllInventoryRowsForExport({
      preset: "all",
      filters: EMPTY_INVENTORY_FILTERS,
      headerLocationId: "loc-mumbai",
      lookup: {
        branchLabels: {},
        departmentLabels: {},
        categoryLabels: {},
        locationLabels: {},
        employeeLabels: {},
      },
      deps: {
        listAssets,
        listAssignments: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, page_size: 200 }),
      },
    });
    expect(listAssets.mock.calls[0][0].location_id).toBe("loc-mumbai");
    expect(listAssets.mock.calls[0][0].branch_id).toBeUndefined();
  });

  it("sends asset_type to listAssets (server-side filter)", async () => {
    const listAssets = vi.fn().mockResolvedValue({
      items: [
        {
          id: "1",
          asset_code: "A",
          asset_name: "X",
          asset_type: "fixed",
          operational_status: "READY_TO_MOVE",
          status: "active",
        },
      ],
      total: 1,
      page: 1,
      page_size: 200,
    });
    const rows = await fetchAllInventoryRowsForExport({
      preset: "all",
      filters: { ...EMPTY_INVENTORY_FILTERS, assetType: "type-uuid-1" },
      headerLocationId: BRANCH_ALL_VALUE,
      lookup: {
        branchLabels: {},
        departmentLabels: {},
        categoryLabels: {},
        locationLabels: {},
        employeeLabels: {},
      },
      deps: {
        listAssets,
        listAssignments: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, page_size: 200 }),
      },
    });
    expect(listAssets).toHaveBeenCalledWith(expect.objectContaining({ asset_type_id: "type-uuid-1" }));
    expect(rows).toHaveLength(1);
    expect(rows[0].assetTag).toBe("A");
  });
});

describe("InventoryExportError", () => {
  it("stores code", () => {
    const err = new InventoryExportError("fetch_failed", "boom");
    expect(err.code).toBe("fetch_failed");
    expect(err.name).toBe("InventoryExportError");
  });

  it("generate_failed code exists for blob errors", () => {
    const err = new InventoryExportError("generate_failed", "x");
    expect(err.code).toBe("generate_failed");
  });
});
