"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Download, Trash2, Upload } from "lucide-react";

import { SetupConfirmDialog } from "@/components/hr/setup/setup-confirm";
import { SetupDrawer, SetupField, SetupSelect } from "@/components/hr/setup/setup-drawer";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/hr/setup/setup-toast";
import { useUserPermissions } from "@/hooks/use-user-permissions";
import {
  EMPLOYEE_IMPORT_CLIENT_SAMPLE_CSV,
  EMPLOYEE_IMPORT_OFFICE_SAMPLE_CSV,
  IMPORT_FIELD_OPTIONS,
  defaultTagForImportTemplate,
  extractImportHeaders,
  guessColumnMapping,
  parseEmployeeImportWithMapping,
  type EmployeeImportTemplateKind,
  type ImportFieldKey,
  type NormalizedEmployeeImportRow,
} from "@/lib/employee-import-map";
import {
  extractDataMatrix,
  listSpreadsheetSheetNames,
  mergeSpreadsheetMatrices,
  parseSpreadsheetSheetsAsMatrices,
} from "@/lib/spreadsheet";
import { clearAllEmployeeExtensions } from "@/lib/employee-extensions-store";
import {
  downloadTextFile,
  invalidateEmployeeDirectoryCache,
} from "@/services/employee-management-service";
import { bulkImportEmployees, clearAllEmployees } from "@/services/employee-import-service";
import { ApiClientError, contextService, formatApiError } from "@/services/api-client";
import { cn } from "@/lib/utils";

type EntityOption = { id: string; label: string };

const LOCAL_EMP_KEY = "erp_hr_local_employees_v1";

function fieldLabel(value: ImportFieldKey): string {
  return IMPORT_FIELD_OPTIONS.find((o) => o.value === value)?.label ?? "- Skip -";
}

