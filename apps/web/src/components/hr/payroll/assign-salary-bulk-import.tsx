"use client";

import { useMemo, useState } from "react";
import { Download, FileSpreadsheet, Loader2, Upload } from "lucide-react";

import { SetupDrawer } from "@/components/hr/setup/setup-drawer";
import { toast } from "@/components/hr/setup/setup-toast";
import { Button } from "@/components/ui/button";
import {
  SALARY_ASSIGN_IMPORT_FIELD_OPTIONS,
  SALARY_ASSIGN_IMPORT_SAMPLE_CSV,
  extractSalaryAssignImportHeaders,
  guessSalaryAssignColumnMapping,
  parseSalaryAssignImportWithMapping,
  type NormalizedSalaryAssignRow,
  type SalaryAssignImportFieldKey,
} from "@/lib/salary-assign-import";
import { cn } from "@/lib/utils";
import { downloadCsv } from "@/lib/spreadsheet";
import { extractDataMatrix, parseSpreadsheetFileAsMatrix } from "@/lib/spreadsheet";
import { formatApiError } from "@/services/api-client";
import { bulkAssignSalariesFromImport } from "@/services/payroll-management-service";
import type { HrMasterOption } from "@/services/hr-master-connector";
import { formatInr } from "@/services/payroll-service";

