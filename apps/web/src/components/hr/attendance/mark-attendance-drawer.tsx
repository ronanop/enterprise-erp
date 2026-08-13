"use client";

import { useEffect, useState } from "react";

import { SetupDrawer, SetupField, SetupInput, SetupSelect, SetupTextarea, toApiTimeValue } from "@/components/hr/setup/setup-drawer";
import { toast } from "@/components/hr/setup/setup-toast";
import { Button } from "@/components/ui/button";
import { ApiClientError } from "@/services/api-client";
import { markAttendance } from "@/services/attendance-management-service";
import type { AttendanceDirectory } from "@/services/attendance-management-service";
import { getAssignedShiftId } from "@/services/hr-master-connector";
import type { AttendanceSource, AttendanceStatusCode } from "@/types/attendance-management";
import { ATTENDANCE_STATUS_LABELS } from "@/types/attendance-management";

const SOURCES: AttendanceSource[] = [
  "manual",
  "biometric",
  "mobile",
  "web",
  "qr",
  "face_recognition",
];

const STATUSES = Object.keys(ATTENDANCE_STATUS_LABELS) as AttendanceStatusCode[];

export function MarkAttendanceDrawer({
  open,
  onClose,
  onSaved,
  directory,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  directory: AttendanceDirectory | null;
}) {
  const [branchId, setBranchId] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [shiftId, setShiftId] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [checkIn, setCheckIn] = useState("09:00");
  const [checkOut, setCheckOut] = useState("18:00");
  const [breakStart, setBreakStart] = useState("13:00");
  const [breakEnd, setBreakEnd] = useState("13:30");
  const [status, setStatus] = useState<AttendanceStatusCode>("present");
  const [location, setLocation] = useState("");
  const [source, setSource] = useState<AttendanceSource>("manual");
  const [gps, setGps] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !directory) return;
    if (directory.options.branches[0]) setBranchId((p) => p || directory.options.branches[0].id);
    if (directory.options.employees[0]) setEmployeeId((p) => p || directory.options.employees[0].id);
  }, [open, directory]);

  useEffect(() => {
    if (!employeeId || !date) return;
    const assigned = getAssignedShiftId(employeeId, date);
    if (assigned) setShiftId(assigned);
  }, [employeeId, date]);

  async function submit() {
    if (!branchId || !employeeId || !date) {
      toast("Branch, employee, and date are required", "error");
      return;
    }
    setSaving(true);
    try {
      await markAttendance({
        branchId,
        employeeId,
        attendanceDate: date,
        shiftId,
        checkIn,
        checkOut,
        breakStart,
        breakEnd,
        status,
        location,
        source,
        gpsCoordinates: gps,
        notes,
      });
      toast("Attendance saved", "success");
      onSaved();
      onClose();
    } catch (err) {
      toast(err instanceof ApiClientError ? err.message : "Save failed", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <SetupDrawer
      open={open}
      title="Mark Attendance"
      description="Record check-in/out, breaks, source, and GPS for audit-ready tracking."
      wide
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="outline" size="sm" className="cursor-pointer" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" size="sm" className="cursor-pointer" disabled={saving} onClick={() => void submit()}>
            {saving ? "Saving…" : "Save attendance"}
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <SetupField label="Employee" required>
          <SetupSelect value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
            <option value="">Select</option>
            {directory?.options.employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.label} ({e.code})
              </option>
            ))}
          </SetupSelect>
        </SetupField>
        <SetupField label="Attendance date" required>
          <SetupInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </SetupField>
        <SetupField label="Branch" required>
          <SetupSelect value={branchId} onChange={(e) => setBranchId(e.target.value)}>
            {directory?.options.branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.label}
              </option>
            ))}
          </SetupSelect>
        </SetupField>
        <SetupField label="Shift">
          <SetupSelect value={shiftId} onChange={(e) => setShiftId(e.target.value)}>
            <option value="">Default</option>
            {directory?.options.shifts.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </SetupSelect>
        </SetupField>
        <SetupField label="Check in">
          <SetupInput type="time" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} />
        </SetupField>
        <SetupField label="Check out">
          <SetupInput type="time" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} />
        </SetupField>
        <SetupField label="Break start">
          <SetupInput type="time" value={breakStart} onChange={(e) => setBreakStart(e.target.value)} />
        </SetupField>
        <SetupField label="Break end">
          <SetupInput type="time" value={breakEnd} onChange={(e) => setBreakEnd(e.target.value)} />
        </SetupField>
        <SetupField label="Attendance status">
          <SetupSelect value={status} onChange={(e) => setStatus(e.target.value as AttendanceStatusCode)}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {ATTENDANCE_STATUS_LABELS[s]}
              </option>
            ))}
          </SetupSelect>
        </SetupField>
        <SetupField label="Location">
          <SetupInput value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Office / WFH city" />
        </SetupField>
        <SetupField label="Attendance source">
          <SetupSelect value={source} onChange={(e) => setSource(e.target.value as AttendanceSource)}>
            {SOURCES.map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, " ")}
              </option>
            ))}
          </SetupSelect>
        </SetupField>
        <SetupField label="GPS coordinates">
          <SetupInput value={gps} onChange={(e) => setGps(e.target.value)} placeholder="lat, lng" />
        </SetupField>
        <SetupField label="Notes" hint={`API time: ${toApiTimeValue(checkIn)}`}>
          <SetupTextarea value={notes} onChange={(e) => setNotes(e.target.value)} />
        </SetupField>
      </div>
    </SetupDrawer>
  );
}
