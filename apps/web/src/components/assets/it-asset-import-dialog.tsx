"use client";

import { useEffect, useRef, useState } from "react";
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
import {
  employeeDirectoryPermissionMessage,
  findEmployeeByCode,
  indexEmployeesByCode,
  isMissingPermissionError,
  listEmployeeDirectory,
  type EmployeeDirectoryEntry,
} from "@/lib/org-options";
import { getStoredOrgContext } from "@/lib/org-context-storage";
import { ensureSessionBranch } from "@/lib/ensure-session-branch";
import { ApiClientError } from "@/services/api-client";
import {
  listSiteLocations,
  type SiteLocation,
} from "@/services/asset-site-location-service";
import {
  listItAssetTypes,
  type ItAssetType,
} from "@/services/asset-type-service";
import { assetOperationsService } from "@/services/assets-service";

const LOCATION_MISSING_HINT =
  "Please add it under Assets → Locations first.";

type ParsedImportRow = {
  row_number: number;
  asset_name: string;
  serial_number: string | null;
  make: string | null;
  model: string | null;
  configuration: string | null;
  charger_serial: string | null;
  asset_type: string;
  assignee_name: string | null;
  employee_code: string | null;
  operational_status: string;
  location: string | null;
  issue_date: string | null;
  maintenance_reason: string | null;
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
  /** Used only for API payload when session branch is unset - not shown in UI. */
  fallbackBranchId?: string;
  /** Optional company scope for import; falls back to site location company. */
  companyId?: string;
  currencyCode?: string;
  onImported: () => void;
};

const TEMPLATE_HEADERS = [
  "Asset Name",
  "S/N",
  "Make",
  "Model",
  "Configuration",
  "Charger",
  "Assigned",
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
      "Asset Name": laptop,
      "S/N": "SN-1001",
      Make: "Apple",
      Model: "M4 14",
      Configuration: "Apple M4 / 16 GB / 512 GB",
      Charger: "CHG-1001",
      Assigned: "Asha Nair",
      "Employee ID": "EMP-001",
      OperationalStatus: "Assigned",
      Location: "Mumbai",
      "Issue Date": "2025-01-15",
    },
    {
      "Asset Name": monitor,
      "S/N": "SN-1002",
      Make: "Dell",
      Model: "U2720Q",
      Configuration: "",
      Charger: "",
      Assigned: "",
      "Employee ID": "",
      OperationalStatus: "In Stock",
      Location: "New Delhi",
      "Issue Date": "",
    },
    {
      "Asset Name": laptop,
      "S/N": "SN-1003",
      Make: "Lenovo",
      Model: "T14",
      Configuration: "i5 10th GEN 16/512GB",
      Charger: "",
      Assigned: "",
      "Employee ID": "",
      OperationalStatus: "In Maintenance",
      Location: "Mumbai",
      "Issue Date": "",
    },
  ];
}

function normalizeHeader(key: string): string {
  return key.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_");
}

