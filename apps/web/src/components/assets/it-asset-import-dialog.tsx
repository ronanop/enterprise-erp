"use client";

import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  Upload,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { listEmployeeDirectory, type EmployeeDirectoryEntry } from "@/lib/org-options";
import { ApiClientError } from "@/services/api-client";
import type { SiteLocation } from "@/services/asset-site-location-service";
import type { ItAssetType } from "@/services/asset-type-service";
import { assetOperationsService } from "@/services/assets-service";

type ParsedImportRow = {
  row_number: number;
  asset_name: string;
  serial_number: string | null;
  make: string | null;
  model: string | null;
  asset_type: string;
  assignee_name: string | null;
  employee_code: string | null;
  operational_status: string;
  location: string | null;
  issue_date: string | null;
  errors: string[];
};

type ImportSummary = {
  total_rows: number;
  imported: number;
  skipped: number;
  duplicates: number;
  failed: number;
  rows: Array<{
    row_number: number;
    outcome: string;
    reason?: string | null;
  }>;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assetTypes: ItAssetType[];
  siteLocations: SiteLocation[];
  /** Used only for API payload when session branch is unset — not shown in UI. */
  fallbackBranchId?: string;
  currencyCode?: string;
  onImported: () => void;
};

const TEMPLATE_HEADERS = [
  "Asset Name",
  "S/N",
  "Make",
  "Model",
  "Asset Type",
  "Assignee",
  "Employee ID",
  "OperationalStatus",
  "Location",
  "Issue Date",
] as const;

function buildSampleRows(types: ItAssetType[]) {
  const laptop = types.find((t) => t.name.toLowerCase() === "laptop")?.name ?? "Laptop";
  const monitor = types.find((t) => t.name.toLowerCase().includes("monitor"))?.name ?? "Monitor";
  return [
    {
      "Asset Name": "MacBook Pro 14",
      "S/N": "SN-1001",
      Make: "Apple",
      Model: "M4 14",
      "Asset Type": laptop,
      Assignee: "Asha Nair",
      "Employee ID": "EMP-001",
      OperationalStatus: "Assigned",
      Location: "Mumbai",
      "Issue Date": "2025-01-15",
    },
    {
      "Asset Name": "Dell Monitor 27",
      "S/N": "SN-1002",
      Make: "Dell",
      Model: "U2720Q",
      "Asset Type": monitor,
      Assignee: "",
      "Employee ID": "",
      OperationalStatus: "Ready to Move",
      Location: "New Delhi",
      "Issue Date": "",
    },
  ];
}

function normalizeHeader(key: string): string {
  return key.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_");
}

function normalizeOpsStatus(raw: string): string {
  const v = raw.trim().toLowerCase().replace(/\s+/g, "_");
  if (!v || v === "ready" || v === "ready_to_move") return "READY_TO_MOVE";
  if (v === "assigned") return "ASSIGNED";
  if (v === "retired") return "RETIRED";
  if (v === "pending_disposal" || v === "pending") return "PENDING_DISPOSAL";
  return raw.trim().toUpperCase();
}

function normalizeName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function namesMatch(assignee: string, employee: EmployeeDirectoryEntry): boolean {
  const expected = normalizeName(assignee);
  const display = normalizeName(employee.displayName);
  const label = normalizeName(employee.label);
  return expected === display || label.startsWith(expected) || display.includes(expected);
}

function parseIssueDate(raw: unknown): string | null {
  if (raw == null || raw === "") return null;
  if (typeof raw === "number") {
    const parsed = XLSX.SSF.parse_date_code(raw);
    if (!parsed) return null;
    const mm = String(parsed.m).padStart(2, "0");
    const dd = String(parsed.d).padStart(2, "0");
    return `${parsed.y}-${mm}-${dd}`;
  }
  const text = String(raw).trim();
  if (!text) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const d = new Date(text);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function pickField(mapped: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const v = mapped[key];
    if (v != null && String(v).trim()) return String(v).trim();
  }
  return "";
}

