"use client";

import { useEffect, useMemo, useState } from "react";

import {
  SetupDrawer,
  SetupField,
  SetupInput,
  SetupSelect,
  SetupTextarea,
} from "@/components/hr/setup/setup-drawer";
import { toast } from "@/components/hr/setup/setup-toast";
import { Button } from "@/components/ui/button";
import { ApiClientError } from "@/services/api-client";
import {
  applyLeave,
  validateLeaveApplication,
  type LeaveDirectory,
} from "@/services/leave-management-service";
import type { ApplyLeavePayload, LeaveSession } from "@/types/leave-management";
import { cn } from "@/lib/utils";

export function ApplyLeaveDrawer({
  open,
  onClose,
  onSaved,
  directory,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  directory: LeaveDirectory | null;
}) {
  const [branchId, setBranchId] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [leaveTypeId, setLeaveTypeId] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [session, setSession] = useState<LeaveSession>("full_day");
  const [reason, setReason] = useState("");
  const [contact, setContact] = useState("");
  const [emergency, setEmergency] = useState("");
  const [delegate, setDelegate] = useState("");
  const [attachment, setAttachment] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !directory) return;
    if (directory.options.branches[0]) setBranchId((p) => p || directory.options.branches[0].id);
    if (directory.options.employees[0]) setEmployeeId((p) => p || directory.options.employees[0].id);
    if (directory.options.leaveTypes[0]) setLeaveTypeId((p) => p || directory.options.leaveTypes[0].id);
  }, [open, directory]);

  const payload: ApplyLeavePayload = {
    branchId,
    employeeId,
    leaveTypeId,
    fromDate,
    toDate,
    session,
    reason,
    contactDuringLeave: contact,
    emergencyContact: emergency,
    delegateToEmployeeId: delegate,
    attachmentName: attachment,
  };

  const validation = useMemo(() => {
    if (!directory || !fromDate || !toDate) {
      return { ok: false, messages: [], netDays: 0 };
    }
    return validateLeaveApplication(payload, directory);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recompute on field changes
  }, [directory, branchId, employeeId, leaveTypeId, fromDate, toDate, session, attachment, reason]);

  async function submit() {
    if (!directory) return;
    if (!validation.ok) {
      toast(validation.messages.find((m) => m.tone === "error")?.text ?? "Fix validation errors", "error");
      return;
    }
    setSaving(true);
    try {
      await applyLeave(payload, directory);
      toast("Leave request submitted for approval", "success");
      onSaved();
      onClose();
    } catch (err) {
      toast(err instanceof ApiClientError ? err.message : err instanceof Error ? err.message : "Submit failed", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <SetupDrawer
      open={open}
      title="Apply Leave"
      description="Leave cycle is calendar 1–last day (not payroll 20–20). Monthly credit posts after month end — then past dates in that month can be covered."
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
            disabled={saving || !validation.ok}
            onClick={() => void submit()}
          >
            {saving ? "Submitting…" : "Submit request"}
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
        <SetupField label="Branch">
          <SetupSelect value={branchId} onChange={(e) => setBranchId(e.target.value)}>
            {directory?.options.branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.label}
              </option>
            ))}
          </SetupSelect>
        </SetupField>
        <SetupField label="Leave type" required>
          <SetupSelect value={leaveTypeId} onChange={(e) => setLeaveTypeId(e.target.value)}>
            <option value="">Select</option>
            {directory?.options.leaveTypes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </SetupSelect>
        </SetupField>
        <SetupField label="Session">
          <SetupSelect value={session} onChange={(e) => setSession(e.target.value as LeaveSession)}>
            <option value="full_day">Full day</option>
            <option value="first_half">First half</option>
            <option value="second_half">Second half</option>
          </SetupSelect>
        </SetupField>
        <SetupField label="From date" required>
          <SetupInput type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
        </SetupField>
        <SetupField label="To date" required>
          <SetupInput type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
        </SetupField>
        <SetupField label="Net days (auto)">
          <SetupInput readOnly value={String(validation.netDays)} className="bg-muted/40" />
        </SetupField>
        <SetupField label="Delegate work to">
          <SetupSelect value={delegate} onChange={(e) => setDelegate(e.target.value)}>
            <option value="">None</option>
            {directory?.options.employees
              .filter((e) => e.id !== employeeId)
              .map((e) => (
                <option key={e.id} value={e.id}>
                  {e.label}
                </option>
              ))}
          </SetupSelect>
        </SetupField>
        <SetupField label="Contact during leave">
          <SetupInput value={contact} onChange={(e) => setContact(e.target.value)} />
        </SetupField>
        <SetupField label="Emergency contact">
          <SetupInput value={emergency} onChange={(e) => setEmergency(e.target.value)} />
        </SetupField>
        <SetupField label="Attachment">
          <input
            type="file"
            className="cursor-pointer text-xs"
            onChange={(e) => setAttachment(e.target.files?.[0]?.name ?? "")}
          />
        </SetupField>
        <SetupField label="Reason">
          <SetupTextarea value={reason} onChange={(e) => setReason(e.target.value)} />
        </SetupField>
      </div>

      {validation.messages.length ? (
        <ul className="mt-4 space-y-1.5">
          {validation.messages.map((m) => (
            <li
              key={m.text}
              className={cn(
                "rounded-lg border px-2.5 py-1.5 text-xs",
                m.tone === "error"
                  ? "border-red-200 bg-red-50 text-red-800"
                  : m.tone === "warn"
                    ? "border-amber-200 bg-amber-50 text-amber-900"
                    : "border-sky-200 bg-sky-50 text-sky-900",
              )}
            >
              {m.text}
            </li>
          ))}
        </ul>
      ) : null}
    </SetupDrawer>
  );
}