function normalizeOpsStatus(raw: string): string {
  const v = raw.trim().toLowerCase().replace(/\s+/g, "_");
  if (!v || v === "ready" || v === "ready_to_move" || v === "in_stock") return "READY_TO_MOVE";
  if (v === "assigned") return "ASSIGNED";
  if (
    v === "in_maintenance" ||
    v === "maintenance" ||
    v === "maintaince" ||
    v === "in_maintaince"
  ) {
    return "IN_MAINTENANCE";
  }
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

function findLocationForCompany(
  locations: SiteLocation[],
  name: string | null | undefined,
  companyId: string | null | undefined,
): SiteLocation | undefined {
  if (!name?.trim()) return undefined;
  const key = normalizeName(name);
  const matches = locations.filter((l) => normalizeName(l.name) === key);
  if (matches.length === 0) return undefined;
  if (companyId) {
    return matches.find((l) => l.company_id === companyId);
  }
  return matches[0];
}

function findAssetTypeForCompany(
  assetTypes: ItAssetType[],
  name: string,
  companyId: string | null | undefined,
): ItAssetType | undefined {
  const key = normalizeName(name);
  const matches = assetTypes.filter((t) => t.active && normalizeName(t.name) === key);
  if (matches.length === 0) return undefined;
  // Never fall back to another company's type — that yields "Asset type not found"
  // (or company mismatch) on the API when the row company differs from the type.
  if (companyId) {
    return matches.find((t) => t.company_id === companyId);
  }
  return matches[0];
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
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    const y = raw.getFullYear();
    const mm = String(raw.getMonth() + 1).padStart(2, "0");
    const dd = String(raw.getDate()).padStart(2, "0");
    return `${y}-${mm}-${dd}`;
  }
  const text = String(raw).trim();
  if (!text) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const d = new Date(text);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${mm}-${dd}`;
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
  json.forEach((raw) => {
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
      pickField(mapped, [
        "assigned",
        "assignee",
        "assignee_name",
        "employee_name",
        "employee",
      ]) || null;
    const employee_code =
      pickField(mapped, ["employee_id", "employeeid", "emp_id", "assignee_employee_id"]) ||
      null;

    const location = pickField(mapped, ["location", "site", "site_location"]) || null;
    const opsRaw = pickField(mapped, ["operationalstatus", "operational_status", "status"]);
    const operational_status = normalizeOpsStatus(opsRaw || "in stock");
    // Asset Name is the type (same as Add Asset). Optional legacy Asset Type column still accepted.
    const asset_type =
      pickField(mapped, ["asset_type", "type", "assettype"]) || asset_name;

    const configurationRaw =
      pickField(mapped, ["configuration", "config", "specs", "hardware_configuration"]) || "";
    const configuration =
      configurationRaw.length > 500
        ? configurationRaw.slice(0, 500)
        : configurationRaw || null;
    const maintenance_reason =
      pickField(mapped, [
        "maintenance_reason",
        "reason",
        "maintenance_remarks",
        "remarks",
      ]) || null;

    out.push({
      // Contiguous serial for valid rows only (blank Excel rows are skipped).
      row_number: out.length + 1,
      asset_name,
      serial_number: pickField(mapped, ["s_n", "sn", "serial_number", "serial"]) || null,
      make: pickField(mapped, ["make", "manufacturer", "brand"]) || null,
      model: pickField(mapped, ["model"]) || null,
      configuration,
      charger_serial:
        pickField(mapped, ["charger", "charger_serial", "charger_sn", "charger_s_n"]) || null,
      asset_type,
      assignee_name,
      employee_code,
      operational_status,
      location,
      issue_date: parseIssueDate(mapped.issue_date ?? mapped.issue),
      maintenance_reason,
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
  options: {
    skipEmployeeLookup?: boolean;
    /** Session / dialog company — used when row cannot resolve employee/location company. */
    fallbackCompanyId?: string | null;
  } = {},
): ParsedImportRow[] {
  const empByCode = indexEmployeesByCode(employees);

  return rows.map((row) => {
    const errors: string[] = [];
    const emp =
      row.employee_code && !options.skipEmployeeLookup
        ? findEmployeeByCode(empByCode, row.employee_code)
        : undefined;
    const provisionalCompany =
      emp?.companyId ||
      findLocationForCompany(locations, row.location, null)?.company_id ||
      options.fallbackCompanyId ||
      null;

    if (!row.asset_type.trim()) {
      errors.push("Asset Name is required and must match an Asset Type");
    } else {
      const type = findAssetTypeForCompany(assetTypes, row.asset_type, provisionalCompany);
      if (!type) {
        errors.push(
          provisionalCompany
            ? `Asset type '${row.asset_name}' not found for this company. Create it under Configuration → Asset Types for the assignee/location company.`
            : `Asset Name '${row.asset_name}' must match a type under Configuration → Asset Types`,
        );
      }
    }
    if (row.operational_status === "ASSIGNED" && !row.employee_code) {
      errors.push("Assigned status requires Employee ID");
    }
    if (row.employee_code && !options.skipEmployeeLookup) {
      if (!emp) {
        errors.push(`Employee ID '${row.employee_code}' not found`);
      } else if (row.assignee_name && !namesMatch(row.assignee_name, emp)) {
        errors.push(
          `Assigned '${row.assignee_name}' does not match employee ${emp.displayName}`,
        );
      }
    }
    if (row.location) {
      const loc = findLocationForCompany(locations, row.location, provisionalCompany);
      if (!loc) {
        errors.push(
          `Location '${row.location}' not found. ${LOCATION_MISSING_HINT}`,
        );
      }
    }
    const allowed = ["READY_TO_MOVE", "ASSIGNED", "IN_MAINTENANCE"];
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
    { wch: 18 },
    { wch: 14 },
    { wch: 12 },
    { wch: 16 },
    { wch: 28 },
    { wch: 14 },
    { wch: 18 },
    { wch: 14 },
    { wch: 18 },
    { wch: 16 },
    { wch: 12 },
  ];

  const activeTypes = types.filter((t) => t.active);
  const typeRows =
    activeTypes.length > 0
      ? activeTypes.map((t) => ({ "Asset Name (must match type)": t.name }))
      : [{ "Asset Name (must match type)": "(create asset types in Configuration first)" }];

  const typesSheet = XLSX.utils.json_to_sheet(typeRows);
  typesSheet["!cols"] = [{ wch: 36 }];

  const statusSheet = XLSX.utils.aoa_to_sheet([
    ["OperationalStatus"],
    ["In Stock"],
    ["Assigned"],
    ["In Maintenance"],
  ]);
  statusSheet["!cols"] = [{ wch: 18 }];

  const refSheet = XLSX.utils.aoa_to_sheet([
    ["OperationalStatus values (use only these)"],
    ["In Stock"],
    ["Assigned"],
    ["In Maintenance"],
    [],
    ["Notes"],
    ["Asset codes (AST-2026-000001) are auto-generated - do not add an Asset Code column."],
    ["Asset Name must match Configuration → Asset Types (see Available names sheet)."],
    ["Location must match a name from Assets → Locations (case-insensitive)."],
    ["If Location is missing, add it under Assets → Locations first, then re-import."],
    ["Assigned = employee name; Employee ID = code (e.g. EMP-001). Both required when OperationalStatus is Assigned."],
    ["In Maintenance defaults: start date = today, expected duration = 7 days."],
    ["Configuration is free text (e.g. Intel Core i5 / Gen 11 / 512 GB) and saved on the asset."],
    ["Charger = charger code (same as Add Asset → Charger Code, e.g. CHG-1001). Saved as the CHARGER component code."],
  ]);
  refSheet["!cols"] = [{ wch: 90 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, importSheet, "Import");
  XLSX.utils.book_append_sheet(wb, typesSheet, "Available names");
  XLSX.utils.book_append_sheet(wb, statusSheet, "Status dropdown");
  XLSX.utils.book_append_sheet(wb, refSheet, "Reference");

  // Excel data validation list for OperationalStatus (column I = index 8).
  const statusRange = "'Status dropdown'!$A$2:$A$4";
  importSheet["!dataValidation"] = [
    {
      sqref: `I2:I1000`,
      type: "list",
      allowBlank: true,
      formulas: [statusRange],
    },
  ];

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
  companyId,
  currencyCode = "INR",
  onImported,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<ParsedImportRow[]>([]);
  const [employees, setEmployees] = useState<EmployeeDirectoryEntry[]>([]);
  const [employeesLoadFailed, setEmployeesLoadFailed] = useState(false);
  const [locations, setLocations] = useState<SiteLocation[]>(siteLocations);
  const [types, setTypes] = useState<ItAssetType[]>(assetTypes);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      // Load tenant-wide types/locations so rows for assignee companies other than
      // the session company still validate and map to the correct type id.
      const [freshLocs, freshTypes] = await Promise.all([
        listSiteLocations().catch(() => siteLocations),
        listItAssetTypes({ active: true }).catch(() => assetTypes),
      ]);
      if (!cancelled) {
        setLocations(freshLocs);
        setTypes(freshTypes);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, siteLocations, assetTypes]);

  if (!open) return null;

  const resolvedCompanyId =
    companyId ||
    locations.find((l) => l.company_id)?.company_id ||
    siteLocations.find((l) => l.company_id)?.company_id ||
    getStoredOrgContext()?.companyId ||
    undefined;

  const needsEmployeeDirectory = preview.some((r) => Boolean(r.employee_code));
  const validated = validateRows(preview, employees, locations, types, {
    skipEmployeeLookup: employeesLoadFailed,
    fallbackCompanyId: resolvedCompanyId,
  });
  const invalidCount = validated.filter((r) => r.errors.length > 0).length;
  const canImport =
    !busy &&
    !parsing &&
    validated.length > 0 &&
    invalidCount === 0 &&
    !summary &&
    !(employeesLoadFailed && needsEmployeeDirectory);

  async function loadEmployees() {
    try {
      setEmployees(await listEmployeeDirectory({ throwOnError: true }));
      setEmployeesLoadFailed(false);
    } catch (err) {
      setEmployees([]);
      setEmployeesLoadFailed(true);
      if (isMissingPermissionError(err, "master.employee:read")) {
        setError(employeeDirectoryPermissionMessage(err));
      } else {
        setError(
          err instanceof ApiClientError
            ? err.message
            : "Could not load employee directory for import validation.",
        );
      }
      throw err;
    }
  }

  async function refreshMasters() {
    const [freshLocs, freshTypes] = await Promise.all([
      listSiteLocations().catch(() => locations),
      listItAssetTypes({ active: true }).catch(() => types),
    ]);
    setLocations(freshLocs);
    setTypes(freshTypes);
    return { locations: freshLocs, types: freshTypes };
  }

  async function onFile(file: File) {
    setError(null);
    setSummary(null);
    setFileName(file.name);
    setParsing(true);
    setEmployeesLoadFailed(false);
    try {
      await Promise.all([loadEmployees(), refreshMasters()]);
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

      const fileNeedsEmployees = rows.some((r) => Boolean(r.employee_code));
      try {
        await loadEmployees();
      } catch {
        // Permission / load failure already set dialog error.
        // Keep preview for READY_TO_MOVE rows that do not need employees.
        if (!fileNeedsEmployees) {
          setError(null);
        }
      }
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
      const sessionScope = await ensureSessionBranch();
      const sessionCompanyId =
        resolvedCompanyId || sessionScope?.company_id || undefined;
      const sessionBranchId =
        fallbackBranchId || sessionScope?.branch_id || undefined;

      if (!sessionCompanyId && !sessionScope?.company_id) {
        setError(
          "Company context is required for import. Select a company in the header, then retry.",
        );
        return;
      }

      const masters = await refreshMasters();
      const empByCode = indexEmployeesByCode(employees);

      const revalidated = validateRows(
        preview,
        employees,
        masters.locations,
        masters.types,
        {
          skipEmployeeLookup: employeesLoadFailed,
          fallbackCompanyId: sessionCompanyId,
        },
      );
      const stillInvalid = revalidated.filter((r) => r.errors.length > 0);
      if (stillInvalid.length > 0) {
        setError(
          stillInvalid[0]?.errors[0] ??
          `Location not found. ${LOCATION_MISSING_HINT}`,
        );
        return;
      }

      const apiRows: Array<Record<string, unknown>> = [];
      for (const row of revalidated) {
        const matchedEmployee = row.employee_code
          ? findEmployeeByCode(empByCode, row.employee_code)
          : undefined;

        // Prefer employee company (ASSIGNED), else location company, else session.
        // Avoids "Asset type does not belong to this company" when header company ≠ row data.
        const provisionalCompany =
          matchedEmployee?.companyId ||
          findLocationForCompany(masters.locations, row.location, null)?.company_id ||
          sessionCompanyId ||
          sessionScope?.company_id ||
          undefined;

        if (!provisionalCompany) {
          setError(
            `Row ${row.row_number}: could not resolve company for import. Select a company in the header.`,
          );
          return;
        }

        const loc = findLocationForCompany(
          masters.locations,
          row.location,
          provisionalCompany,
        );
        const assetType = findAssetTypeForCompany(
          masters.types,
          row.asset_type,
          provisionalCompany,
        );
        if (!assetType) {
          setError(
            `Row ${row.row_number}: Asset type '${row.asset_type}' not found for this company.`,
          );
          return;
        }

        const rowCompanyId = loc?.company_id || matchedEmployee?.companyId || provisionalCompany;
        const rowBranchId =
          (matchedEmployee?.companyId === rowCompanyId && matchedEmployee.branchId) ||
          (sessionCompanyId === rowCompanyId ? sessionBranchId : undefined) ||
          sessionBranchId ||
          undefined;

        if (!rowBranchId) {
          setError(
            `Row ${row.row_number}: branch context is required. Select a branch in the header, then retry.`,
          );
          return;
        }

        apiRows.push({
          row_number: row.row_number,
          preview_status: "valid",
          asset_name: row.asset_name,
          branch_id: rowBranchId,
          company_id: rowCompanyId,
          operational_status: row.operational_status,
          employee_id: matchedEmployee?.id ?? null,
          asset_type_id: assetType.id,
          serial_number: row.serial_number,
          make: row.make,
          model: row.model,
          configuration: row.configuration,
          charger_serial: row.charger_serial,
          location_label: row.location,
          ...(loc ? { location_id: loc.id } : {}),
          issue_date: row.issue_date,
          ...(row.operational_status === "IN_MAINTENANCE"
            ? {
              expected_duration_days: 7,
              maintenance_reason: row.maintenance_reason || "excel_import",
            }
            : {}),
        });
      }

      const batchCompanyId =
        (apiRows[0]?.company_id as string | undefined) ||
        sessionCompanyId ||
        sessionScope?.company_id;

      const result = await assetOperationsService.importExcelRegister({
        company_id: batchCompanyId,
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
      if (result.failed > 0 && result.imported === 0) {
        const firstFail = result.rows.find(
          (r) => r.outcome === "failed" && typeof r.reason === "string" && r.reason,
        );
        setError(
          firstFail?.reason
            ? String(firstFail.reason)
            : `Import failed for ${result.failed} row(s).`,
        );
      }
      onImported();
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Import failed",
      );
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
              onClick={() => downloadItAssetImportTemplate(types)}
            >
              <Download className="mr-2 size-4" />
              Download Template
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
            <div
              className={cn(
                "rounded-lg border px-4 py-3 text-sm",
                summary.failed > 0 || summary.imported === 0
                  ? "border-amber-200 bg-amber-50 text-amber-950"
                  : "border-emerald-200 bg-emerald-50 text-emerald-950",
              )}
            >
              <p className="flex items-center gap-2 font-medium">
                <CheckCircle2 className="size-4" />
                Import complete
              </p>
              <p className="mt-1">
                {summary.imported} imported · {summary.failed} failed · {summary.duplicates}{" "}
                duplicates · {summary.skipped} skipped
              </p>
              {summary.rows.some(
                (r) =>
                  Boolean(r.reason) &&
                  (r.outcome === "failed" ||
                    r.outcome === "duplicate" ||
                    r.outcome === "skipped"),
              ) ? (
                <ul className="mt-2 list-inside list-disc text-xs">
                  {summary.rows
                    .filter(
                      (r) =>
                        Boolean(r.reason) &&
                        (r.outcome === "failed" ||
                          r.outcome === "duplicate" ||
                          r.outcome === "skipped"),
                    )
                    .map((r) => (
                      <li key={`${r.outcome}-${r.row_number}`}>
                        Row {r.row_number} ({r.outcome}): {r.reason}
                      </li>
                    ))}
                </ul>
              ) : null}
            </div>
          ) : null}

          {validated.length > 0 ? (
            <div className="overflow-x-auto rounded-lg border border-border/70">
              <table className="min-w-full text-sm">
                <thead className="bg-muted/40 text-left">
                  <tr>
                    <th className="px-2 py-2">Asset Name</th>
                    <th className="px-2 py-2">Configuration</th>
                    <th className="px-2 py-2">Charger</th>
                    <th className="px-2 py-2">Status</th>
                    <th className="px-2 py-2">Assigned</th>
                    <th className="px-2 py-2">Employee ID</th>
                    <th className="px-2 py-2">Location</th>
                    <th className="px-2 py-2">Validation</th>
                  </tr>
                </thead>
                <tbody>
                  {validated.map((row) => (
                    <tr key={row.row_number} className="border-t border-border/60">
                      <td className="px-2 py-1.5 font-medium">{row.asset_name}</td>
                      <td className="max-w-[10rem] truncate px-2 py-1.5 text-xs" title={row.configuration ?? undefined}>
                        {row.configuration ?? "-"}
                      </td>
                      <td className="px-2 py-1.5 font-mono text-xs">{row.charger_serial ?? "-"}</td>
                      <td className="px-2 py-1.5 text-xs">
                        {row.operational_status === "READY_TO_MOVE"
                          ? "In Stock"
                          : row.operational_status === "IN_MAINTENANCE"
                            ? "In Maintenance"
                            : row.operational_status === "ASSIGNED"
                              ? "Assigned"
                              : row.operational_status}
                      </td>
                      <td className="px-2 py-1.5 text-xs">{row.assignee_name ?? "-"}</td>
                      <td className="px-2 py-1.5 font-mono text-xs">
                        {row.employee_code ?? "-"}
                      </td>
                      <td className="px-2 py-1.5 text-xs">{row.location ?? "-"}</td>
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
