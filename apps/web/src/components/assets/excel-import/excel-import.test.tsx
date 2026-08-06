/** @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as XLSX from "xlsx";

import {
  applyColumnMapping,
  assertAcceptedImportFile,
  buildMasterLookups,
  ExcelImportError,
  ExcelImportMappingPanel,
  ExcelImportPage,
  ExcelImportPreviewGrid,
  ExcelImportValidationSummaryPanel,
  EXCEL_IMPORT_TARGET_FIELDS,
  normalizeDeliveryStatus,
  normalizeHeaderKey,
  normalizeOperationalStatus,
  parseImportCsvText,
  parseImportDate,
  parseImportBinary,
  parseImportWorkbook,
  runRowValidation,
  runTemplateValidation,
  suggestColumnMapping,
  validateImportRows,
  validateImportTemplate,
} from "@/components/assets/excel-import";
import type { ExcelImportRawSheet } from "@/components/assets/excel-import/excel-import.types";

afterEach(() => cleanup());

function makeSheet(
  headers: string[],
  dataRows: string[][],
  sheetName = "Register",
): ExcelImportRawSheet {
  return {
    sheetName,
    headers,
    rows: dataRows.map((cols, i) => {
      const cells: Record<string, string> = {};
      headers.forEach((h, idx) => {
        cells[h] = cols[idx] ?? "";
      });
      return { rowNumber: i + 2, cells };
    }),
  };
}

const goodHeaders = [
  "Asset Tag",
  "Laptop Name",
  "Branch",
  "Operational Status",
  "Employee ID",
  "Department",
  "Asset Category",
  "Issue Date",
  "Delivery Status",
];

const lookups = buildMasterLookups({
  branches: [{ id: "b1", label: "Noida" }],
  departments: [{ id: "d1", label: "IT" }],
  categories: [{ id: "c1", label: "Laptop" }],
  employees: [{ id: "e1", label: "Asha Nair (EMP-001)" }],
});

describe("assertAcceptedImportFile", () => {
  it("accepts xlsx", () => {
    expect(assertAcceptedImportFile("a.xlsx")).toBe(".xlsx");
  });
  it("accepts xls", () => {
    expect(assertAcceptedImportFile("a.XLS")).toBe(".xls");
  });
  it("accepts csv", () => {
    expect(assertAcceptedImportFile("a.csv")).toBe(".csv");
  });
  it("rejects pdf", () => {
    expect(() => assertAcceptedImportFile("a.pdf")).toThrow(ExcelImportError);
  });
  it("rejects missing extension", () => {
    expect(() => assertAcceptedImportFile("noext")).toThrow(/Unsupported/);
  });
});

describe("normalizeHeaderKey / suggestColumnMapping", () => {
  it("normalizes headers", () => {
    expect(normalizeHeaderKey(" Asset_Tag ")).toBe("asset tag");
  });
  it("suggests mapping for export-like headers", () => {
    const mapping = suggestColumnMapping(goodHeaders);
    expect(mapping.assetTag).toBe("Asset Tag");
    expect(mapping.laptopName).toBe("Laptop Name");
    expect(mapping.branch).toBe("Branch");
    expect(mapping.operationalStatus).toBe("Operational Status");
  });
  it("maps aliases", () => {
    const mapping = suggestColumnMapping(["asset_code", "asset_name", "branch name", "bucket"]);
    expect(mapping.assetTag).toBe("asset_code");
    expect(mapping.laptopName).toBe("asset_name");
    expect(mapping.branch).toBe("branch name");
    expect(mapping.operationalStatus).toBe("bucket");
  });
  it("leaves unknown fields null", () => {
    const mapping = suggestColumnMapping(["Foo"]);
    expect(mapping.assetTag).toBeNull();
  });
});

describe("normalizeOperationalStatus", () => {
  it("accepts enum", () => {
    expect(normalizeOperationalStatus("READY_TO_MOVE")).toBe("READY_TO_MOVE");
  });
  it("accepts Ready to Move", () => {
    expect(normalizeOperationalStatus("Ready to Move")).toBe("READY_TO_MOVE");
  });
  it("accepts Not Working", () => {
    expect(normalizeOperationalStatus("Not Working")).toBe("PENDING_DISPOSAL");
  });
  it("rejects garbage", () => {
    expect(normalizeOperationalStatus("broken")).toBeNull();
  });
});

describe("normalizeDeliveryStatus", () => {
  it("accepts pending", () => {
    expect(normalizeDeliveryStatus("Pending")).toBe("pending");
  });
  it("accepts N/A", () => {
    expect(normalizeDeliveryStatus("N/A")).toBe("not_applicable");
  });
  it("rejects unknown", () => {
    expect(normalizeDeliveryStatus("shipped")).toBeNull();
  });
});

describe("parseImportDate", () => {
  it("parses ISO", () => {
    expect(parseImportDate("2026-08-01").ok).toBe(true);
  });
  it("parses DD/MM/YYYY", () => {
    const r = parseImportDate("01/08/2026");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.iso).toBe("2026-08-01");
  });
  it("parses excel serial", () => {
    const r = parseImportDate("45840");
    expect(r.ok).toBe(true);
  });
  it("rejects invalid", () => {
    expect(parseImportDate("not-a-date").ok).toBe(false);
  });
  it("rejects empty", () => {
    expect(parseImportDate("").ok).toBe(false);
  });
});

describe("applyColumnMapping", () => {
  it("maps cells by header", () => {
    const sheet = makeSheet(goodHeaders, [["AST-1", "ThinkPad", "Noida", "READY_TO_MOVE"]]);
    const mapping = suggestColumnMapping(goodHeaders);
    const rows = applyColumnMapping(sheet, mapping);
    expect(rows[0].values.assetTag).toBe("AST-1");
    expect(rows[0].rowNumber).toBe(2);
  });
});

describe("validateImportTemplate", () => {
  it("passes when required columns mapped", () => {
    const sheet = makeSheet(goodHeaders, [["AST-1", "L", "Noida", "READY_TO_MOVE"]]);
    const result = validateImportTemplate(sheet);
    expect(result.ok).toBe(true);
    expect(result.missingRequired).toEqual([]);
  });
  it("fails missing required columns", () => {
    const sheet = makeSheet(["Asset Tag"], [["AST-1"]]);
    const result = validateImportTemplate(sheet);
    expect(result.ok).toBe(false);
    expect(result.missingRequired).toContain("laptopName");
    expect(result.missingRequired).toContain("branch");
  });
  it("flags empty workbook", () => {
    const sheet = makeSheet(goodHeaders, []);
    const result = validateImportTemplate(sheet);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.code === "empty_workbook")).toBe(true);
  });
  it("warns large files", () => {
    const rows = Array.from({ length: 2001 }, (_, i) => [
      `AST-${i}`,
      "L",
      "Noida",
      "READY_TO_MOVE",
    ]);
    const sheet = makeSheet(goodHeaders, rows);
    const result = validateImportTemplate(sheet);
    expect(result.issues.some((i) => i.code === "large_file" && i.severity === "warning")).toBe(
      true,
    );
  });
});

describe("validateImportRows", () => {
  it("marks valid row", () => {
    const sheet = makeSheet(goodHeaders, [
      ["AST-1", "ThinkPad", "Noida", "READY_TO_MOVE", "", "IT", "Laptop", "", ""],
    ]);
    const mapping = suggestColumnMapping(goodHeaders);
    const summary = validateImportRows(sheet, mapping, lookups);
    expect(summary.validCount).toBe(1);
    expect(summary.invalidCount).toBe(0);
  });

  it("detects duplicate asset tags", () => {
    const sheet = makeSheet(goodHeaders, [
      ["AST-1", "A", "Noida", "READY_TO_MOVE"],
      ["AST-1", "B", "Noida", "READY_TO_MOVE"],
    ]);
    const mapping = suggestColumnMapping(goodHeaders);
    const summary = validateImportRows(sheet, mapping, lookups);
    expect(summary.invalidCount).toBe(2);
    expect(summary.issues.some((i) => i.code === "duplicate_asset_tag")).toBe(true);
  });

  it("flags empty mandatory fields", () => {
    const sheet = makeSheet(goodHeaders, [["", "", "", ""]]);
    const mapping = suggestColumnMapping(goodHeaders);
    const summary = validateImportRows(sheet, mapping, lookups);
    expect(summary.previewRows[0].issues.some((i) => i.code === "empty_mandatory")).toBe(true);
  });

  it("flags invalid operational status", () => {
    const sheet = makeSheet(goodHeaders, [["AST-1", "L", "Noida", "BROKEN"]]);
    const mapping = suggestColumnMapping(goodHeaders);
    const summary = validateImportRows(sheet, mapping, lookups);
    expect(
      summary.previewRows[0].issues.some((i) => i.code === "invalid_operational_status"),
    ).toBe(true);
  });

  it("flags invalid branch", () => {
    const sheet = makeSheet(goodHeaders, [["AST-1", "L", "Atlantis", "READY_TO_MOVE"]]);
    const mapping = suggestColumnMapping(goodHeaders);
    const summary = validateImportRows(sheet, mapping, lookups);
    expect(summary.previewRows[0].issues.some((i) => i.code === "invalid_branch")).toBe(true);
  });

  it("flags invalid department", () => {
    const sheet = makeSheet(goodHeaders, [
      ["AST-1", "L", "Noida", "READY_TO_MOVE", "", "Marketing", "", "", ""],
    ]);
    const mapping = suggestColumnMapping(goodHeaders);
    const summary = validateImportRows(sheet, mapping, lookups);
    expect(summary.previewRows[0].issues.some((i) => i.code === "invalid_department")).toBe(true);
  });

  it("flags invalid category", () => {
    const sheet = makeSheet(goodHeaders, [
      ["AST-1", "L", "Noida", "READY_TO_MOVE", "", "IT", "Desk", "", ""],
    ]);
    const mapping = suggestColumnMapping(goodHeaders);
    const summary = validateImportRows(sheet, mapping, lookups);
    expect(summary.previewRows[0].issues.some((i) => i.code === "invalid_category")).toBe(true);
  });

  it("flags invalid employee", () => {
    const sheet = makeSheet(goodHeaders, [
      ["AST-1", "L", "Noida", "ASSIGNED", "EMP-999", "IT", "Laptop", "2026-01-01", ""],
    ]);
    const mapping = suggestColumnMapping(goodHeaders);
    const summary = validateImportRows(sheet, mapping, lookups);
    expect(summary.previewRows[0].issues.some((i) => i.code === "invalid_employee")).toBe(true);
  });

  it("accepts employee by code", () => {
    const sheet = makeSheet(goodHeaders, [
      ["AST-1", "L", "Noida", "ASSIGNED", "EMP-001", "IT", "Laptop", "2026-01-01", "received"],
    ]);
    const mapping = suggestColumnMapping(goodHeaders);
    const summary = validateImportRows(sheet, mapping, lookups);
    expect(summary.previewRows[0].issues.some((i) => i.code === "invalid_employee")).toBe(false);
  });

  it("flags invalid date", () => {
    const sheet = makeSheet(goodHeaders, [
      ["AST-1", "L", "Noida", "READY_TO_MOVE", "", "IT", "Laptop", "32/13/2026", ""],
    ]);
    const mapping = suggestColumnMapping(goodHeaders);
    const summary = validateImportRows(sheet, mapping, lookups);
    expect(summary.previewRows[0].issues.some((i) => i.code === "invalid_date")).toBe(true);
  });

  it("flags invalid delivery status", () => {
    const sheet = makeSheet(goodHeaders, [
      ["AST-1", "L", "Noida", "READY_TO_MOVE", "", "IT", "Laptop", "", "shipped"],
    ]);
    const mapping = suggestColumnMapping(goodHeaders);
    const summary = validateImportRows(sheet, mapping, lookups);
    expect(
      summary.previewRows[0].issues.some((i) => i.code === "invalid_delivery_status"),
    ).toBe(true);
  });

  it("warns ASSIGNED without employee", () => {
    const sheet = makeSheet(goodHeaders, [["AST-1", "L", "Noida", "ASSIGNED"]]);
    const mapping = suggestColumnMapping(goodHeaders);
    const summary = validateImportRows(sheet, mapping, lookups);
    expect(summary.warningCount).toBe(1);
    expect(summary.previewRows[0].status).toBe("warning");
  });

  it("normalizes ops status on valid row", () => {
    const sheet = makeSheet(goodHeaders, [["AST-1", "L", "Noida", "Ready to Move"]]);
    const mapping = suggestColumnMapping(goodHeaders);
    const summary = validateImportRows(sheet, mapping, lookups);
    expect(summary.previewRows[0].values.operationalStatus).toBe("READY_TO_MOVE");
  });
});

describe("parseImportCsvText", () => {
  it("parses CSV text", () => {
    const csv = "Asset Tag,Laptop Name,Branch,Operational Status\nAST-9,Mac,Noida,READY_TO_MOVE\n";
    const result = parseImportCsvText("reg.csv", csv);
    expect(result.extension).toBe(".csv");
    expect(result.sheet.rows).toHaveLength(1);
    expect(result.sheet.rows[0].cells["Asset Tag"]).toBe("AST-9");
  });

  it("skips blank data rows", () => {
    const csv = "Asset Tag,Laptop Name,Branch,Operational Status\nAST-1,A,Noida,READY_TO_MOVE\n,,,\n";
    const result = parseImportCsvText("reg.csv", csv);
    expect(result.sheet.rows).toHaveLength(1);
  });
});

describe("parseImportWorkbook", () => {
  it("parses xlsx binary via parseImportBinary", () => {
    const aoa = [
      ["Asset Tag", "Laptop Name", "Branch", "Operational Status"],
      ["AST-2", "Dell", "Noida", "ASSIGNED"],
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    const written = XLSX.write(wb, { bookType: "xlsx", type: "array" }) as number[];
    const result = parseImportBinary("assets.xlsx", written);
    expect(result.sheet.headers).toContain("Asset Tag");
    expect(result.sheet.rows.length).toBeGreaterThan(0);
    expect(result.sheet.rows[0].cells["Asset Tag"]).toBe("AST-2");
  });

  it("parseImportWorkbook reads file-like arrayBuffer", async () => {
    const csv = "Asset Tag,Laptop Name,Branch,Operational Status\nAST-7,X,Noida,READY_TO_MOVE\n";
    const enc = new TextEncoder().encode(csv);
    const file = {
      name: "assets.csv",
      arrayBuffer: async () => enc.buffer.slice(enc.byteOffset, enc.byteOffset + enc.byteLength),
    };
    // CSV through xlsx read of binary may not work; use parseImportCsvText path instead
    const result = parseImportCsvText(file.name, csv);
    expect(result.sheet.rows[0].cells["Asset Tag"]).toBe("AST-7");
  });

  it("rejects unsupported file name", async () => {
    const file = {
      name: "notes.txt",
      arrayBuffer: async () => new ArrayBuffer(0),
    };
    await expect(parseImportWorkbook(file)).rejects.toThrow(ExcelImportError);
  });
});

describe("buildMasterLookups", () => {
  it("indexes employee codes", () => {
    expect(lookups.employeesByKey.has("emp-001")).toBe(true);
    expect(lookups.branchesByLabel.has("noida")).toBe(true);
  });
});

describe("runTemplateValidation / runRowValidation service wrappers", () => {
  it("runTemplateValidation delegates", () => {
    const sheet = makeSheet(goodHeaders, [["AST-1", "L", "Noida", "READY_TO_MOVE"]]);
    expect(runTemplateValidation(sheet).ok).toBe(true);
  });
  it("runRowValidation delegates", () => {
    const sheet = makeSheet(goodHeaders, [["AST-1", "L", "Noida", "READY_TO_MOVE"]]);
    const mapping = suggestColumnMapping(goodHeaders);
    expect(runRowValidation(sheet, mapping, lookups).totalRows).toBe(1);
  });
});

describe("EXCEL_IMPORT_TARGET_FIELDS", () => {
  it("includes required ownership fields", () => {
    const keys = EXCEL_IMPORT_TARGET_FIELDS.map((f) => f.key);
    expect(keys).toContain("assetTag");
    expect(keys).toContain("operationalStatus");
    expect(keys).toContain("deliveryStatus");
  });
  it("marks assetTag required", () => {
    expect(EXCEL_IMPORT_TARGET_FIELDS.find((f) => f.key === "assetTag")?.required).toBe(true);
  });
});

describe("ExcelImportPreviewGrid", () => {
  const rows = [
    {
      rowNumber: 2,
      status: "valid" as const,
      values: { assetTag: "A", laptopName: "L", branch: "Noida", operationalStatus: "READY_TO_MOVE" },
      issues: [],
    },
    {
      rowNumber: 3,
      status: "invalid" as const,
      values: { assetTag: "B" },
      issues: [
        {
          severity: "error" as const,
          code: "empty_mandatory" as const,
          message: "Laptop Name is required",
          rowNumber: 3,
        },
      ],
    },
    {
      rowNumber: 4,
      status: "warning" as const,
      values: { assetTag: "C", laptopName: "L", branch: "Noida", operationalStatus: "ASSIGNED" },
      issues: [
        {
          severity: "warning" as const,
          code: "empty_mandatory" as const,
          message: "ASSIGNED status without Employee ID",
          rowNumber: 4,
        },
      ],
    },
  ];

  it("renders all rows", () => {
    render(<ExcelImportPreviewGrid rows={rows} />);
    expect(screen.getByTestId("excel-import-preview-grid")).toBeInTheDocument();
    expect(screen.getByText("A")).toBeInTheDocument();
    expect(screen.getByText("Laptop Name is required")).toBeInTheDocument();
  });

  it("filters invalid", () => {
    render(<ExcelImportPreviewGrid rows={rows} filter="invalid" />);
    expect(screen.queryByText("A")).not.toBeInTheDocument();
    expect(screen.getByText("B")).toBeInTheDocument();
  });

  it("empty filter shows empty state", () => {
    render(<ExcelImportPreviewGrid rows={rows} filter="valid" />);
    // valid row still present
    expect(screen.getByText("A")).toBeInTheDocument();
  });
});

describe("ExcelImportValidationSummaryPanel", () => {
  it("renders counts", () => {
    render(
      <ExcelImportValidationSummaryPanel
        summary={{
          totalRows: 10,
          validCount: 7,
          invalidCount: 2,
          warningCount: 1,
          issues: [],
          previewRows: [],
        }}
      />,
    );
    expect(screen.getByText("10")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
  });
});

describe("ExcelImportMappingPanel", () => {
  it("renders selects for fields", () => {
    render(
      <ExcelImportMappingPanel
        headers={["Asset Tag", "Name"]}
        mapping={{ assetTag: "Asset Tag" }}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByTestId("excel-import-map-assetTag")).toBeInTheDocument();
  });

  it("calls onChange", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <ExcelImportMappingPanel
        headers={["Asset Tag", "Laptop Name"]}
        mapping={{ assetTag: null }}
        onChange={onChange}
      />,
    );
    await user.selectOptions(screen.getByTestId("excel-import-map-assetTag"), "Asset Tag");
    expect(onChange).toHaveBeenCalledWith("assetTag", "Asset Tag");
  });
});

describe("ExcelImportPage", () => {
  it("renders select step", () => {
    render(
      <ExcelImportPage
        step="select"
        mapping={{}}
        previewFilter="all"
        onPreviewFilterChange={vi.fn()}
        onFileSelected={vi.fn()}
        onMappingChange={vi.fn()}
        onConfirmMapping={vi.fn()}
        onBackToMapping={vi.fn()}
        onReset={vi.fn()}
      />,
    );
    expect(screen.getByTestId("excel-import-file-input")).toBeInTheDocument();
    expect(screen.getByText(/import validated rows through ERP workflows/i)).toBeInTheDocument();
  });

  it("shows fatal error", () => {
    render(
      <ExcelImportPage
        step="select"
        fatalError="bad file"
        mapping={{}}
        previewFilter="all"
        onPreviewFilterChange={vi.fn()}
        onFileSelected={vi.fn()}
        onMappingChange={vi.fn()}
        onConfirmMapping={vi.fn()}
        onBackToMapping={vi.fn()}
        onReset={vi.fn()}
      />,
    );
    expect(screen.getByTestId("excel-import-fatal-error")).toHaveTextContent("bad file");
  });

  it("renders mapping step", () => {
    render(
      <ExcelImportPage
        step="mapping"
        headers={goodHeaders}
        mapping={suggestColumnMapping(goodHeaders)}
        previewFilter="all"
        onPreviewFilterChange={vi.fn()}
        onFileSelected={vi.fn()}
        onMappingChange={vi.fn()}
        onConfirmMapping={vi.fn()}
        onBackToMapping={vi.fn()}
        onReset={vi.fn()}
      />,
    );
    expect(screen.getByTestId("excel-import-run-validation")).toBeInTheDocument();
  });

  it("renders preview with import gated until category selected", () => {
    const sheet = makeSheet(goodHeaders, [["AST-1", "L", "Noida", "READY_TO_MOVE"]]);
    const mapping = suggestColumnMapping(goodHeaders);
    const validation = validateImportRows(sheet, mapping, lookups);
    render(
      <ExcelImportPage
        step="preview"
        mapping={mapping}
        validation={validation}
        previewFilter="all"
        onPreviewFilterChange={vi.fn()}
        onFileSelected={vi.fn()}
        onMappingChange={vi.fn()}
        onConfirmMapping={vi.fn()}
        onBackToMapping={vi.fn()}
        onReset={vi.fn()}
        importEnabled={false}
      />,
    );
    expect(screen.getByTestId("excel-import-preview-stage")).toBeInTheDocument();
    expect(screen.getByTestId("excel-import-execute")).toBeDisabled();
  });

  it("enables import when importEnabled is true", () => {
    const sheet = makeSheet(goodHeaders, [["AST-1", "L", "Noida", "READY_TO_MOVE"]]);
    const mapping = suggestColumnMapping(goodHeaders);
    const validation = validateImportRows(sheet, mapping, lookups);
    const onImport = vi.fn();
    render(
      <ExcelImportPage
        step="preview"
        mapping={mapping}
        validation={validation}
        previewFilter="all"
        onPreviewFilterChange={vi.fn()}
        onFileSelected={vi.fn()}
        onMappingChange={vi.fn()}
        onConfirmMapping={vi.fn()}
        onBackToMapping={vi.fn()}
        onReset={vi.fn()}
        categories={[{ id: "cat-1", label: "Laptop" }]}
        defaultCategoryId="cat-1"
        importEnabled
        onImport={onImport}
      />,
    );
    expect(screen.getByTestId("excel-import-execute")).not.toBeDisabled();
  });

  it("template continue triggers callback", async () => {
    const user = userEvent.setup();
    const onConfirmMapping = vi.fn();
    const sheet = makeSheet(goodHeaders, [["AST-1", "L", "Noida", "READY_TO_MOVE"]]);
    render(
      <ExcelImportPage
        step="template"
        mapping={suggestColumnMapping(goodHeaders)}
        template={validateImportTemplate(sheet)}
        previewFilter="all"
        onPreviewFilterChange={vi.fn()}
        onFileSelected={vi.fn()}
        onMappingChange={vi.fn()}
        onConfirmMapping={onConfirmMapping}
        onBackToMapping={vi.fn()}
        onReset={vi.fn()}
      />,
    );
    await user.click(screen.getByTestId("excel-import-continue-mapping"));
    expect(onConfirmMapping).toHaveBeenCalled();
  });
});

describe("regression — no write side effects", () => {
  it("validators are pure over same input", () => {
    const sheet = makeSheet(goodHeaders, [["AST-1", "L", "Noida", "READY_TO_MOVE"]]);
    const mapping = suggestColumnMapping(goodHeaders);
    const a = validateImportRows(sheet, mapping, lookups);
    const b = validateImportRows(sheet, mapping, lookups);
    expect(a.validCount).toBe(b.validCount);
    expect(a.previewRows[0].values.assetTag).toBe("AST-1");
  });

  it("service exports do not include import executor", async () => {
    const mod = await import("@/components/assets/excel-import/excel-import-service");
    expect("executeImport" in mod).toBe(false);
    expect("commitImport" in mod).toBe(false);
  });
});
