/** @vitest-environment node */

import { describe, expect, it } from "vitest";

import { buildImportPayloadRows } from "@/components/assets/excel-import/excel-import-api-mapper";
import { buildMasterLookups } from "@/components/assets/excel-import/excel-import-service";
import type { ExcelImportPreviewRow } from "@/components/assets/excel-import/excel-import.types";

const branchId = "11111111-1111-1111-1111-111111111111";
const empId = "22222222-2222-2222-2222-222222222222";
const typeId = "33333333-3333-3333-3333-333333333333";
const deptId = "44444444-4444-4444-4444-444444444444";

const lookups = buildMasterLookups({
  branches: [{ id: branchId, label: "Noida" }],
  departments: [{ id: deptId, label: "IT" }],
  types: [{ id: typeId, label: "Laptop" }],
  employees: [{ id: empId, label: "Ada (E001)" }],
});

function preview(partial: Partial<ExcelImportPreviewRow> & { rowNumber: number }): ExcelImportPreviewRow {
  const baseValues = {
    assetTag: "AST-1",
    laptopName: "Dell",
    branch: "Noida",
    operationalStatus: "READY_TO_MOVE",
    assetType: "Laptop",
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
    expect(rows[0].asset_type_id).toBe(typeId);
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

  it("resolves employee department type serial", () => {
    const rows = buildImportPayloadRows(
      [
        preview({
          rowNumber: 4,
          values: {
            employeeId: "E001",
            department: "IT",
            assetType: "Laptop",
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
    expect(rows[0].asset_type_id).toBe(typeId);
    expect(rows[0].serial_number).toBe("SN-9");
    expect(rows[0].delivery_reference_number).toBe("DC-1");
    expect(rows[0].assignment_remarks).toBe("note");
  });

  it("persists make model configuration and location", () => {
    const rows = buildImportPayloadRows(
      [
        preview({
          rowNumber: 7,
          values: {
            manufacturer: "Dell",
            model: "XPS 15",
            configuration: "i7 · 32GB",
            location: "Rack B-2",
          },
        }),
      ],
      lookups,
      { includeWarnings: false },
    );
    expect(rows[0].make).toBe("Dell");
    expect(rows[0].model).toBe("XPS 15");
    expect(rows[0].configuration).toBe("i7 · 32GB");
    expect(rows[0].location_label).toBe("Rack B-2");
  });

  it("skips when branch cannot resolve", () => {
    const rows = buildImportPayloadRows(
      [preview({ rowNumber: 5, values: { branch: "Unknown" } })],
      lookups,
      { includeWarnings: false },
    );
    expect(rows).toHaveLength(0);
  });

  it("skips when type cannot resolve", () => {
    const rows = buildImportPayloadRows(
      [preview({ rowNumber: 5, values: { assetType: "Unknown" } })],
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
});
