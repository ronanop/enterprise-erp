"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";

import { SetupDrawer, SetupField, SetupInput, SetupSelect, SetupTextarea } from "@/components/hr/setup/setup-drawer";
import { toast } from "@/components/hr/setup/setup-toast";
import { Button } from "@/components/ui/button";
import { downloadTextFile } from "@/services/attendance-management-service";
import { submitCorrection } from "@/services/attendance-management-service";
import type { AttendanceRecord } from "@/types/attendance-management";

const SAMPLE = `employee_code,attendance_date,check_in,check_out,status,source
EMP-000001,2026-07-22,09:05,18:10,present,biometric`;

export function AttendanceImportDrawer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <SetupDrawer
      open={open}
      title="Import attendance"
      description="CSV import with duplicate validation (employee + date)."
      onClose={onClose}
      footer={
        <Button type="button" size="sm" className="cursor-pointer" onClick={onClose}>
          Close
        </Button>
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
        <input type="file" accept=".csv" className="cursor-pointer text-xs" />
      </SetupField>
      <p className="mt-2 text-[10px] text-muted-foreground">
        Rows are validated against existing employee codes and unique date per employee before POST to /hr/attendance.
      </p>
    </SetupDrawer>
  );
}

export function AttendanceCorrectionDrawer({
  open,
  onClose,
  record,
}: {
  open: boolean;
  onClose: () => void;
  record: AttendanceRecord | null;
}) {
  const [field, setField] = useState<"check_in" | "check_out">("check_in");
  const [oldTime, setOldTime] = useState("");
  const [newTime, setNewTime] = useState("");
  const [reason, setReason] = useState("");
  const [fileName, setFileName] = useState("");

  useEffect(() => {
    if (!open || !record) return;
    setOldTime(record.checkIn ? new Date(record.checkIn).toLocaleTimeString() : "");
    setNewTime("");
    setReason("");
    setFileName("");
  }, [open, record]);

  return (
    <SetupDrawer
      open={open}
      title="Attendance correction"
      description="Employee → Manager → HR → Approved"
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
            onClick={() => {
              if (!record || !newTime || !reason) {
                toast("Correct time and reason required", "error");
                return;
              }
              submitCorrection({
                attendanceId: record.id,
                employeeId: record.employeeId,
                date: record.attendanceDate,
                field,
                oldTime,
                newTime,
                reason,
                attachmentName: fileName,
              });
              toast("Correction submitted for approval", "success");
              onClose();
            }}
          >
            Submit request
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
            <li>Employee submits</li>
            <li>Manager reviews</li>
            <li>HR approves</li>
            <li>Attendance updated & audit logged</li>
          </ol>
        </div>
      ) : null}
    </SetupDrawer>
  );
}