function parseExcelRows(json: Record<string, unknown>[]): ParsedImportRow[] {
  const out: ParsedImportRow[] = [];
  json.forEach((raw, index) => {
    const mapped: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(raw)) {
      mapped[normalizeHeader(k)] = v;
    }
    const asset_name = pickField(mapped, [
      "asset_name",
      "assetname",
      "name",
      "laptop_name",
    ]);
    if (!asset_name) return;

    const assignee_name =
      pickField(mapped, ["assignee", "assignee_name", "employee_name", "employee"]) || null;
    const employee_code =
      pickField(mapped, ["employee_id", "employeeid", "emp_id", "assignee_employee_id"]) ||
      null;

    const location = pickField(mapped, ["location", "site", "site_location"]) || null;
    const opsRaw = pickField(mapped, ["operationalstatus", "operational_status", "status"]);
    const operational_status = normalizeOpsStatus(opsRaw || "ready to move");
    const asset_type = pickField(mapped, ["asset_type", "type", "assettype"]);

    out.push({
      row_number: index + 2,
      asset_name,
      serial_number: pickField(mapped, ["s_n", "sn", "serial_number", "serial"]) || null,
      make: pickField(mapped, ["make", "manufacturer", "brand"]) || null,
      model: pickField(mapped, ["model"]) || null,
      asset_type,
      assignee_name,
      employee_code,
      operational_status,
      location,
      issue_date: parseIssueDate(mapped.issue_date ?? mapped.issue),
      errors: [],
    });
  });
  return out;
}

function validateRows(
  rows: ParsedImportRow[],
  employees: EmployeeDirectoryEntry[],
  locations: SiteLocation[],
  assetTypes: ItAssetType[],
): ParsedImportRow[] {
  const empByCode = new Map(
    employees
      .filter((e) => e.employeeCode)
      .map((e) => [e.employeeCode!.toLowerCase(), e]),
  );
  const locByName = new Map(locations.map((l) => [l.name.trim().toLowerCase(), l]));
  const typeByName = new Map(
    assetTypes
      .filter((t) => t.active)
      .map((t) => [t.name.trim().toLowerCase(), t]),
  );

  return rows.map((row) => {
    const errors: string[] = [];
    if (!row.asset_type.trim()) {
      errors.push("Asset Type is required");
    } else {
      const type = typeByName.get(row.asset_type.toLowerCase());
      if (!type) errors.push(`Asset type '${row.asset_type}' not found`);
    }
    if (row.operational_status === "ASSIGNED" && !row.employee_code) {
      errors.push("Assigned status requires Employee ID");
    }
    if (row.employee_code) {
      const emp = empByCode.get(row.employee_code.toLowerCase());
      if (!emp) {
        errors.push(`Employee ID '${row.employee_code}' not found`);
      } else if (row.assignee_name && !namesMatch(row.assignee_name, emp)) {
        errors.push(
          `Assignee '${row.assignee_name}' does not match employee ${emp.displayName}`,
        );
      }
    }
    if (row.location) {
      const loc = locByName.get(row.location.toLowerCase());
      if (!loc) errors.push(`Location '${row.location}' not found in Locations master`);
    }
    const allowed = ["READY_TO_MOVE", "ASSIGNED", "RETIRED", "PENDING_DISPOSAL"];
    if (!allowed.includes(row.operational_status)) {
      errors.push(`Invalid status '${row.operational_status}'`);
    }
    return { ...row, errors };
  });
}

