"use client";

import { useEffect, useState } from "react";

import { HrField, HrFormDialog, HrSelect } from "@/components/hr/hr-form-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiClientError } from "@/services/api-client";
import {
  createLeaveRequest,
  listHrBranchOptions,
  listHrEmployeeOptions,
  listLeaveTypeOptions,
  type HrOption,
} from "@/services/hr-service";

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
};

function dayCount(start: string, end: string): number {
  if (!start || !end) return 1;
  const a = new Date(start);
  const b = new Date(end);
  const ms = b.getTime() - a.getTime();
  if (!Number.isFinite(ms) || ms < 0) return 1;
  return Math.floor(ms / 86400000) + 1;
}

export function ApplyLeaveDialog({ open, onClose, onSaved }: Props) {
  const [branches, setBranches] = useState<HrOption[]>([]);
  const [employees, setEmployees] = useState<HrOption[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<HrOption[]>([]);
  const [branchId, setBranchId] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [leaveTypeId, setLeaveTypeId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    void Promise.all([
      listHrBranchOptions(),
      listHrEmployeeOptions(),
      listLeaveTypeOptions(),
    ]).then(([b, e, t]) => {
      setBranches(b);
      setEmployees(e);
      setLeaveTypes(t);
      if (!branchId && b[0]) setBranchId(b[0].id);
      if (!employeeId && e[0]) setEmployeeId(e[0].id);
      if (!leaveTypeId && t[0]) setLeaveTypeId(t[0].id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hydrate defaults once on open
  }, [open]);

  async function submit() {
    setError(null);
    if (!branchId || !employeeId || !leaveTypeId || !startDate || !endDate) {
      setError("Branch, employee, leave type, and dates are required.");
      return;
    }
    setSaving(true);
    try {
      await createLeaveRequest({
        branch_id: branchId,
        employee_id: employeeId,
        leave_type_id: leaveTypeId,
        start_date: startDate,
        end_date: endDate,
        days_count: dayCount(startDate, endDate),
        reason: reason || undefined,
      });
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to apply leave");
    } finally {
      setSaving(false);
    }
  }

  return (
    <HrFormDialog
      open={open}
      title="Apply Leave"
      description="Submit a leave request for approval."
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
            {saving ? "Submitting…" : "Submit request"}
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <HrField label="Branch" error={!branchId && error ? "Required" : undefined}>
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
        <HrField label="Leave type">
          <HrSelect value={leaveTypeId} onChange={(e) => setLeaveTypeId(e.target.value)}>
            <option value="">Select type</option>
            {leaveTypes.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </HrSelect>
        </HrField>
        <HrField label="Days (auto)">
          <Input
            readOnly
            value={String(dayCount(startDate, endDate))}
            className="bg-muted/40"
          />
        </HrField>
        <HrField label="Start date">
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </HrField>
        <HrField label="End date">
          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </HrField>
        <div className="sm:col-span-2">
          <HrField label="Reason">
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Optional reason"
            />
          </HrField>
        </div>
      </div>
      {error ? <p className="mt-3 text-xs text-destructive">{error}</p> : null}
    </HrFormDialog>
  );
}
