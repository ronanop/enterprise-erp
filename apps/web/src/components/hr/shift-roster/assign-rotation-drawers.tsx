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
  const [empQuery, setEmpQuery] = useState("");

  const employees = directory?.options.employees ?? [];
  const filteredEmployees = empQuery.trim()
    ? employees.filter((e) => {
        const q = empQuery.trim().toLowerCase();
        return e.label.toLowerCase().includes(q) || e.code.toLowerCase().includes(q);
      })
    : employees;

  const allFilteredSelected =
    filteredEmployees.length > 0 && filteredEmployees.every((e) => employeeIds.includes(e.id));

  function toggleEmployee(id: string) {
    setEmployeeIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function toggleAllFiltered() {
    if (allFilteredSelected) {
      const remove = new Set(filteredEmployees.map((e) => e.id));
      setEmployeeIds((prev) => prev.filter((id) => !remove.has(id)));
      return;
    }
    setEmployeeIds((prev) => {
      const next = new Set(prev);
      for (const e of filteredEmployees) next.add(e.id);
      return Array.from(next);
    });
  }

  return (
    <SetupDrawer
      open={open}
      title="Create rotation"
      description="Define a repeating shift pattern and assign it to one or more employees."
      wide
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" size="sm" className="cursor-pointer" onClick={onClose}>
            Cancel
          </Button>
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
        <SetupField label="Rotation name" required hint="Display name for this rotation pattern">
          <SetupInput
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Warehouse Team A"
          />
        </SetupField>
        <SetupField label="Rotation code" hint="Short unique ID used in reports">
          <SetupInput value={code} onChange={(e) => setCode(e.target.value)} />
        </SetupField>
        <SetupField label="Cycle" hint="How long one full pass through the sequence lasts">
          <SetupSelect value={cycle} onChange={(e) => setCycle(e.target.value as typeof cycle)}>
            <option value="weekly">Weekly</option>
            <option value="bi_weekly">Bi-weekly</option>
            <option value="monthly">Monthly</option>
          </SetupSelect>
        </SetupField>
        <SetupField label="Effective date" hint="First day this rotation applies on the roster">
          <SetupInput
            type="date"
            value={effectiveFrom}
            onChange={(e) => setEffectiveFrom(e.target.value)}
          />
        </SetupField>
        <div className="sm:col-span-2">
          <SetupField
            label="Sequence"
            hint="Shift order by day, separated by → or comma. Use shift codes (GEN, SHIFT-001) or Off / WO."
          >
            <SetupInput
              value={sequence}
              onChange={(e) => setSequence(e.target.value)}
              placeholder="GEN → SHIFT-001 → SHIFT-002 → Off"
            />
          </SetupField>
        </div>
        <div className="sm:col-span-2">
          <SetupField
            label="Assign employees"
            hint={
              employeeIds.length
                ? `${employeeIds.length} selected — these people follow this rotation on the roster calendar`
                : "Tick one or more employees who will rotate through the sequence"
            }
          >
            <div className="rounded-lg border border-input">
              <div className="flex flex-wrap items-center gap-2 border-b border-border/60 px-2.5 py-2">
                <SetupInput
                  value={empQuery}
                  onChange={(e) => setEmpQuery(e.target.value)}
                  placeholder="Search employees…"
                  className="h-7 min-w-[10rem] flex-1 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
                />
                <button
                  type="button"
                  className="cursor-pointer text-[10px] font-medium text-primary transition-colors duration-200 hover:underline"
                  onClick={toggleAllFiltered}
                >
                  {allFilteredSelected ? "Clear filtered" : "Select filtered"}
                </button>
                {employeeIds.length > 0 ? (
                  <button
                    type="button"
                    className="cursor-pointer text-[10px] font-medium text-muted-foreground transition-colors duration-200 hover:text-foreground"
                    onClick={() => setEmployeeIds([])}
                  >
                    Clear all
                  </button>
                ) : null}
              </div>
              <div className="erp-scroll max-h-48 overflow-y-auto p-1.5">
                {filteredEmployees.length === 0 ? (
                  <p className="px-2 py-6 text-center text-[11px] text-muted-foreground">
                    No employees match your search.
                  </p>
                ) : (
                  <ul className="space-y-0.5">
                    {filteredEmployees.map((emp) => {
                      const checked = employeeIds.includes(emp.id);
                      return (
                        <li key={emp.id}>
                          <label
                            className={`flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors duration-150 hover:bg-muted/50 ${
                              checked ? "bg-muted/40" : ""
                            }`}
                          >
                            <input
                              type="checkbox"
                              className="size-3.5 cursor-pointer accent-primary"
                              checked={checked}
                              onChange={() => toggleEmployee(emp.id)}
                            />
                            <span className="min-w-0 flex-1 truncate font-medium">{emp.label}</span>
                            {emp.code ? (
                              <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                                {emp.code}
                              </span>
                            ) : null}
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          </SetupField>
        </div>
      </div>
    </SetupDrawer>
  );
}
