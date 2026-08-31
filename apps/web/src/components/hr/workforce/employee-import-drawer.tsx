"use client";

import { useMemo, useState } from "react";
import { Download, Trash2, Upload } from "lucide-react";

import { SetupDrawer, SetupField } from "@/components/hr/setup/setup-drawer";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/hr/setup/setup-toast";
import { useUserPermissions } from "@/hooks/use-user-permissions";
import {
  EMPLOYEE_IMPORT_SAMPLE_CSV,
  IMPORT_FIELD_OPTIONS,
  extractImportHeaders,
  guessColumnMapping,
  parseEmployeeImportWithMapping,
  type ImportFieldKey,
  type NormalizedEmployeeImportRow,
} from "@/lib/employee-import-map";
import {
  extractDataMatrix,
  parseSpreadsheetFileAsMatrix,
} from "@/lib/spreadsheet";
import { clearAllEmployeeExtensions } from "@/lib/employee-extensions-store";
import {
  downloadTextFile,
  invalidateEmployeeDirectoryCache,
} from "@/services/employee-management-service";
import { bulkImportEmployees, clearAllEmployees } from "@/services/employee-import-service";
import { ApiClientError } from "@/services/api-client";
import { cn } from "@/lib/utils";

const LOCAL_EMP_KEY = "erp_hr_local_employees_v1";

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
  const [matrix, setMatrix] = useState<string[][]>([]);
  const [headerIdx, setHeaderIdx] = useState(-1);
  const [displayHeaders, setDisplayHeaders] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<ImportFieldKey[]>([]);
  const [rows, setRows] = useState<NormalizedEmployeeImportRow[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [resultSummary, setResultSummary] = useState<string | null>(null);
  const { isHrmsSuperAdmin } = useUserPermissions();

  const previewRows = useMemo(() => {
    if (headerIdx < 0 || !matrix.length) return [];
    return matrix.slice(headerIdx, headerIdx + 6);
  }, [matrix, headerIdx]);

  function applyMapping(nextMap: ImportFieldKey[], mat: string[][], hdrIdx: number) {
    setColumnMapping(nextMap);
    if (hdrIdx < 0) {
      setRows([]);
      setErrors(["Could not find header row."]);
      setWarnings([]);
      return;
    }
    const parsed = parseEmployeeImportWithMapping(mat, hdrIdx, nextMap);
    setRows(parsed.rows);
    setErrors(parsed.errors);
    setWarnings(parsed.warnings);
  }

  async function onFile(file: File | null) {
    if (!file) return;
    setFileName(file.name);
    setResultSummary(null);
    try {
      const raw = await parseSpreadsheetFileAsMatrix(file);
      const matrixA = extractDataMatrix(raw, "emp code");
      const matrixB =
        matrixA === raw || matrixA.length < 2 ? extractDataMatrix(raw, "name") : matrixA;
      const matrixC =
        matrixB === raw || matrixB.length < 2
          ? extractDataMatrix(raw, "employee")
          : matrixB;
      const working = matrixC.length >= 2 ? matrixC : raw;
      setMatrix(working);

      const { headerIdx: hi, headers, displayHeaders: dh } = extractImportHeaders(working);
      setHeaderIdx(hi);
      setDisplayHeaders(dh);
      const guessed = guessColumnMapping(headers);
      applyMapping(guessed, working, hi);
    } catch (err) {
      setMatrix([]);
      setHeaderIdx(-1);
      setDisplayHeaders([]);
      setColumnMapping([]);
      setRows([]);
      setWarnings([]);
      setErrors([err instanceof Error ? err.message : "Could not read file."]);
    }
  }

  function updateMapAt(idx: number, value: ImportFieldKey) {
    const next = [...columnMapping];
    // Unique: if another column already maps to this field, clear it
    if (value) {
      for (let i = 0; i < next.length; i += 1) {
        if (i !== idx && next[i] === value) next[i] = "";
      }
    }
    next[idx] = value;
    applyMapping(next, matrix, headerIdx);
  }

  async function runClearAll() {
    const ok = window.confirm(
      "Delete ALL employees in the current company?\n\nThis soft-deletes them and frees Emp Codes so you can re-import from Excel. This cannot be undone from the UI.",
    );
    if (!ok) return;
    const typed = window.prompt('Type DELETE to confirm clearing all employees:');
    if (typed !== "DELETE") {
      toast("Clear cancelled", "error");
      return;
    }
    setClearing(true);
    try {
      const result = await clearAllEmployees();
      try {
        localStorage.removeItem(LOCAL_EMP_KEY);
      } catch {
        /* ignore */
      }
      await clearAllEmployeeExtensions();
      invalidateEmployeeDirectoryCache();
      toast(result.message || `Cleared ${result.deleted} employee(s)`, "success");
      onImported();
    } catch (err) {
      toast(err instanceof ApiClientError ? err.message : "Clear failed", "error");
    } finally {
      setClearing(false);
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
      description={
        isHrmsSuperAdmin
          ? "Map Excel columns to employee fields, then import. Clear all first if you want a fresh import."
          : "Map Excel columns to employee fields, then import."
      }
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
            disabled={busy || rows.length === 0 || errors.length > 0}
            onClick={() => void runImport()}
          >
            {busy ? "Importing…" : `Import ${rows.length || ""} row${rows.length === 1 ? "" : "s"}`}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
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
          {isHrmsSuperAdmin ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="cursor-pointer text-destructive hover:bg-destructive/10"
              disabled={clearing}
              onClick={() => void runClearAll()}
            >
              <Trash2 className="size-3.5" />
              {clearing ? "Clearing…" : "Clear all employees"}
            </Button>
          ) : null}
        </div>

        <SetupField label="Upload file" hint="CSV or Excel — then map each column below">
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

        {displayHeaders.length ? (
          <div className="rounded-lg border border-border/70 bg-muted/20 p-3">
            <p className="mb-2 text-[11px] font-semibold text-foreground">
              Map Excel columns → employee fields
            </p>
            <p className="mb-3 text-[10px] text-muted-foreground">
              Auto-detected where possible. Change any dropdown if your headers differ. EMPLOYEE ID
              and NAME are required.
            </p>
            <ul className="space-y-2">
              {displayHeaders.map((header, idx) => (
                <li
                  key={`${header}-${idx}`}
                  className="flex flex-wrap items-center gap-2 text-xs"
                >
                  <span className="min-w-[8rem] flex-1 truncate font-medium text-foreground">
                    {header || `(Column ${idx + 1})`}
                  </span>
                  <span className="text-muted-foreground">→</span>
                  <select
                    className="h-8 min-w-[16rem] max-w-full flex-1 cursor-pointer rounded-md border border-border bg-background px-2 text-xs"
                    value={columnMapping[idx] ?? ""}
                    onChange={(e) => updateMapAt(idx, e.target.value as ImportFieldKey)}
                  >
                    {IMPORT_FIELD_OPTIONS.map((opt) => (
                      <option key={`${opt.value}-${opt.label}`} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[10px] text-muted-foreground">
              Ready rows: <span className="font-medium text-foreground">{rows.length}</span>
            </p>
          </div>
        ) : null}

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

        {previewRows.length ? (
          <div className="overflow-x-auto rounded-lg border border-border/70">
            <table className="w-full text-left text-xs">
              <tbody>
                {previewRows.map((row, ri) => (
                  <tr
                    key={ri}
                    className={cn("border-b border-border/50", ri === 0 && "bg-muted/40 font-medium")}
                  >
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
