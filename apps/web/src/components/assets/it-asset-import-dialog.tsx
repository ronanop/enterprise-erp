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
  isMissingPermissionError,
  listEmployeeDirectory,
  normalizeEmployeeCodeKey,
  type EmployeeDirectoryEntry,
} from "@/lib/org-options";
import { getStoredOrgContext } from "@/lib/org-context-storage";
import { ensureSessionBranch } from "@/lib/ensure-session-branch";
import { ApiClientError } from "@/services/api-client";
import {
  listSiteLocations,
  type SiteLocation,
} from "@/services/asset-site-location-service";
import type { ItAssetType } from "@/services/asset-type-service";
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
  "Asset Type",
  "Assignee",
  "Employee ID",
  "OperationalStatus",
  "Maintenance Reason",
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
      Configuration: "Apple M4 / 16 GB / 512 GB",
      Charger: "CHG12345",
      "Asset Type": laptop,
      Assignee: "Asha Nair",
      "Employee ID": "EMP-001",
      OperationalStatus: "Assigned",
      "Maintenance Reason": "",
      Location: "Mumbai",
      "Issue Date": "2025-01-15",
      Charger: "CHG-1001",
    },
    {
      "Asset Name": "Dell Monitor 27",
      "S/N": "SN-1002",
      Make: "Dell",
      Model: "U2720Q",
      Configuration: "",
      Charger: "",
      "Asset Type": monitor,
      Assignee: "",
      "Employee ID": "",
      OperationalStatus: "Ready to Move",
      "Maintenance Reason": "",
      Location: "New Delhi",
      "Issue Date": "",
      Charger: "",
    },
    {
      "Asset Name": "Lenovo ThinkPad T14",
      "S/N": "SN-1003",
      Make: "Lenovo",
      Model: "T14",
      Configuration: "i5 10th GEN 16/512GB",
      "Asset Type": laptop,
      Assignee: "",
      "Employee ID": "",
      OperationalStatus: "In Maintenance",
      "Maintenance Reason": "Screen flicker / hardware check",
      Location: "Mumbai",
      "Issue Date": "",
      Charger: "",
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

    const configurationRaw = pickField(mapped, ["configuration", "config"]);
    const configuration =
      configurationRaw.length > 500 ? configurationRaw.slice(0, 500) : configurationRaw || null;
    const maintenance_reason =
      pickField(mapped, [
        "maintenance_reason",
        "reason",
        "maintenance_remarks",
        "remarks",
      ]) || null;

    out.push({
      row_number: index + 2,
      asset_name,
      serial_number: pickField(mapped, ["s_n", "sn", "serial_number", "serial"]) || null,
      make: pickField(mapped, ["make", "manufacturer", "brand"]) || null,
      model: pickField(mapped, ["model"]) || null,
      configuration:
        pickField(mapped, ["configuration", "config", "specs", "hardware_configuration"]) || null,
      charger_serial:
        pickField(mapped, ["charger", "charger_serial", "charger_sn", "charger_s_n"]) || null,
      asset_type,
      assignee_name,
      employee_code,
      operational_status,
      location,
      issue_date: parseIssueDate(mapped.issue_date ?? mapped.issue),
      charger_serial:
        pickField(mapped, ["charger", "charger_serial", "charger_sn"]) || null,
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
  options: { skipEmployeeLookup?: boolean } = {},
): ParsedImportRow[] {
  const empByCode = new Map(
    employees
      .filter((e) => e.employeeCode)
      .map((e) => [e.employeeCode!.toLowerCase(), e]),
  );
  const locByName = new Map(locations.map((l) => [normalizeName(l.name), l]));
  const typeByName = new Map(
    assetTypes
      .filter((t) => t.active)
      .map((t) => [normalizeName(t.name), t]),
  );

  return rows.map((row) => {
    const errors: string[] = [];
    if (!row.asset_type.trim()) {
      errors.push("Asset Type is required");
    } else {
      const type = typeByName.get(normalizeName(row.asset_type));
      if (!type) errors.push(`Asset type '${row.asset_type}' not found`);
    }
    if (row.operational_status === "ASSIGNED" && !row.employee_code) {
      errors.push("Assigned status requires Employee ID");
    }
    if (row.operational_status === "IN_MAINTENANCE" && !row.maintenance_reason?.trim()) {
      errors.push("In Maintenance status requires Maintenance Reason");
    }
    if (row.employee_code && !options.skipEmployeeLookup) {
      const emp =
        empByCode.get(row.employee_code.toLowerCase()) ??
        empByCode.get(normalizeEmployeeCodeKey(row.employee_code));
      if (!emp) {
        errors.push(`Employee ID '${row.employee_code}' not found`);
      } else if (row.assignee_name && !namesMatch(row.assignee_name, emp)) {
        errors.push(
          `Assignee '${row.assignee_name}' does not match employee ${emp.displayName}`,
        );
      }
    }
    if (row.location) {
      const loc = locByName.get(normalizeName(row.location));
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
    { wch: 24 },
    { wch: 14 },
    { wch: 12 },
    { wch: 16 },
    { wch: 28 },
    { wch: 14 },
    { wch: 14 },
    { wch: 20 },
    { wch: 14 },
    { wch: 18 },
    { wch: 28 },
    { wch: 16 },
    { wch: 12 },
    { wch: 14 },
  ];

  const activeTypes = types.filter((t) => t.active);
  const typeRows =
    activeTypes.length > 0
      ? activeTypes.map((t) => ({ asset_type: t.name }))
      : [{ asset_type: "(create asset types in Configuration first)" }];

  const typesSheet = XLSX.utils.json_to_sheet(typeRows);
  typesSheet["!cols"] = [{ wch: 28 }];

  const statusSheet = XLSX.utils.aoa_to_sheet([
    ["OperationalStatus"],
    ["Ready to Move"],
    ["Assigned"],
    ["In Maintenance"],
  ]);
  statusSheet["!cols"] = [{ wch: 18 }];

  const refSheet = XLSX.utils.aoa_to_sheet([
    ["OperationalStatus values (use only these)"],
    ["Ready to Move"],
    ["Assigned"],
    ["In Maintenance"],
    [],
    ["Notes"],
    ["Asset codes (AST-2026-000001) are auto-generated - do not add an Asset Code column."],
    ["Location must match a name from Assets → Locations (case-insensitive)."],
    ["If Location is missing, add it under Assets → Locations first, then re-import."],
    ["Assignee = employee name; Employee ID = code (e.g. EMP-001). Both required when Assigned."],
    ["Maintenance Reason is required when OperationalStatus is In Maintenance (no assignee needed)."],
    ["In Maintenance defaults: start date = today, expected duration = 7 days."],
    ["Asset Type must match Configuration → Asset Types (see Available types sheet)."],
    ["Configuration is free text (e.g. Intel Core i5 / Gen 11 / 512 GB) and saved on the asset."],
    ["Charger = charger serial number (e.g. CHG12345). Creates and links a CHARGER component."],
  ]);
  refSheet["!cols"] = [{ wch: 90 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, importSheet, "Import");
  XLSX.utils.book_append_sheet(wb, typesSheet, "Available types");
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
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      try {
        const fresh = await listSiteLocations();
        if (!cancelled) setLocations(fresh);
      } catch {
        if (!cancelled) setLocations(siteLocations);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, siteLocations]);

  if (!open) return null;

  const resolvedCompanyId =
    companyId ||
    locations.find((l) => l.company_id)?.company_id ||
    siteLocations.find((l) => l.company_id)?.company_id ||
    getStoredOrgContext()?.companyId ||
    undefined;

  const needsEmployeeDirectory = preview.some((r) => Boolean(r.employee_code));
  const validated = validateRows(preview, employees, locations, assetTypes, {
    skipEmployeeLookup: employeesLoadFailed,
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

  async function refreshLocations() {
    try {
      setLocations(await listSiteLocations());
    } catch {
      /* keep last known list */
    }
  }

  async function onFile(file: File) {
    setError(null);
    setSummary(null);
    setFileName(file.name);
    setParsing(true);
    setEmployeesLoadFailed(false);
    try {
      await Promise.all([loadEmployees(), refreshLocations()]);
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
      const companyForImport =
        resolvedCompanyId || sessionScope?.company_id || undefined;
      const branchForImport =
        fallbackBranchId || sessionScope?.branch_id || undefined;

      if (!companyForImport) {
        setError(
          "Company context is required for import. Select a company in the header, then retry.",
        );
        return;
      }

      const empByCode = new Map<string, string>();
      for (const e of employees) {
        if (!e.employeeCode) continue;
        empByCode.set(e.employeeCode.toLowerCase(), e.id);
        empByCode.set(normalizeEmployeeCodeKey(e.employeeCode), e.id);
      }

      const revalidated = validateRows(preview, employees, locations, assetTypes, {
        skipEmployeeLookup: employeesLoadFailed,
      });
      const stillInvalid = revalidated.filter((r) => r.errors.length > 0);
      if (stillInvalid.length > 0) {
        setError(
          stillInvalid[0]?.errors[0] ??
            `Location not found. ${LOCATION_MISSING_HINT}`,
        );
        setBusy(false);
        return;
      }

      const typeByName = new Map(
        assetTypes.filter((t) => t.active).map((t) => [normalizeName(t.name), t.id]),
      );
      const locByName = new Map(
        locations.map((l) => [normalizeName(l.name), l]),
      );

      const apiRows = revalidated.map((row) => {
        const loc = row.location
          ? locByName.get(normalizeName(row.location))
          : undefined;
        return {
          row_number: row.row_number,
          preview_status: "valid",
          asset_name: row.asset_name,
          ...(branchForImport ? { branch_id: branchForImport } : {}),
          company_id: companyForImport,
          operational_status: row.operational_status,
          employee_id: row.employee_code
            ? empByCode.get(row.employee_code.toLowerCase()) ?? null
            : null,
          asset_type_id: typeByName.get(normalizeName(row.asset_type))!,
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
                maintenance_reason: row.maintenance_reason,
                expected_duration_days: 7,
              }
            : {}),
        };
      });

      const resolvedCompanyId =
        companyId ||
        locations.find((l) => l.company_id)?.company_id ||
        locations[0]?.company_id ||
        undefined;

      const result = await assetOperationsService.importExcelRegister({
        company_id: companyForImport,
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
              Asset codes are generated automatically. Location must match a name from Assets →
              Locations (case-insensitive). If missing, add it there first, then re-import.
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
            <div
              className={cn(
                "rounded-lg border px-4 py-3 text-sm",
                summary.failed > 0
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
              {summary.rows.some((r) => r.outcome === "failed" && r.reason) ? (
                <ul className="mt-2 list-inside list-disc text-xs">
                  {summary.rows
                    .filter((r) => r.outcome === "failed" && r.reason)
                    .map((r) => (
                      <li key={r.row_number}>
                        Row {r.row_number}: {r.reason}
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
                    <th className="px-2 py-2">#</th>
                    <th className="px-2 py-2">Asset name</th>
                    <th className="px-2 py-2">Type</th>
                    <th className="px-2 py-2">Configuration</th>
                    <th className="px-2 py-2">Charger</th>
                    <th className="px-2 py-2">Status</th>
                    {validated.some((r) => r.operational_status === "IN_MAINTENANCE") ? (
                      <th className="px-2 py-2">Maintenance reason</th>
                    ) : null}
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
                      <td className="px-2 py-1.5 text-xs">{row.asset_type || "-"}</td>
                      <td className="max-w-[10rem] truncate px-2 py-1.5 text-xs" title={row.configuration ?? undefined}>
                        {row.configuration ?? "-"}
                      </td>
                      <td className="px-2 py-1.5 font-mono text-xs">{row.charger_serial ?? "-"}</td>
                      <td className="px-2 py-1.5 text-xs">{row.operational_status}</td>
                      {validated.some((r) => r.operational_status === "IN_MAINTENANCE") ? (
                        <td className="max-w-[12rem] truncate px-2 py-1.5 text-xs" title={row.maintenance_reason ?? undefined}>
                          {row.operational_status === "IN_MAINTENANCE"
                            ? row.maintenance_reason || "—"
                            : "—"}
                        </td>
                      ) : null}
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
