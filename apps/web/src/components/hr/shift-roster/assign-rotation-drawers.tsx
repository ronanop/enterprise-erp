"use client";

import { useState } from "react";

import { SetupDrawer, SetupField, SetupInput, SetupSelect, SetupTextarea } from "@/components/hr/setup/setup-drawer";
import { toast } from "@/components/hr/setup/setup-toast";
import { Button } from "@/components/ui/button";
import { assignShift, saveRotation } from "@/services/shift-roster-service";
import type { ShiftRosterDirectory } from "@/services/shift-roster-service";
import type { AssignmentType } from "@/types/shift-roster-management";

export function AssignShiftDrawer({
  open,
  onClose,
  onSaved,
  directory,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  directory: ShiftRosterDirectory | null;
}) {
  const [branchId, setBranchId] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [shiftId, setShiftId] = useState("");
  const [from, setFrom] = useState(() => new Date().toISOString().slice(0, 10));
  const [to, setTo] = useState("");
  const [type, setType] = useState<AssignmentType>("permanent");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!branchId || !employeeId || !shiftId || !from) {
      toast("Branch, employee, shift, and effective from are required", "error");
      return;
    }
    setSaving(true);
    try {
      await assignShift({
        branchId,
        employeeId,
        shiftId,
        effectiveFrom: from,
        effectiveTo: to,
        assignmentType: type,
        notes,
      });
      toast("Shift assigned", "success");
      onSaved();
      onClose();
    } catch {
      toast("Assignment failed", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <SetupDrawer
      open={open}
      title="Assign shift"
      description="Permanent, temporary, or rotation-linked assignment."
      wide
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" size="sm" className="cursor-pointer" onClick={onClose}>Cancel</Button>
          <Button size="sm" className="cursor-pointer" disabled={saving} onClick={() => void submit()}>
            {saving ? "Saving…" : "Assign"}
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <SetupField label="Branch" required>
          <SetupSelect value={branchId} onChange={(e) => setBranchId(e.target.value)}>
            <option value="">Select</option>
            {directory?.options.branches.map((b) => (
              <option key={b.id} value={b.id}>{b.label}</option>
            ))}
          </SetupSelect>
        </SetupField>
        <SetupField label="Employee" required>
          <SetupSelect value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
            <option value="">Select</option>
            {directory?.options.employees.map((e) => (
              <option key={e.id} value={e.id}>{e.label} ({e.code})</option>
            ))}
          </SetupSelect>
        </SetupField>
        <SetupField label="Shift" required>
          <SetupSelect value={shiftId} onChange={(e) => setShiftId(e.target.value)}>
            <option value="">Select</option>
            {directory?.options.shifts.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </SetupSelect>
        </SetupField>
        <SetupField label="Assignment type">
          <SetupSelect value={type} onChange={(e) => setType(e.target.value as AssignmentType)}>
            <option value="permanent">Permanent</option>
            <option value="temporary">Temporary</option>
            <option value="rotation">Rotation</option>
          </SetupSelect>
        </SetupField>
        <SetupField label="Effective from" required>
          <SetupInput type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </SetupField>
        <SetupField label="Effective to">
          <SetupInput type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </SetupField>
        <SetupField label="Notes" hint="Department follows employee master">
          <SetupTextarea value={notes} onChange={(e) => setNotes(e.target.value)} className="sm:col-span-2" />
        </SetupField>
      </div>
    </SetupDrawer>
  );
}

export function CreateRotationDrawer({
  open,
  onClose,
  onSaved,
  directory,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  directory: ShiftRosterDirectory | null;
}) {
  const [name, setName] = useState("");
  const [code, setCode] = useState(() => `ROT-${Date.now().toString().slice(-4)}`);
  const [cycle, setCycle] = useState<"weekly" | "bi_weekly" | "monthly">("weekly");
  const [sequence, setSequence] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState(() => new Date().toISOString().slice(0, 10));
  const [employeeIds, setEmployeeIds] = useState<string[]>([]);

  return (
    <SetupDrawer
      open={open}
      title="Create rotation"
      description="Morning → Evening → Night → Off cycles."
      wide
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" size="sm" className="cursor-pointer" onClick={onClose}>Cancel</Button>
          <Button
            size="sm"
            className="cursor-pointer"
            onClick={() => {
              if (!name) {
                toast("Rotation name required", "error");
                return;
              }
              void saveRotation({
                name,
                code,
                cycle,
                sequence: sequence.split(/[→,]/).map((s) => s.trim()).filter(Boolean),
                employeeIds,
                effectiveFrom,
                status: "active",
              }).then(() => {
                toast("Rotation saved", "success");
                onSaved();
                onClose();
              });
            }}
          >
            Save rotation
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <SetupField label="Rotation name" required>
          <SetupInput value={name} onChange={(e) => setName(e.target.value)} />
        </SetupField>
        <SetupField label="Rotation code">
          <SetupInput value={code} onChange={(e) => setCode(e.target.value)} />
        </SetupField>
        <SetupField label="Cycle">
          <SetupSelect value={cycle} onChange={(e) => setCycle(e.target.value as typeof cycle)}>
            <option value="weekly">Weekly</option>
            <option value="bi_weekly">Bi-weekly</option>
            <option value="monthly">Monthly</option>
          </SetupSelect>
        </SetupField>
        <SetupField label="Effective date">
          <SetupInput type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} />
        </SetupField>
        <SetupField label="Sequence" hint="Morning → Evening → Night → Off">
          <SetupInput value={sequence} onChange={(e) => setSequence(e.target.value)} className="sm:col-span-2" />
        </SetupField>
        <SetupField label="Assign employees">
          <select
            multiple
            className="min-h-[80px] w-full rounded-lg border border-input px-2 text-xs"
            value={employeeIds}
            onChange={(e) =>
              setEmployeeIds(Array.from(e.target.selectedOptions).map((o) => o.value))
            }
          >
            {directory?.options.employees.map((emp) => (
              <option key={emp.id} value={emp.id}>{emp.label}</option>
            ))}
          </select>
        </SetupField>
      </div>
    </SetupDrawer>
  );
}
