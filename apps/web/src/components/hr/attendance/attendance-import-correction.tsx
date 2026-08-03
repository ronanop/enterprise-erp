"use client";

import { useEffect, useMemo, useState } from "react";
import { Download } from "lucide-react";

import { SetupDrawer, SetupField, SetupInput, SetupSelect, SetupTextarea } from "@/components/hr/setup/setup-drawer";
import { toast } from "@/components/hr/setup/setup-toast";
import { Button } from "@/components/ui/button";
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
      title="Import attendance"
      description="CSV import with duplicate validation (employee + date)."
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
            {busy ? "Importing…" : "Import CSV"}
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
      <SetupField label="Upload CSV">
        <input
          type="file"
          accept=".csv,text/csv"
          className="cursor-pointer text-xs"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            setFileName(file.name);
            void file.text().then(setCsvText);
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
  const [field, setField] = useState<"check_in" | "check_out">("check_in");
  const [newTime, setNewTime] = useState("");
  const [reason, setReason] = useState("");
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState(false);

  const oldTime = useMemo(() => {
    if (!record) return "";
    const iso = field === "check_in" ? record.checkIn : record.checkOut;
    return formatPunchTimeForDisplay(iso);
  }, [record, field]);

  useEffect(() => {
    if (!open || !record) return;
    setField("check_in");
    setNewTime("");
    setReason("");
    setFileName("");
    setBusy(false);
  }, [open, record]);

  useEffect(() => {
    setNewTime("");
  }, [field]);

  return (
    <SetupDrawer
      open={open}
      title="Attendance correction"
      description="Updates punch time and logs a correction request"
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
              if (!record || !newTime || !reason) {
                toast("Correct time and reason required", "error");
                return;
              }
              setBusy(true);
              void applyAttendanceCorrection({
                record,
                field,
                newTime,
                reason,
                attachmentName: fileName,
              })
                .then(() => {
                  toast("Correction applied and logged", "success");
                  onSaved();
                  onClose();
                })
                .catch((e) => toast(e instanceof Error ? e.message : "Correction failed", "error"))
                .finally(() => setBusy(false));
            }}
          >
            {busy ? "Saving…" : "Submit correction"}
          </Button>
        </>
      }
    >
      {record ? (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            {record.extension.employeeName} · {record.attendanceDate}
          </p>
          <SetupField label="Field">
            <SetupSelect value={field} onChange={(e) => setField(e.target.value as "check_in" | "check_out")}>
              <option value="check_in">Check in</option>
              <option value="check_out">Check out</option>
            </SetupSelect>
          </SetupField>
          <SetupField label="Old time">
            <SetupInput value={oldTime} readOnly />
          </SetupField>
          <SetupField label="Correct time" required>
            <SetupInput type="time" value={newTime} onChange={(e) => setNewTime(e.target.value)} />
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
            <li>Punch time is updated immediately</li>
            <li>Correction request is audit-logged</li>
            <li>Status moves to pending approval review</li>
          </ol>
        </div>
      ) : null}
    </SetupDrawer>
  );
}