export function AssignSalaryBulkImportDrawer({
  open,
  onClose,
  employees,
  onImported,
}: {
  open: boolean;
  onClose: () => void;
  employees: HrMasterOption[];
  onImported: () => void;
}) {
  const [fileName, setFileName] = useState("");
  const [matrix, setMatrix] = useState<string[][]>([]);
  const [headerIdx, setHeaderIdx] = useState(-1);
  const [displayHeaders, setDisplayHeaders] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<SalaryAssignImportFieldKey[]>([]);
  const [rows, setRows] = useState<NormalizedSalaryAssignRow[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [resultSummary, setResultSummary] = useState<string | null>(null);

  const previewRows = useMemo(() => {
    if (headerIdx < 0 || !matrix.length) return [];
    return matrix.slice(headerIdx, headerIdx + 6);
  }, [matrix, headerIdx]);

  function applyMapping(
    nextMap: SalaryAssignImportFieldKey[],
    mat: string[][],
    hdrIdx: number,
  ) {
    setColumnMapping(nextMap);
    if (hdrIdx < 0) {
      setRows([]);
      setErrors(["Could not find header row."]);
      setWarnings([]);
      return;
    }
    const parsed = parseSalaryAssignImportWithMapping(mat, hdrIdx, nextMap);
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
      const working = extractDataMatrix(raw, "employee");
      const matrixUse = working.length >= 2 ? working : raw;
      setMatrix(matrixUse);
      const { headerIdx: hi, headers, displayHeaders: dh } =
        extractSalaryAssignImportHeaders(matrixUse);
      setHeaderIdx(hi);
      setDisplayHeaders(dh);
      applyMapping(guessSalaryAssignColumnMapping(headers), matrixUse, hi);
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

  function updateMapAt(idx: number, value: SalaryAssignImportFieldKey) {
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
      const result = await bulkAssignSalariesFromImport(rows, employees);
      // "updated N" = existing salary structures refreshed — not the same as matched employees.
      const msg = `Matched ${result.matched} · assigned ${result.assigned} · structures created ${result.createdStructures}, updated ${result.updatedStructures} · not found ${result.notFound} · skipped ${result.skipped}`;
      setResultSummary(msg);
      toast(
        msg,
        result.assigned === 0 ? "error" : "success",
      );
      if (result.warnings.length) {
        setWarnings((w) => [...w, ...result.warnings].slice(0, 80));
      }
      if (result.errors.length) {
        setErrors((e) => [...e, ...result.errors].slice(0, 80));
      }
      if (result.assigned > 0) onImported();
    } catch (err) {
      toast(formatApiError(err, "Bulk assign failed"), "error");
    } finally {
      setBusy(false);
    }
  }

  function resetAndClose() {
    setFileName("");
    setMatrix([]);
    setHeaderIdx(-1);
    setDisplayHeaders([]);
    setColumnMapping([]);
    setRows([]);
    setErrors([]);
    setWarnings([]);
    setResultSummary(null);
    onClose();
  }

  return (
    <SetupDrawer
      open={open}
      onClose={resetAndClose}
      wide
      title="Bulk assign salary"
      description="Upload Excel/CSV with employee_code, monthly_ctc, employer_contribution. Creates a CTC structure (60/50 Excel split) and assigns it to each employee."
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            className="cursor-pointer transition-colors duration-200"
            onClick={resetAndClose}
          >
            Close
          </Button>
          <Button
            type="button"
            className="cursor-pointer transition-colors duration-200"
            disabled={
              busy ||
              !rows.length ||
              !columnMapping.includes("employee_code") ||
              !columnMapping.includes("monthly_ctc")
            }
            onClick={() => void runImport()}
          >
            {busy ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                Importing…
              </>
            ) : (
              <>
                <Upload className="size-3.5" />
                Create & assign ({rows.length})
              </>
            )}
          </Button>
        </div>
      }
    >
      <div className="space-y-4 text-sm">
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="cursor-pointer transition-colors duration-200"
            onClick={() => {
              downloadCsv("salary-assign-template.csv", [
                {
                  employee_code: "CT5354",
                  monthly_ctc: 200000,
                  employer_contribution: 3000,
                },
                {
                  employee_code: "CT1001",
                  monthly_ctc: 36000,
                  employer_contribution: 1800,
                },
              ]);
            }}
          >
            <Download className="size-3.5" />
            Download template
          </Button>
          <label
            className={cn(
              "inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium transition-colors duration-200 hover:bg-muted",
            )}
          >
            <FileSpreadsheet className="size-3.5" />
            {fileName || "Choose .xlsx / .csv"}
            <input
              type="file"
              accept=".csv,.xlsx,.xlsm,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="hidden"
              onChange={(e) => {
                void onFile(e.target.files?.[0] ?? null);
                e.target.value = "";
              }}
            />
          </label>
        </div>

        <p className="text-xs text-muted-foreground">
          Required columns: <span className="font-medium text-foreground">employee_code</span>,{" "}
          <span className="font-medium text-foreground">monthly_ctc</span>,{" "}
          <span className="font-medium text-foreground">employer_contribution</span>. Optional:
          employee_name, effective_date. Sample:{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-[10px]">
            {SALARY_ASSIGN_IMPORT_SAMPLE_CSV.split("\n")[1]}
          </code>
        </p>

        {displayHeaders.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs font-medium text-foreground">Column mapping</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {displayHeaders.map((h, idx) => (
                <label key={`${h}-${idx}`} className="flex flex-col gap-1 text-xs">
                  <span className="truncate text-muted-foreground" title={h}>
                    Sheet: {h || `(col ${idx + 1})`}
                  </span>
                  <select
                    className="h-8 cursor-pointer rounded-md border border-border bg-background px-2 text-xs transition-colors duration-200"
                    value={columnMapping[idx] ?? ""}
                    onChange={(e) =>
                      updateMapAt(idx, e.target.value as SalaryAssignImportFieldKey)
                    }
                  >
                    {SALARY_ASSIGN_IMPORT_FIELD_OPTIONS.map((opt) => (
                      <option key={opt.value || "ignore"} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          </div>
        ) : null}

        {previewRows.length > 0 ? (
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full min-w-[480px] text-left text-[11px]">
              <tbody>
                {previewRows.map((row, i) => (
                  <tr
                    key={i}
                    className={cn(
                      "border-b border-border/60",
                      i === 0 ? "bg-muted/40 font-medium" : "",
                    )}
                  >
                    {row.map((cell, j) => (
                      <td key={j} className="px-2 py-1 tabular-nums">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {rows.length > 0 ? (
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full min-w-[520px] text-left text-xs">
              <thead className="border-b bg-muted/40 text-[10px] uppercase text-muted-foreground">
                <tr>
                  <th className="px-2 py-1.5 font-medium">Code</th>
                  <th className="px-2 py-1.5 font-medium">Monthly CTC</th>
                  <th className="px-2 py-1.5 font-medium">Employer</th>
                  <th className="px-2 py-1.5 font-medium">Employee</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 12).map((r) => {
                  const needle = r.employeeCode.toUpperCase();
                  const dig = needle.replace(/\D/g, "");
                  const emp =
                    employees.find((e) => e.code?.toUpperCase() === needle) ||
                    (dig.length >= 3
                      ? employees.find((e) => {
                          const c = String(e.code ?? "")
                            .toUpperCase()
                            .replace(/\D/g, "");
                          return c === dig;
                        })
                      : undefined);
                  return (
                    <tr key={r.employeeCode} className="border-b border-border/50">
                      <td className="px-2 py-1.5 font-medium">{r.employeeCode}</td>
                      <td className="px-2 py-1.5 tabular-nums">{formatInr(r.monthlyCtc)}</td>
                      <td className="px-2 py-1.5 tabular-nums">
                        {formatInr(r.employerContribution)}
                      </td>
                      <td className="px-2 py-1.5">
                        {emp?.label?.split(" · ")[0] || r.employeeName || (
                          <span className="text-destructive">Not found</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {rows.length > 12 ? (
              <p className="px-2 py-1 text-[10px] text-muted-foreground">
                +{rows.length - 12} more rows
              </p>
            ) : null}
          </div>
        ) : null}

        {resultSummary ? (
          <p className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs">
            {resultSummary}
          </p>
        ) : null}

        {warnings.length ? (
          <ul className="list-disc space-y-0.5 pl-4 text-xs text-amber-700 dark:text-amber-400">
            {warnings.slice(0, 12).map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        ) : null}

        {errors.length ? (
          <ul className="list-disc space-y-0.5 pl-4 text-xs text-destructive">
            {errors.slice(0, 12).map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        ) : null}
      </div>
    </SetupDrawer>
  );
}