/** Scrollable picker — native select clips options inside the drawer. */
function ImportFieldPicker({
  value,
  onChange,
  usedValues,
}: {
  value: ImportFieldKey;
  onChange: (next: ImportFieldKey) => void;
  usedValues: Set<string>;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [menuPos, setMenuPos] = useState<{ top: number; left: number; width: number } | null>(
    null,
  );
  const rootRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function place() {
      const rect = btnRef.current?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.max(rect.width, 260);
      const left = Math.min(rect.left, window.innerWidth - width - 8);
      const spaceBelow = window.innerHeight - rect.bottom;
      const openUp = spaceBelow < 280 && rect.top > spaceBelow;
      const top = openUp ? Math.max(8, rect.top - 276) : rect.bottom + 4;
      setMenuPos({ top, left: Math.max(8, left), width });
    }
    place();
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    document.addEventListener("mousedown", onDoc);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
      document.removeEventListener("mousedown", onDoc);
    };
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return IMPORT_FIELD_OPTIONS;
    return IMPORT_FIELD_OPTIONS.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        o.group.toLowerCase().includes(q) ||
        String(o.value).toLowerCase().includes(q),
    );
  }, [query]);

  const groups = useMemo(() => {
    const map = new Map<string, typeof IMPORT_FIELD_OPTIONS>();
    for (const opt of filtered) {
      const list = map.get(opt.group) ?? [];
      list.push(opt);
      map.set(opt.group, list);
    }
    return [...map.entries()];
  }, [filtered]);

  return (
    <div ref={rootRef} className="relative min-w-[16rem] flex-1">
      <button
        ref={btnRef}
        type="button"
        className="flex h-8 w-full cursor-pointer items-center justify-between gap-2 rounded-md border border-border bg-background px-2 text-left text-xs transition-colors duration-150 hover:border-primary/40"
        onClick={() => {
          setOpen((v) => !v);
          setQuery("");
        }}
        aria-expanded={open}
      >
        <span className="truncate">{fieldLabel(value)}</span>
        <ChevronDown className={cn("size-3.5 shrink-0 text-muted-foreground", open && "rotate-180")} />
      </button>
      {open && menuPos ? (
        <div
          className="fixed z-[80] overflow-hidden rounded-lg border border-border bg-card shadow-lg"
          style={{ top: menuPos.top, left: menuPos.left, width: menuPos.width }}
        >
          <div className="border-b border-border p-1.5">
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search fields…"
              className="h-7 w-full rounded-md border border-border bg-background px-2 text-xs outline-none focus:border-primary/40"
            />
          </div>
          <div className="max-h-64 overflow-y-auto p-1">
            {groups.map(([group, opts]) => (
              <div key={group} className="mb-1">
                <p className="px-2 py-1 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                  {group}
                </p>
                {opts.map((opt) => {
                  const taken = Boolean(opt.value && usedValues.has(opt.value) && opt.value !== value);
                  const selected = opt.value === value;
                  return (
                    <button
                      key={`${opt.value || "skip"}-${opt.label}`}
                      type="button"
                      disabled={taken}
                      className={cn(
                        "flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors duration-150",
                        selected && "bg-primary/10 text-primary",
                        !selected && !taken && "hover:bg-muted/60",
                        taken && "cursor-not-allowed opacity-40",
                      )}
                      onClick={() => {
                        if (taken) return;
                        onChange(opt.value);
                        setOpen(false);
                      }}
                    >
                      <span className="min-w-0 flex-1 truncate">{opt.label}</span>
                      {selected ? <Check className="size-3.5 shrink-0" /> : null}
                      {taken ? <span className="text-[10px] text-muted-foreground">used</span> : null}
                    </button>
                  );
                })}
              </div>
            ))}
            {!filtered.length ? (
              <p className="px-2 py-3 text-center text-[11px] text-muted-foreground">No matching fields</p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

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
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [selectedSheets, setSelectedSheets] = useState<string[]>([]);
  const [matrix, setMatrix] = useState<string[][]>([]);
  const [headerIdx, setHeaderIdx] = useState(-1);
  const [displayHeaders, setDisplayHeaders] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<ImportFieldKey[]>([]);
  const [rows, setRows] = useState<NormalizedEmployeeImportRow[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [confirmClearAll, setConfirmClearAll] = useState(false);
  const [resultSummary, setResultSummary] = useState<string | null>(null);
  const [entities, setEntities] = useState<EntityOption[]>([]);
  const [companyId, setCompanyId] = useState("");
  const [templateKind, setTemplateKind] = useState<EmployeeImportTemplateKind>("office");
  const { isHrmsSuperAdmin } = useUserPermissions();

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void contextService
      .listCompanies()
      .then((res) => {
        if (cancelled) return;
        const rows = (Array.isArray(res.data) ? res.data : [])
          .map((c) => ({
            id: String(c.id ?? ""),
            label: String(c.company_name || c.company_code || "").trim(),
          }))
          .filter((c) => c.id && c.label)
          .sort((a, b) => a.label.localeCompare(b.label));
        setEntities(rows);
        setCompanyId((prev) => {
          if (prev && rows.some((r) => r.id === prev)) return prev;
          return rows[0]?.id ?? "";
        });
      })
      .catch(() => {
        if (!cancelled) setEntities([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

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

  function prepareWorkingMatrix(raw: string[][]): string[][] {
    const matrixA = extractDataMatrix(raw, "emp code");
    const matrixB =
      matrixA === raw || matrixA.length < 2 ? extractDataMatrix(raw, "name") : matrixA;
    const matrixC =
      matrixB === raw || matrixB.length < 2
        ? extractDataMatrix(raw, "employee")
        : matrixB;
    return matrixC.length >= 2 ? matrixC : raw;
  }

  function applyWorkingMatrix(working: string[][], extraWarnings: string[] = []) {
    setMatrix(working);
    const { headerIdx: hi, headers, displayHeaders: dh } = extractImportHeaders(working);
    setHeaderIdx(hi);
    setDisplayHeaders(dh);
    const guessed = guessColumnMapping(headers);
    applyMapping(guessed, working, hi);
    if (extraWarnings.length) {
      setWarnings((prev) => [...extraWarnings, ...prev].slice(0, 80));
    }
  }

  async function loadSheets(file: File, sheets: string[]) {
    if (!sheets.length) {
      setMatrix([]);
      setHeaderIdx(-1);
      setDisplayHeaders([]);
      setColumnMapping([]);
      setRows([]);
      setWarnings([]);
      setErrors(["Select at least one Excel sheet to import."]);
      return;
    }
    const parts = await parseSpreadsheetSheetsAsMatrices(file, sheets);
    const prepared = parts.map((p) => ({
      sheet: p.sheet,
      matrix: prepareWorkingMatrix(p.matrix),
    }));
    const working = mergeSpreadsheetMatrices(prepared);
    const extraWarnings =
      sheets.length > 1
        ? [
            `Merged ${sheets.length} sheets (${sheets.join(", ")}). Columns align to the first selected sheet’s headers.`,
          ]
        : [];
    applyWorkingMatrix(working, extraWarnings);
  }

  async function onFile(file: File | null) {
    if (!file) return;
    setFileName(file.name);
    setSourceFile(file);
    setResultSummary(null);
    try {
      const names = await listSpreadsheetSheetNames(file);
      setSheetNames(names);
      const initial = names.length ? [names[0]] : [];
      setSelectedSheets(initial);
      await loadSheets(file, initial);
    } catch (err) {
      setSourceFile(null);
      setSheetNames([]);
      setSelectedSheets([]);
      setMatrix([]);
      setHeaderIdx(-1);
      setDisplayHeaders([]);
      setColumnMapping([]);
      setRows([]);
      setWarnings([]);
      setErrors([formatApiError(err, "Could not read file.")]);
    }
  }

  async function toggleSheet(name: string) {
    if (!sourceFile) return;
    const next = selectedSheets.includes(name)
      ? selectedSheets.filter((s) => s !== name)
      : [...selectedSheets, name];
    // Keep selection order matching workbook order
    const ordered = sheetNames.filter((s) => next.includes(s));
    setSelectedSheets(ordered);
    setResultSummary(null);
    try {
      await loadSheets(sourceFile, ordered);
    } catch (err) {
      setErrors([formatApiError(err, "Could not read selected sheets.")]);
    }
  }

  async function selectAllSheets() {
    if (!sourceFile || !sheetNames.length) return;
    setSelectedSheets(sheetNames);
    setResultSummary(null);
    try {
      await loadSheets(sourceFile, sheetNames);
    } catch (err) {
      setErrors([formatApiError(err, "Could not read selected sheets.")]);
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

  function requestClearAll() {
    setConfirmClearAll(true);
  }

  async function runClearAll() {
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
      setConfirmClearAll(false);
      onImported();
    } catch (err) {
      toast(formatApiError(err, "Couldn't clear records. Try again."), "error");
    } finally {
      setClearing(false);
    }
  }

  async function runImport() {
    if (!rows.length || errors.length) return;
    if (!companyId) {
      toast("Select a legal entity before importing", "error");
      return;
    }
    setBusy(true);
    try {
      const result = await bulkImportEmployees(rows, {
        companyId,
        defaultTag: defaultTagForImportTemplate(templateKind),
      });
      const entityLabel = entities.find((e) => e.id === companyId)?.label || "selected entity";
      const msg = `Import done into ${entityLabel} — created ${result.created}, updated ${result.updated}, skipped ${result.skipped}`;
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
      const raw =
        err instanceof ApiClientError ? (err.rawMessage || err.message) : "";
      const msg =
        /invalid api response/i.test(raw)
          ? "Import didn't finish (server timed out or returned an unexpected response). Wait a minute and try again."
          : formatApiError(err, "Couldn't import employees. Try again.");
      toast(msg, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
    <SetupDrawer
      open={open}
      title="Import Employees"
      description="Pick office or client template, select legal entity, upload Excel, map columns, then import."
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
            disabled={busy || !companyId || rows.length === 0 || errors.length > 0}
            onClick={() => void runImport()}
          >
            {busy ? "Importing…" : `Import ${rows.length || ""} row${rows.length === 1 ? "" : "s"}`}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <SetupField
            label="Import type"
            required
            hint={
              templateKind === "client"
                ? "Client template uses Tag=client_side and Deployed At (client site), not Organisation=Cache."
                : "Office template uses Tag=office_staff and Organisation=Cache."
            }
          >
            <SetupSelect
              value={templateKind}
              onChange={(e) => setTemplateKind(e.target.value as EmployeeImportTemplateKind)}
              className="cursor-pointer"
            >
              <option value="office">Office staff</option>
              <option value="client">Client side</option>
            </SetupSelect>
          </SetupField>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="cursor-pointer transition-colors duration-200"
              onClick={() => {
                setTemplateKind("office");
                downloadTextFile(
                  "employee-import-office-template.csv",
                  EMPLOYEE_IMPORT_OFFICE_SAMPLE_CSV,
                  "text/csv",
                );
              }}
            >
              <Download className="size-3.5" />
              Office template
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="cursor-pointer transition-colors duration-200"
              onClick={() => {
                setTemplateKind("client");
                downloadTextFile(
                  "employee-import-client-template.csv",
                  EMPLOYEE_IMPORT_CLIENT_SAMPLE_CSV,
                  "text/csv",
                );
              }}
            >
              <Download className="size-3.5" />
              Client template
            </Button>
            {isHrmsSuperAdmin ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="cursor-pointer text-destructive transition-colors duration-200 hover:bg-destructive/10"
                disabled={clearing}
                onClick={requestClearAll}
              >
                <Trash2 className="size-3.5" />
                {clearing ? "Clearing…" : "Clear all employees"}
              </Button>
            ) : null}
          </div>
          <p className="text-[11px] text-muted-foreground">
            Rows without a Tag get{" "}
            <span className="font-medium text-foreground">
              {defaultTagForImportTemplate(templateKind)}
            </span>{" "}
            from the selected import type.
          </p>
        </div>

        <SetupField
          label="Legal entity"
          required
          hint="Required. Every imported row is saved under this entity (ignore Entity column in Excel)."
        >
          <SetupSelect
            value={companyId}
            onChange={(e) => setCompanyId(e.target.value)}
            className="cursor-pointer"
          >
            <option value="">{entities.length ? "Select entity…" : "No entities — create one in Org Setup"}</option>
            {entities.map((e) => (
              <option key={e.id} value={e.id}>
                {e.label}
              </option>
            ))}
          </SetupSelect>
        </SetupField>

        <SetupField label="Upload file" hint="CSV or Excel - then map each column below">
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-border px-3 py-6 text-xs text-muted-foreground transition-colors duration-150 hover:bg-muted/30">
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

        {sheetNames.length > 1 ? (
          <SetupField
            label="Excel sheets"
            hint="Select one or more sheets. Rows are merged using the first selected sheet’s column headers."
          >
            <div className="space-y-2 rounded-lg border border-border/70 bg-muted/20 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  className="cursor-pointer"
                  onClick={() => void selectAllSheets()}
                >
                  Select all ({sheetNames.length})
                </Button>
                <span className="text-[10px] text-muted-foreground">
                  {selectedSheets.length} selected · {rows.length} ready row
                  {rows.length === 1 ? "" : "s"}
                </span>
              </div>
              <ul className="grid gap-1.5 sm:grid-cols-2">
                {sheetNames.map((name) => {
                  const checked = selectedSheets.includes(name);
                  return (
                    <li key={name}>
                      <label
                        className={cn(
                          "flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-2 text-xs transition-colors duration-150",
                          checked
                            ? "border-primary/40 bg-primary/5 text-foreground"
                            : "border-border/70 bg-card text-muted-foreground hover:border-primary/30",
                        )}
                      >
                        <input
                          type="checkbox"
                          className="size-3.5 cursor-pointer accent-primary"
                          checked={checked}
                          onChange={() => void toggleSheet(name)}
                        />
                        <span className="min-w-0 truncate font-medium">{name}</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </div>
          </SetupField>
        ) : null}

        {displayHeaders.length ? (
          <div className="rounded-lg border border-border/70 bg-muted/20 p-3">
            <p className="mb-2 text-[11px] font-semibold text-foreground">
              Map Excel columns → employee fields
            </p>
            <p className="mb-3 text-[10px] text-muted-foreground">
              All {displayHeaders.length} Excel columns are listed below. Open each dropdown and
              scroll/search to pick the matching HR field (Gender, DOB, Aadhaar, Bank, etc.).
              EMPLOYEE ID and NAME are required.
            </p>
            <ul className="space-y-2">
              {displayHeaders.map((header, idx) => {
                const used = new Set(
                  columnMapping.filter((v, i) => v && i !== idx).map(String),
                );
                return (
                  <li
                    key={`${header}-${idx}`}
                    className="relative flex flex-wrap items-center gap-2 text-xs"
                  >
                    <span
                      className="min-w-[8rem] flex-1 truncate font-medium text-foreground"
                      title={header || `Column ${idx + 1}`}
                    >
                      {header || `(Column ${idx + 1})`}
                    </span>
                    <span className="text-muted-foreground">→</span>
                    <ImportFieldPicker
                      value={columnMapping[idx] ?? ""}
                      usedValues={used}
                      onChange={(next) => updateMapAt(idx, next)}
                    />
                  </li>
                );
              })}
            </ul>
            <p className="mt-3 text-[10px] text-muted-foreground">
              Excel columns:{" "}
              <span className="font-medium text-foreground">{displayHeaders.length}</span>
              {" · "}
              Mapped:{" "}
              <span className="font-medium text-foreground">
                {columnMapping.filter(Boolean).length}
              </span>
              {" · "}
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

    <SetupConfirmDialog
      open={confirmClearAll}
      title="Clear all employees"
      message={
        "Delete ALL employees in the current company?\n\nThis soft-deletes them and frees Emp Codes so you can re-import from Excel. This cannot be undone from the UI."
      }
      confirmLabel="Clear all"
      destructive
      loading={clearing}
      typedConfirm="DELETE"
      onCancel={() => {
        if (!clearing) setConfirmClearAll(false);
      }}
      onConfirm={() => {
        void runClearAll();
      }}
    />
    </>
  );
}
