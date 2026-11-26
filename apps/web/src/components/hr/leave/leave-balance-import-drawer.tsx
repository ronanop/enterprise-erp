"use client";

import { useMemo, useState } from "react";
import { Download, Upload } from "lucide-react";

import { SetupDrawer, SetupField } from "@/components/hr/setup/setup-drawer";
import { toast } from "@/components/hr/setup/setup-toast";
import { Button } from "@/components/ui/button";
import {
  LEAVE_BALANCE_IMPORT_FIELD_OPTIONS,
  LEAVE_BALANCE_IMPORT_SAMPLE_CSV,
  extractLeaveBalanceImportHeaders,
  guessLeaveBalanceColumnMapping,
  parseLeaveBalanceImportWithMapping,
  type LeaveBalanceImportFieldKey,
  type NormalizedLeaveBalanceImportRow,
} from "@/lib/leave-balance-import-map";
import { extractDataMatrix, parseSpreadsheetFileAsMatrix } from "@/lib/spreadsheet";
import { ApiClientError, formatApiError } from "@/services/api-client";
import { downloadTextFile } from "@/services/employee-management-service";
import { bulkImportLeaveBalances } from "@/services/leave-management-service";
import { cn } from "@/lib/utils";

export function LeaveBalanceImportDrawer({
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
  const [columnMapping, setColumnMapping] = useState<LeaveBalanceImportFieldKey[]>([]);
  const [rows, setRows] = useState<NormalizedLeaveBalanceImportRow[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [resultSummary, setResultSummary] = useState<string | null>(null);

  const previewRows = useMemo(() => {
    if (headerIdx < 0 || !matrix.length) return [];
    return matrix.slice(headerIdx, headerIdx + 6);
  }, [matrix, headerIdx]);

  function applyMapping(nextMap: LeaveBalanceImportFieldKey[], mat: string[][], hdrIdx: number) {
    setColumnMapping(nextMap);
    if (hdrIdx < 0) {
      setRows([]);
      setErrors(["Could not find header row."]);
      setWarnings([]);
      return;
    }
    const parsed = parseLeaveBalanceImportWithMapping(mat, hdrIdx, nextMap);
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
      const matrixA = extractDataMatrix(raw, "employee");
      const matrixB =
        matrixA === raw || matrixA.length < 2 ? extractDataMatrix(raw, "leave") : matrixA;
      const working = matrixB.length >= 2 ? matrixB : raw;
      setMatrix(working);

      const { headerIdx: hi, headers, displayHeaders: dh } = extractLeaveBalanceImportHeaders(working);
      setHeaderIdx(hi);
      setDisplayHeaders(dh);
      applyMapping(guessLeaveBalanceColumnMapping(headers), working, hi);
    } catch (err) {
      setMatrix([]);
      setHeaderIdx(-1);
      setDisplayHeaders([]);
      setColumnMapping([]);
      setRows([]);
      setWarnings([]);
      setErrors([formatApiError(err, "Could not read file.")]);
    }
  }

  function updateMapAt(idx: number, value: LeaveBalanceImportFieldKey) {
    const next = [...columnMapping];
    if (value) {
      for (let i = 0; i < next.length; i += 1) {
        if (i !== idx && next[i] === value) next[i] = "";
      }
    }
    next[idx] = value;
    applyMapping(next, matrix, headerIdx);
  }

  async function runImport() {
    if (!rows.length || errors.length) return;
    setBusy(true);
    try {
      const result = await bulkImportLeaveBalances(rows);
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
        onImported();
      }
    } catch (err) {
      toast(formatApiError(err, "Couldn't import. Try again."), "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <SetupDrawer
      open={open}
      title="Import leave balances"
      description="Upload Excel/CSV with employee code, leave type (SL/CL/…), and leaves left. Updates what employees see in the ESS app."
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
              downloadTextFile(
                "leave-balance-import-template.csv",
                LEAVE_BALANCE_IMPORT_SAMPLE_CSV,
                "text/csv",
              )
            }
          >
            <Download className="size-3.5" />
            Download sample CSV
          </Button>
        </div>

        <SetupField
          label="Upload file"
          hint="Columns: employee_code, leave_type_code, remaining (leaves left). Optional: used, accrued, balance_year."
        >
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-border px-3 py-6 text-xs text-muted-foreground transition-colors duration-200 hover:bg-muted/30">
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
            <p className="mb-2 text-[11px] font-semibold text-foreground">Map Excel columns → leave fields</p>
            <ul className="space-y-2">
              {displayHeaders.map((header, idx) => (
                <li key={`${header}-${idx}`} className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="min-w-[8rem] flex-1 truncate font-medium text-foreground">
                    {header || `(Column ${idx + 1})`}
                  </span>
                  <span className="text-muted-foreground">→</span>
                  <select
                    className="h-8 min-w-[14rem] max-w-full flex-1 cursor-pointer rounded-md border border-border bg-background px-2 text-xs"
                    value={columnMapping[idx] ?? ""}
                    onChange={(e) => updateMapAt(idx, e.target.value as LeaveBalanceImportFieldKey)}
                  >
                    {LEAVE_BALANCE_IMPORT_FIELD_OPTIONS.map((opt) => (
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
