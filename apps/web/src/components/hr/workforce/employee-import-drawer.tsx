"use client";

import { useState } from "react";
import { Download, Upload } from "lucide-react";

import { SetupDrawer, SetupField } from "@/components/hr/setup/setup-drawer";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/hr/setup/setup-toast";
import {
  EMPLOYEE_IMPORT_SAMPLE_CSV,
  parseEmployeeImportMatrix,
  type NormalizedEmployeeImportRow,
} from "@/lib/employee-import-map";
import {
  extractDataMatrix,
  parseSpreadsheetFileAsMatrix,
} from "@/lib/spreadsheet";
import { downloadTextFile, invalidateEmployeeDirectoryCache } from "@/services/employee-management-service";
import { bulkImportEmployees } from "@/services/employee-import-service";
import { ApiClientError } from "@/services/api-client";
import { cn } from "@/lib/utils";

const EXCEL_DB_MAPPING = [
  { excel: "Emp Code", db: "master_employee.employee_code" },
  { excel: "NAME", db: "master_employee.first_name + last_name" },
  { excel: "Entity (Digitech / Technologies)", db: "company_id → Cache Digitech / Cache Technologies" },
  { excel: "Organization (Cache)", db: "combined with Entity to pick company" },
  { excel: "Base Location", db: "org_location + hr_employment.work_location_text" },
  { excel: "Designation", db: "hr_designation + assignment + master.designation" },
  { excel: "Department", db: "org_department + master.department_id" },
  { excel: "Reporting Manager", db: "master_employee.reporting_manager_id" },
] as const;

export function EmployeeImportDrawer({
  open,
  onClose,
  onImported,
}: {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}) {
  const [fileName, setFileName] = useState("");
  const [preview, setPreview] = useState<string[][]>([]);
  const [rows, setRows] = useState<NormalizedEmployeeImportRow[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [resultSummary, setResultSummary] = useState<string | null>(null);

  async function onFile(file: File | null) {
    if (!file) return;
    setFileName(file.name);
    setResultSummary(null);
    try {
      const raw = await parseSpreadsheetFileAsMatrix(file);
      const matrix = extractDataMatrix(raw, "emp code");
      const fallback =
        matrix === raw || matrix.length < 2 ? extractDataMatrix(raw, "name") : matrix;
      setPreview(fallback.slice(0, 8));
      const parsed = parseEmployeeImportMatrix(fallback.length >= 2 ? fallback : raw);
      setRows(parsed.rows);
      setErrors(parsed.errors);
      setWarnings(parsed.warnings);
    } catch (err) {
      setPreview([]);
      setRows([]);
      setWarnings([]);
      setErrors([err instanceof Error ? err.message : "Could not read file."]);
    }
  }

  async function runImport() {
    if (!rows.length || errors.length) return;
    setBusy(true);
    try {
      const result = await bulkImportEmployees(rows);
      const msg = `Import done — created ${result.created}, updated ${result.updated}, skipped ${result.skipped}`;
      setResultSummary(msg);
      toast(msg, result.skipped && !result.created && !result.updated ? "error" : "success");
      if (result.warnings?.length) {
        setWarnings((w) => [...w, ...result.warnings].slice(0, 80));
      }
      if (result.errors?.length) {
        setErrors((e) => [...e, ...result.errors].slice(0, 80));
      }
      if (result.created > 0 || result.updated > 0) {
        invalidateEmployeeDirectoryCache();
        onImported();
      }
    } catch (err) {
      toast(err instanceof ApiClientError ? err.message : "Import failed", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <SetupDrawer
      open={open}
      title="Import Employees"
      description="Upload CSV/Excel. Email is optional. Same Emp Code updates existing — no duplicates."
      wide
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="outline" size="sm" className="cursor-pointer" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            className="cursor-pointer"
            disabled={busy || rows.length === 0}
            onClick={() => void runImport()}
          >
            {busy ? "Importing…" : `Import ${rows.length || ""} row${rows.length === 1 ? "" : "s"}`}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="cursor-pointer"
          onClick={() =>
            downloadTextFile("employee-import-template.csv", EMPLOYEE_IMPORT_SAMPLE_CSV, "text/csv")
          }
        >
          <Download className="size-3.5" />
          Download sample CSV
        </Button>
        <SetupField
          label="Upload file"
          hint="Columns: Emp Code, NAME, Entity, Organisation, Base Location, Designation, Department, Reporting Manager (Email optional)"
        >
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-border px-3 py-6 text-xs text-muted-foreground hover:bg-muted/30">
            <Upload className="size-4" />
            {fileName || "Choose CSV or Excel file"}
            <input
              type="file"
              accept=".csv,.xlsx,.xlsm,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="sr-only"
              onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
            />
          </label>
        </SetupField>

        <div className="rounded-lg border border-border/70 bg-muted/20 p-3">
          <p className="mb-2 text-[11px] font-semibold text-foreground">Excel → DB mapping</p>
          <ul className="space-y-1 text-[10px] text-muted-foreground">
            {EXCEL_DB_MAPPING.map((row) => (
              <li key={row.excel} className="flex gap-2">
                <span className="w-28 shrink-0 font-medium text-foreground/80">{row.excel}</span>
                <span>→ {row.db}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[10px] text-muted-foreground">
            Entity <span className="font-medium">Digitech</span> → Cache Digitech ·{" "}
            <span className="font-medium">Technologies</span> (+ Organization Cache) → Cache
            Technologies. CT/CTS/GBP codes default to Technologies; CDPL to Digitech. Locations and
            designations are created if missing. Same Emp Code updates that employee.
          </p>
        </div>

        {resultSummary ? (
          <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
            {resultSummary}
          </p>
        ) : null}

        {errors.length ? (
          <ul className="max-h-32 overflow-auto rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        ) : null}

        {warnings.length ? (
          <ul className="max-h-28 overflow-auto rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            {warnings.slice(0, 40).map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        ) : null}

        {preview.length ? (
          <div className="overflow-x-auto rounded-lg border border-border/70">
            <table className="w-full text-left text-xs">
              <tbody>
                {preview.map((row, ri) => (
                  <tr key={ri} className={cn("border-b border-border/50", ri === 0 && "bg-muted/40 font-medium")}>
                    {row.map((cell, ci) => (
                      <td key={ci} className="px-2 py-1.5 whitespace-nowrap">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </SetupDrawer>
  );
}
