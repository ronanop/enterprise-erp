"use client";

import { useEffect, useMemo, useState } from "react";
import { formatApiError } from "@/services/api-client";
import { Download, Upload } from "lucide-react";

import {
  SetupDrawer,
  SetupField,
  SetupInput,
  SetupSelect,
  SetupTextarea,
} from "@/components/hr/setup/setup-drawer";
import { toast } from "@/components/hr/setup/setup-toast";
import { Button } from "@/components/ui/button";
import {
  ATTENDANCE_IMPORT_FIELD_OPTIONS,
  ATTENDANCE_IMPORT_SAMPLE_CSV,
  extractAttendanceImportHeaders,
  guessAttendanceColumnMapping,
  padAttendanceMatrix,
  parseAttendanceImportWithMapping,
  type AttendanceImportFieldKey,
  type NormalizedAttendanceImportRow,
} from "@/lib/attendance-import-map";
import { extractDataMatrix, parseSpreadsheetFileAsMatrix } from "@/lib/spreadsheet";
import { cn } from "@/lib/utils";
import {
  applyAttendanceCorrection,
  downloadTextFile,
  importAttendanceRows,
  type AttendanceDirectory,
  type RegularizeKind,
} from "@/services/attendance-management-service";
import type { AttendanceRecord } from "@/types/attendance-management";

function formatPunchTimeForDisplay(iso: string): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
  } catch {
    return "";
  }
}

/** Normalize a display/ISO time to HH:mm for <input type="time">. */
function toTimeInputValue(isoOrHm: string): string {
  if (!isoOrHm) return "";
  if (/^\d{1,2}:\d{2}/.test(isoOrHm.trim())) {
    const [h, m] = isoOrHm.trim().split(":");
    return `${h.padStart(2, "0")}:${m.slice(0, 2)}`;
  }
  try {
    const d = new Date(isoOrHm);
    if (Number.isNaN(d.getTime())) return "";
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  } catch {
    return "";
  }
}

