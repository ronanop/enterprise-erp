"use client";

import { useEffect, useMemo, useState } from "react";
import { Download } from "lucide-react";

import { SetupDrawer, SetupField, SetupInput, SetupTextarea } from "@/components/hr/setup/setup-drawer";
import { toast } from "@/components/hr/setup/setup-toast";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  extractDataMatrix,
  matrixToCsv,
  parseSpreadsheetFileAsMatrix,
} from "@/lib/spreadsheet";
import {
  applyAttendanceCorrection,
  downloadTextFile,
  importAttendanceCsv,
  type AttendanceDirectory,
} from "@/services/attendance-management-service";
import type { AttendanceRecord } from "@/types/attendance-management";

function formatPunchTimeForDisplay(iso: string): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

const SAMPLE = `employee_code,attendance_date,check_in,check_out,status,source
EMP-001,2026-07-22,09:05,18:10,present,biometric
EMP-002,2026-07-22,09:12,18:05,present,biometric
EMP-003,2026-07-22,09:08,17:50,work_from_home,mobile`;

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
  const [csvText, setCsvText] = useState("");

  useEffect(() => {
    if (!open) {
      setBusy(false);
      setFileName("");
      setCsvText("");
    }
  }, [open]);

  return (
    <SetupDrawer
      open={open}
      title="Import Attendance"
      description="CSV or Excel import with duplicate validation (employee + date)."
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
            disabled={busy || !csvText || !directory}
            onClick={() => {
              if (!directory || !csvText) return;
              setBusy(true);
              void importAttendanceCsv(csvText, directory)
                .then((res) => {
                  if (res.created > 0) {
                    toast(`Imported ${res.created} row(s)${res.skipped ? `, skipped ${res.skipped}` : ""}`, "success");
                    onImported();
                    onClose();
                  } else {
                    toast(res.errors[0] || `Nothing imported (${res.skipped} skipped)`, "error");
                  }
                })
                .finally(() => setBusy(false));
            }}
          >
            {busy ? "Importing…" : "Import"}
          </Button>
        </>
      }
    >
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="cursor-pointer mb-3"
        onClick={() => downloadTextFile("attendance-import-sample.csv", SAMPLE, "text/csv")}
      >
        <Download className="size-3.5" />
        Download sample CSV
      </Button>
      <SetupField label="Upload CSV or Excel">
        <input
          type="file"
          accept=".csv,.xlsx,.xlsm,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="cursor-pointer text-xs"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            setFileName(file.name);
            void (async () => {
              try {
                const name = file.name.toLowerCase();
                if (name.endsWith(".csv") || file.type === "text/csv") {
                  setCsvText(await file.text());
                  return;
                }
                const matrix = extractDataMatrix(
                  await parseSpreadsheetFileAsMatrix(file),
                  "employee_code",
                );
                setCsvText(matrixToCsv(matrix));
              } catch (err) {
                setCsvText("");
                toast(err instanceof Error ? err.message : "Could not read file", "error");
              }
            })();
          }}
        />
      </SetupField>
      {fileName ? <p className="text-[11px] text-muted-foreground">Selected: {fileName}</p> : null}
      <p className="mt-2 text-[10px] text-muted-foreground">
        Required columns: employee_code, attendance_date. Optional: check_in, check_out, status, source.
        Duplicate employee+date rows are skipped.
      </p>
    </SetupDrawer>
  );
}

type RegularizePortion = "full_day" | "first_half" | "second_half";

const PORTION_OPTIONS: { value: RegularizePortion; label: string; hint: string }[] = [
  { value: "full_day", label: "Mark full day", hint: "Count as full-day present" },
  { value: "first_half", label: "Half day — 1st half", hint: "Count as half-day present (morning)" },
  { value: "second_half", label: "Half day — 2nd half", hint: "Count as half-day present (afternoon)" },
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
  const [portion, setPortion] = useState<RegularizePortion>("full_day");
  const [reason, setReason] = useState("");
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState(false);

  const punchSummary = useMemo(() => {
    if (!record) return "";
    const inn = formatPunchTimeForDisplay(record.checkIn) || "—";
    const out = formatPunchTimeForDisplay(record.checkOut) || "—";
    return `In ${inn} · Out ${out}`;
  }, [record]);

  useEffect(() => {
    if (!open || !record) return;
    setPortion("full_day");
    setReason("");
    setFileName("");
    setBusy(false);
  }, [open, record]);

  return (
    <SetupDrawer
      open={open}
      title="Regularize Attendance"
      description="Mark full or half day present without changing recorded punch times"
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
                portion,
                reason: reason.trim(),
                attachmentName: fileName,
              })
                .then(() => {
                  toast("Attendance regularized", "success");
                  onSaved();
                  onClose();
                })
                .catch((e) => toast(e instanceof Error ? e.message : "Regularization failed", "error"))
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
          <SetupField label="Recorded punches">
            <SetupInput value={punchSummary} readOnly />
          </SetupField>
          <SetupField label="Mark as" required>
            <div className="space-y-2">
              {PORTION_OPTIONS.map((opt) => {
                const active = portion === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setPortion(opt.value)}
                    className={cn(
                      "flex w-full cursor-pointer flex-col rounded-xl border px-3 py-2.5 text-left transition-all",
                      active
                        ? "border-primary/50 bg-primary/5 ring-1 ring-primary/20"
                        : "border-border hover:border-primary/30",
                    )}
                  >
                    <span className="text-sm font-medium text-foreground">{opt.label}</span>
                    <span className="text-[11px] text-muted-foreground">{opt.hint}</span>
                  </button>
                );
              })}
            </div>
          </SetupField>
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
            <li>Actual check-in / check-out times are not changed</li>
            <li>Day is marked present (full) or half-day present for payroll / reports</li>
            <li>Regularization is audit-logged on the attendance record</li>
          </ol>
        </div>
      ) : null}
    </SetupDrawer>
  );
}
