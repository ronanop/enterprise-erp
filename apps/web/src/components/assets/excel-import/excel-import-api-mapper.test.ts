/** @vitest-environment node */

import { describe, expect, it } from "vitest";

import { buildImportPayloadRows } from "@/components/assets/excel-import/excel-import-api-mapper";
import { buildMasterLookups } from "@/components/assets/excel-import/excel-import-service";
import type { ExcelImportPreviewRow } from "@/components/assets/excel-import/excel-import.types";

const branchId = "11111111-1111-1111-1111-111111111111";
const empId = "22222222-2222-2222-2222-222222222222";
const catId = "33333333-3333-3333-3333-333333333333";
const deptId = "44444444-4444-4444-4444-444444444444";

const lookups = buildMasterLookups({
  branches: [{ id: branchId, label: "Noida" }],
  departments: [{ id: deptId, label: "IT" }],
  categories: [{ id: catId, label: "Laptop" }],
  employees: [{ id: empId, label: "Ada (E001)" }],
});

function preview(partial: Partial<ExcelImportPreviewRow> & { rowNumber: number }): ExcelImportPreviewRow {
  const baseValues = {
    assetTag: "AST-1",
    laptopName: "Dell",
    branch: "Noida",
    operationalStatus: "READY_TO_MOVE",
  };
  const { values: overrideValues, ...rest } = partial;
  return {
    status: "valid",
    issues: [],
    ...rest,
    values: {
      ...baseValues,
      ...overrideValues,
    },
  };
}

describe("buildImportPayloadRows", () => {
  it("maps valid row to API payload", () => {
    const rows = buildImportPayloadRows([preview({ rowNumber: 2 })], lookups, {
      includeWarnings: false,
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].asset_tag).toBe("AST-1");
    expect(rows[0].branch_id).toBe(branchId);
    expect(rows[0].operational_status).toBe("READY_TO_MOVE");
  });

  it("excludes invalid rows", () => {
    const rows = buildImportPayloadRows(
      [preview({ rowNumber: 2, status: "invalid" })],
      lookups,
      { includeWarnings: true },
    );
    expect(rows).toHaveLength(0);
  });

  it("excludes warnings unless includeWarnings", () => {
    const warned = preview({ rowNumber: 3, status: "warning" });
    expect(
      buildImportPayloadRows([warned], lookups, { includeWarnings: false }),
    ).toHaveLength(0);
    expect(
      buildImportPayloadRows([warned], lookups, { includeWarnings: true }),
    ).toHaveLength(1);
  });

  it("resolves employee department category serial", () => {
    const rows = buildImportPayloadRows(
      [
        preview({
          rowNumber: 4,
          values: {
            employeeId: "E001",
            department: "IT",
            category: "Laptop",
            serialNumber: "SN-9",
            deliveryReference: "DC-1",
            assignmentRemarks: "note",
          },
        }),
      ],
      lookups,
      { includeWarnings: false },
    );
    expect(rows[0].employee_id).toBe(empId);
    expect(rows[0].department_id).toBe(deptId);
    expect(rows[0].asset_category_id).toBe(catId);
    expect(rows[0].serial_number).toBe("SN-9");
    expect(rows[0].delivery_reference_number).toBe("DC-1");
    expect(rows[0].assignment_remarks).toBe("note");
  });

  it("skips when branch cannot resolve", () => {
    const rows = buildImportPayloadRows(
      [preview({ rowNumber: 5, values: { branch: "Unknown" } })],
      lookups,
      { includeWarnings: false },
    );
    expect(rows).toHaveLength(0);
  });

  it("skips when ops status invalid", () => {
    const rows = buildImportPayloadRows(
      [preview({ rowNumber: 6, values: { operationalStatus: "nope" } })],
      lookups,
      { includeWarnings: false },
    );
    expect(rows).toHaveLength(0);
  });

  it("skips empty tag or name", () => {
    expect(
      buildImportPayloadRows(
        [preview({ rowNumber: 7, values: { assetTag: "" } })],
        lookups,
        { includeWarnings: false },
      ),
    ).toHaveLength(0);
    expect(
      buildImportPayloadRows(
        [preview({ rowNumber: 8, values: { laptopName: "  " } })],
        lookups,
        { includeWarnings: false },
      ),
    ).toHaveLength(0);
  });

  it("normalizes excel tab alias to enum", () => {
    const rows = buildImportPayloadRows(
      [preview({ rowNumber: 9, values: { operationalStatus: "Not Given To Anyone" } })],
      lookups,
      { includeWarnings: false },
    );
    expect(rows[0].operational_status).toBe("RETIRED");
  });

  it("parses issue date when valid", () => {
    const rows = buildImportPayloadRows(
      [preview({ rowNumber: 10, values: { issueDate: "2024-01-15" } })],
      lookups,
      { includeWarnings: false },
    );
    expect(rows[0].issue_date).toBe("2024-01-15");
  });

  it("sets issue_date null when invalid", () => {
    const rows = buildImportPayloadRows(
      [preview({ rowNumber: 11, values: { issueDate: "not-a-date" } })],
      lookups,
      { includeWarnings: false },
    );
    expect(rows[0].issue_date).toBeNull();
  });

  it("preserves preview_status", () => {
    const rows = buildImportPayloadRows(
      [preview({ rowNumber: 12, status: "warning" })],
      lookups,
      { includeWarnings: true },
    );
    expect(rows[0].preview_status).toBe("warning");
  });

  it("handles multiple mixed rows", () => {
    const rows = buildImportPayloadRows(
      [
        preview({ rowNumber: 1 }),
        preview({ rowNumber: 2, status: "invalid" }),
        preview({ rowNumber: 3, status: "warning" }),
        preview({ rowNumber: 4, values: { assetTag: "AST-4" } }),
      ],
      lookups,
      { includeWarnings: false },
    );
    expect(rows.map((r) => r.row_number)).toEqual([1, 4]);
  });
});