export function AttendanceImportDrawer({
  open,
  onClose,
  directory,
  onImported,
}: {
  open: boolean;
  onClose: () => void;
  directory: AttendanceDirectory | null;
  onImported: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [fileName, setFileName] = useState("");
  const [matrix, setMatrix] = useState<string[][]>([]);
  const [headerIdx, setHeaderIdx] = useState(-1);
  const [displayHeaders, setDisplayHeaders] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<AttendanceImportFieldKey[]>([]);
  const [rows, setRows] = useState<NormalizedAttendanceImportRow[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [resultSummary, setResultSummary] = useState<string | null>(null);

  const previewRows = useMemo(() => {
    if (headerIdx < 0 || !matrix.length) return [];
    return matrix.slice(headerIdx, headerIdx + 6);
  }, [matrix, headerIdx]);

  useEffect(() => {
    if (!open) {
      setBusy(false);
      setFileName("");
      setMatrix([]);
      setHeaderIdx(-1);
      setDisplayHeaders([]);
      setColumnMapping([]);
      setRows([]);
      setErrors([]);
      setWarnings([]);
      setResultSummary(null);
    }
  }, [open]);

  function applyMapping(nextMap: AttendanceImportFieldKey[], mat: string[][], hdrIdx: number) {
    setColumnMapping(nextMap);
    if (hdrIdx < 0) {
      setRows([]);
      setErrors(["Could not find header row."]);
      setWarnings([]);
      return;
    }
    const parsed = parseAttendanceImportWithMapping(mat, hdrIdx, nextMap);
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
      // Keep the full sheet width first, then drop title rows above the real header.
      const { headerIdx: probeIdx } = extractAttendanceImportHeaders(raw);
      const sliced =
        probeIdx > 0 ? raw.slice(Math.max(0, probeIdx - 1)) : raw;
      const byCode = extractDataMatrix(sliced, "code");
      const byEmp =
        byCode === sliced || byCode.length < 2
          ? extractDataMatrix(sliced, "employee_code")
          : byCode;
      const working = padAttendanceMatrix(byEmp.length >= 2 ? byEmp : sliced);
      setMatrix(working);

      const { headerIdx: hi, headers, displayHeaders: dh } =
        extractAttendanceImportHeaders(working);
      setHeaderIdx(hi);
      setDisplayHeaders(dh);
      applyMapping(guessAttendanceColumnMapping(headers), working, hi);
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

  function updateMapAt(idx: number, value: AttendanceImportFieldKey) {
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
    if (!directory || !rows.length || errors.length) return;
    setBusy(true);
    try {
      const res = await importAttendanceRows(rows, directory);
      const unmatched = res.skippedUnmatched ?? 0;
      const msg = `Imported ${res.created} row(s)${
        unmatched ? `, skipped ${unmatched} (no matching Emp ID)` : ""
      }${
        res.skipped > unmatched ? `, other skips ${res.skipped - unmatched}` : ""
      }`;
      setResultSummary(msg);
      if (res.warnings?.length) {
        setWarnings((w) => [...w, ...res.warnings].slice(0, 40));
      }
      if (res.errors.length) {
        setErrors((e) => [...e, ...res.errors].slice(0, 40));
      }
      if (res.created > 0) {
        toast(msg, "success");
        onImported();
        onClose();
      } else {
        toast(
          res.errors[0] ||
            `Nothing imported — ${res.skipped} row(s) had no matching Emp ID in HR`,
          "error",
        );
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <SetupDrawer
      open={open}
      title="Import Attendance"
      description="Upload machine Excel/CSV. Rows are saved only when Code matches an Emp ID in HR (or same number, e.g. CDPL5356 → CT5356); others are skipped."
      wide
      onClose={onClose}
      footer={
        <>
          <Button type="button" size="sm" variant="outline" className="cursor-pointer" onClick={onClose}>
            Close
          </Button>
          <Button
            type="button"
            size="sm"
            className="cursor-pointer"
            disabled={busy || !directory || rows.length === 0 || errors.length > 0}
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
            downloadTextFile(
              "attendance-machine-import-sample.csv",
              ATTENDANCE_IMPORT_SAMPLE_CSV,
              "text/csv",
            )
          }
        >
          <Download className="size-3.5" />
          Download sample CSV
        </Button>

        <SetupField
          label="Upload machine attendance file"
          hint="Supports Code, Date, First In, Last Out, Status / Attd. Unmatched Emp codes are skipped automatically."
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
            <p className="mb-1 text-[11px] font-semibold text-foreground">
              Map Excel columns → attendance fields
            </p>
            <p className="mb-2 text-[10px] text-muted-foreground">
              Showing all <span className="font-medium text-foreground">{displayHeaders.length}</span>{" "}
              sheet columns on the left. Right dropdown only lists attendance fields to map
              (Code / Date / First In / Last Out / Status) — Company, Branch, Department come
              from the matched employee in HR, not from this sheet.
            </p>
            <ul className="erp-scroll max-h-72 space-y-2 overflow-y-auto pr-1">
              {displayHeaders.map((header, idx) => (
                <li key={`${header}-${idx}`} className="flex flex-wrap items-center gap-2 text-xs">
                  <span
                    className="min-w-[8rem] flex-1 truncate font-medium text-foreground"
                    title={header || `Column ${idx + 1}`}
                  >
                    <span className="mr-1 font-mono text-[10px] text-muted-foreground">
                      {idx + 1}.
                    </span>
                    {header || `(Column ${idx + 1})`}
                  </span>
                  <span className="text-muted-foreground">→</span>
                  <select
                    className="h-8 min-w-[14rem] max-w-full flex-1 cursor-pointer rounded-md border border-border bg-background px-2 text-xs"
                    value={columnMapping[idx] ?? ""}
                    onChange={(e) =>
                      updateMapAt(idx, e.target.value as AttendanceImportFieldKey)
                    }
                  >
                    {ATTENDANCE_IMPORT_FIELD_OPTIONS.map((opt) => (
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
              {" · "}Map{" "}
              <span className="font-medium text-foreground">Code</span>,{" "}
              <span className="font-medium text-foreground">Date</span>,{" "}
              <span className="font-medium text-foreground">First In</span>,{" "}
              <span className="font-medium text-foreground">Last Out</span>
              {" "}(or Intime-OutTime), and <span className="font-medium text-foreground">Status</span>.
              {" "}Matched Emp IDs are saved; unmatched Codes are skipped.
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

const REGULARIZE_STATUSES: { value: RegularizeKind; label: string }[] = [
  { value: "full_day", label: "Full day" },
  { value: "half_day", label: "Half day" },
  { value: "absent", label: "Absent" },
  { value: "work_from_home", label: "Work from home" },
];

export function AttendanceCorrectionDrawer({
  open,
  onClose,
  record,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  record: AttendanceRecord | null;
  onSaved: () => void;
}) {
  const [kind, setKind] = useState<RegularizeKind>("full_day");
  const [halfPortion, setHalfPortion] = useState<"first_half" | "second_half">("first_half");
  const [checkInTime, setCheckInTime] = useState("");
  const [checkOutTime, setCheckOutTime] = useState("");
  const [reason, setReason] = useState("");
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState(false);

  const recordedSummary = useMemo(() => {
    if (!record) return "";
    const inn = formatPunchTimeForDisplay(record.checkIn) || "-";
    const out = formatPunchTimeForDisplay(record.checkOut) || "-";
    return `Originally In ${inn} · Out ${out}`;
  }, [record]);

  useEffect(() => {
    if (!open || !record) return;
    setKind("full_day");
    setHalfPortion("first_half");
    setCheckInTime(toTimeInputValue(record.checkIn));
    setCheckOutTime(toTimeInputValue(record.checkOut));
    setReason("");
    setFileName("");
    setBusy(false);
  }, [open, record]);

  return (
    <SetupDrawer
      open={open}
      title="Regularize Attendance"
      description="Update attendance status and optionally correct check-in / check-out punch times."
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
            disabled={busy}
            onClick={() => {
              if (!record || !reason.trim()) {
                toast("Reason is required", "error");
                return;
              }
              setBusy(true);
              void applyAttendanceCorrection({
                record,
                kind,
                halfPortion: kind === "half_day" ? halfPortion : undefined,
                reason: reason.trim(),
                attachmentName: fileName,
                checkInTime: checkInTime.trim() || undefined,
                checkOutTime: checkOutTime.trim() || undefined,
              })
                .then(() => {
                  toast("Attendance regularized", "success");
                  onSaved();
                  onClose();
                })
                .catch((e) => toast(formatApiError(e, "Couldn't regularize attendance. Try again."), "error"))
                .finally(() => setBusy(false));
            }}
          >
            {busy ? "Saving…" : "Apply regularization"}
          </Button>
        </>
      }
    >
      {record ? (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            {record.extension.employeeName} · {record.attendanceDate}
          </p>
          <SetupField label="Date">
            <SetupInput type="date" value={record.attendanceDate} readOnly />
          </SetupField>
          <p className="text-[10px] text-muted-foreground">{recordedSummary}</p>
          <div className="grid grid-cols-2 gap-3">
            <SetupField label="Check-in">
              <SetupInput
                type="time"
                value={checkInTime}
                onChange={(e) => setCheckInTime(e.target.value)}
                className="cursor-pointer tabular-nums"
              />
            </SetupField>
            <SetupField label="Check-out">
              <SetupInput
                type="time"
                value={checkOutTime}
                onChange={(e) => setCheckOutTime(e.target.value)}
                className="cursor-pointer tabular-nums"
              />
            </SetupField>
          </div>
          <SetupField label="Attendance status" required>
            <SetupSelect
              value={kind}
              onChange={(e) => setKind(e.target.value as RegularizeKind)}
            >
              {REGULARIZE_STATUSES.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </SetupSelect>
          </SetupField>
          {kind === "half_day" ? (
            <SetupField label="Half" required>
              <SetupSelect
                value={halfPortion}
                onChange={(e) => setHalfPortion(e.target.value as "first_half" | "second_half")}
              >
                <option value="first_half">First half</option>
                <option value="second_half">Second half</option>
              </SetupSelect>
            </SetupField>
          ) : null}
          <SetupField label="Reason" required>
            <SetupTextarea value={reason} onChange={(e) => setReason(e.target.value)} />
          </SetupField>
          <SetupField label="Attachment">
            <input
              type="file"
              className="cursor-pointer text-xs"
              onChange={(e) => setFileName(e.target.files?.[0]?.name ?? "")}
            />
          </SetupField>
          <ol className="list-decimal pl-4 text-[10px] text-muted-foreground">
            <li>You can edit check-in / check-out times (HH:mm)</li>
            <li>Day can be marked full day, half day (1st/2nd), absent, or work from home</li>
            <li>Regularization is audit-logged on the attendance record</li>
          </ol>
        </div>
      ) : null}
    </SetupDrawer>
  );
}
