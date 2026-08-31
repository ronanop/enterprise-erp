"use client";

import { useEffect, useState } from "react";

import { HrField, HrFormDialog, HrSelect } from "@/components/hr/hr-form-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiClientError } from "@/services/api-client";
import {
  createAttendance,
  listHrBranchOptions,
  listHrEmployeeOptions,
  listShiftOptions,
  type HrOption,
} from "@/services/hr-service";

const STATUSES = ["present", "absent", "half_day", "work_from_home", "holiday", "on_leave"];

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
};

export function MarkAttendanceDialog({ open, onClose, onSaved }: Props) {
  const [branches, setBranches] = useState<HrOption[]>([]);
  const [employees, setEmployees] = useState<HrOption[]>([]);
  const [shifts, setShifts] = useState<HrOption[]>([]);
  const [branchId, setBranchId] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [shiftId, setShiftId] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [status, setStatus] = useState("present");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    void Promise.all([
      listHrBranchOptions(),
      listHrEmployeeOptions(),
      listShiftOptions(),
    ]).then(([b, e, s]) => {
      setBranches(b);
      setEmployees(e);
      setShifts(s);
      if (b[0]) setBranchId((prev) => prev || b[0].id);
      if (e[0]) setEmployeeId((prev) => prev || e[0].id);
    });
  }, [open]);

  async function submit() {
    setError(null);
    if (!branchId || !employeeId || !date || !status) {
      setError("Branch, employee, date, and status are required.");
      return;
    }
    setSaving(true);
    try {
      await createAttendance({
        branch_id: branchId,
        employee_id: employeeId,
        attendance_date: date,
        attendance_status: status,
        shift_id: shiftId || null,
        notes: notes || undefined,
      });
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to mark attendance");
    } finally {
      setSaving(false);
    }
  }

  return (
    <HrFormDialog
      open={open}
      title="Mark Attendance"
      description="Record daily attendance for an employee."
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="outline" className="cursor-pointer" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            className="cursor-pointer"
            disabled={saving}
            onClick={() => void submit()}
          >
            {saving ? "Saving…" : "Save attendance"}
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <HrField label="Branch">
          <HrSelect value={branchId} onChange={(e) => setBranchId(e.target.value)}>
            <option value="">Select branch</option>
            {branches.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </HrSelect>
        </HrField>
        <HrField label="Employee">
          <HrSelect value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
            <option value="">Select employee</option>
            {employees.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </HrSelect>
        </HrField>
        <HrField label="Date">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </HrField>
        <HrField label="Status">
          <HrSelect value={status} onChange={(e) => setStatus(e.target.value)}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.replaceAll("_", " ")}
              </option>
            ))}
          </HrSelect>
        </HrField>
        <HrField label="Shift (optional)">
          <HrSelect value={shiftId} onChange={(e) => setShiftId(e.target.value)}>
            <option value="">None</option>
            {shifts.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </HrSelect>
        </HrField>
        <HrField label="Notes">
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
        </HrField>
      </div>
      {error ? <p className="mt-3 text-xs text-destructive">{error}</p> : null}
    </HrFormDialog>
  );
}