export function downloadItAssetImportTemplate(types: ItAssetType[]): void {
  const sampleRows = buildSampleRows(types);
  const importSheet = XLSX.utils.json_to_sheet(sampleRows, { header: [...TEMPLATE_HEADERS] });
  importSheet["!cols"] = [
    { wch: 24 },
    { wch: 14 },
    { wch: 12 },
    { wch: 16 },
    { wch: 14 },
    { wch: 20 },
    { wch: 14 },
    { wch: 18 },
    { wch: 16 },
    { wch: 12 },
  ];

  const activeTypes = types.filter((t) => t.active);
  const typeRows =
    activeTypes.length > 0
      ? activeTypes.map((t) => ({ asset_type: t.name }))
      : [{ asset_type: "(create asset types in Configuration first)" }];

  const typesSheet = XLSX.utils.json_to_sheet(typeRows);
  typesSheet["!cols"] = [{ wch: 28 }];

  const refSheet = XLSX.utils.aoa_to_sheet([
    ["OperationalStatus values"],
    ["Ready to Move"],
    ["Assigned"],
    ["Retired"],
    ["Pending Disposal"],
    [],
    ["Notes"],
    ["Asset codes (AST-2026-000001) are auto-generated — do not add an Asset Code column."],
    ["Location must match IT Locations master (e.g. Mumbai, New Delhi)."],
    ["Assignee = employee name; Employee ID = code (e.g. EMP-001). Both required when Assigned."],
    ["Asset Type must match Configuration → Asset Types (see Available types sheet)."],
  ]);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, importSheet, "Import");
  XLSX.utils.book_append_sheet(wb, typesSheet, "Available types");
  XLSX.utils.book_append_sheet(wb, refSheet, "Reference");

  const written = XLSX.write(wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
  const blob = new Blob([written], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "it-asset-import-template.xlsx";
  a.rel = "noopener";
  a.click();
  URL.revokeObjectURL(url);
}

export function ItAssetImportDialog({
  open,
  onOpenChange,
  assetTypes,
  siteLocations,
  fallbackBranchId,
  currencyCode = "INR",
  onImported,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<ParsedImportRow[]>([]);
  const [employees, setEmployees] = useState<EmployeeDirectoryEntry[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);

  if (!open) return null;

  const validated = validateRows(preview, employees, siteLocations, assetTypes);
  const invalidCount = validated.filter((r) => r.errors.length > 0).length;
  const canImport =
    !busy && !parsing && validated.length > 0 && invalidCount === 0 && !summary;

  async function loadEmployees() {
    try {
      setEmployees(await listEmployeeDirectory());
    } catch {
      setEmployees([]);
    }
  }

  async function onFile(file: File) {
    setError(null);
    setSummary(null);
    setFileName(file.name);
    setParsing(true);
    try {
      await loadEmployees();
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]!];
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
      const rows = parseExcelRows(json);
      if (rows.length === 0) {
        setPreview([]);
        setError("No valid rows found. Check column headers match the template.");
        return;
      }
      setPreview(rows);
    } catch {
      setPreview([]);
      setError("Could not parse Excel file.");
    } finally {
      setParsing(false);
    }
  }

  async function confirmImport() {
    if (!canImport) return;
    setBusy(true);
    setError(null);
    try {
      const empByCode = new Map(
        employees
          .filter((e) => e.employeeCode)
          .map((e) => [e.employeeCode!.toLowerCase(), e.id]),
      );
      const typeByName = new Map(
        assetTypes.filter((t) => t.active).map((t) => [t.name.trim().toLowerCase(), t.id]),
      );

      const apiRows = validated.map((row) => ({
        row_number: row.row_number,
        preview_status: "valid",
        asset_name: row.asset_name,
        ...(fallbackBranchId ? { branch_id: fallbackBranchId } : {}),
        operational_status: row.operational_status,
        employee_id: row.employee_code
          ? empByCode.get(row.employee_code.toLowerCase()) ?? null
          : null,
        asset_type_id: typeByName.get(row.asset_type.toLowerCase())!,
        serial_number: row.serial_number,
        make: row.make,
        model: row.model,
        location_label: row.location,
        issue_date: row.issue_date,
      }));

      const result = await assetOperationsService.importExcelRegister({
        confirm_warnings: true,
        defaults: {
          asset_type: "fixed",
          purchase_cost: "0",
          currency_code: currencyCode,
        },
        rows: apiRows,
      });

      setSummary({
        total_rows: result.total_rows,
        imported: result.imported,
        skipped: result.skipped,
        duplicates: result.duplicates,
        failed: result.failed,
        rows: result.rows as ImportSummary["rows"],
      });
      onImported();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Import failed");
    } finally {
      setBusy(false);
    }
  }

  function close() {
    if (busy) return;
    onOpenChange(false);
    setPreview([]);
    setFileName(null);
    setError(null);
    setSummary(null);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 p-4 backdrop-blur-[2px] sm:items-center"
      role="dialog"
      aria-modal
      data-testid="it-asset-import-dialog"
    >
      <div className="relative flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-border bg-background shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold">Import assets from Excel</h2>
            <p className="text-sm text-muted-foreground">
              Asset codes (AST-2026-000001) are generated automatically. Use the template columns
              for asset type, assignee name, and employee ID.
            </p>
          </div>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="cursor-pointer"
            onClick={close}
            aria-label="Close"
          >
            <X className="size-4" />
          </Button>
        </div>

        <div className="space-y-4 overflow-y-auto px-5 py-4">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="cursor-pointer"
              onClick={() => downloadItAssetImportTemplate(assetTypes)}
            >
              <Download className="mr-2 size-4" />
              Download template
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="cursor-pointer"
              onClick={() => inputRef.current?.click()}
              disabled={parsing || busy}
            >
              <Upload className="mr-2 size-4" />
              {fileName ? "Replace file" : "Upload Excel"}
            </Button>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void onFile(file);
              }}
            />
          </div>

          {fileName ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileSpreadsheet className="size-4" />
              {fileName}
              {parsing ? <Loader2 className="size-4 animate-spin" /> : null}
            </p>
          ) : null}

          {error ? (
            <p className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}

          {summary ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">
              <p className="flex items-center gap-2 font-medium">
                <CheckCircle2 className="size-4" />
                Import complete
              </p>
              <p className="mt-1">
                {summary.imported} imported · {summary.failed} failed · {summary.duplicates}{" "}
                duplicates · {summary.skipped} skipped
              </p>
            </div>
          ) : null}

          {validated.length > 0 ? (
            <div className="overflow-x-auto rounded-lg border border-border/70">
              <table className="min-w-full text-sm">
                <thead className="bg-muted/40 text-left">
                  <tr>
                    <th className="px-2 py-2">#</th>
                    <th className="px-2 py-2">Asset name</th>
                    <th className="px-2 py-2">Type</th>
                    <th className="px-2 py-2">Status</th>
                    <th className="px-2 py-2">Assignee</th>
                    <th className="px-2 py-2">Employee ID</th>
                    <th className="px-2 py-2">Location</th>
                    <th className="px-2 py-2">Validation</th>
                  </tr>
                </thead>
                <tbody>
                  {validated.map((row) => (
                    <tr key={row.row_number} className="border-t border-border/60">
                      <td className="px-2 py-1.5 text-muted-foreground">{row.row_number}</td>
                      <td className="px-2 py-1.5 font-medium">{row.asset_name}</td>
                      <td className="px-2 py-1.5 text-xs">{row.asset_type || "—"}</td>
                      <td className="px-2 py-1.5 text-xs">{row.operational_status}</td>
                      <td className="px-2 py-1.5 text-xs">{row.assignee_name ?? "—"}</td>
                      <td className="px-2 py-1.5 font-mono text-xs">
                        {row.employee_code ?? "—"}
                      </td>
                      <td className="px-2 py-1.5 text-xs">{row.location ?? "—"}</td>
                      <td className="px-2 py-1.5">
                        {row.errors.length === 0 ? (
                          <span className="text-emerald-700">OK</span>
                        ) : (
                          <span className="flex items-start gap-1 text-destructive">
                            <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
                            {row.errors.join("; ")}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>

        <div className="flex justify-end gap-2 border-t border-border px-5 py-4">
          <Button type="button" variant="ghost" className="cursor-pointer" onClick={close}>
            {summary ? "Close" : "Cancel"}
          </Button>
          {!summary ? (
            <Button
              type="button"
              className={cn("cursor-pointer")}
              disabled={!canImport}
              onClick={() => void confirmImport()}
            >
              {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Import {validated.length > 0 ? `${validated.length} assets` : ""}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
