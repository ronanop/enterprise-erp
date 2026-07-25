"use client";

import { useEffect, useState } from "react";

import {
  SetupDrawer,
  SetupField,
  SetupInput,
  SetupSelect,
  SetupTextarea,
  SetupTimeInput,
  toApiTimeValue,
} from "@/components/hr/setup/setup-drawer";
import { toast } from "@/components/hr/setup/setup-toast";
import { Button } from "@/components/ui/button";
import { createShift, peekNextShiftCode } from "@/services/shift-roster-service";
import type { ShiftRosterDirectory } from "@/services/shift-roster-service";
import type { ShiftTypeCode } from "@/types/shift-roster-management";
import { DEFAULT_SHIFT_EXTENSION, SHIFT_TYPE_LABELS } from "@/types/shift-roster-management";

export function CreateShiftDrawer({
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
  const [shiftCode, setShiftCode] = useState("");

  useEffect(() => {
    if (open) setShiftCode(peekNextShiftCode());
  }, [open]);
  const [shiftName, setShiftName] = useState("");
  const [shiftType, setShiftType] = useState<ShiftTypeCode>("general");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("18:00");
  const [breakStart, setBreakStart] = useState("13:00");
  const [breakEnd, setBreakEnd] = useState("13:30");
  const [graceIn, setGraceIn] = useState("15");
  const [graceOut, setGraceOut] = useState("10");
  const [breakMin, setBreakMin] = useState("30");
  const [minH, setMinH] = useState("8");
  const [maxH, setMaxH] = useState("12");
  const [lateAfter, setLateAfter] = useState("15");
  const [earlyExit, setEarlyExit] = useState("15");
  const [overnight, setOvernight] = useState(false);
  const [otAllowed, setOtAllowed] = useState(true);
  const [autoAtt, setAutoAtt] = useState(false);
  const [color, setColor] = useState("#059669");
  const [weeklyOff, setWeeklyOff] = useState("sunday");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!shiftName.trim()) {
      toast("Shift name required", "error");
      return;
    }
    setSaving(true);
    try {
      await createShift({
        shiftCode,
        shiftName,
        shiftType,
        startTime,
        endTime,
        graceMinutes: Number(graceIn) || 0,
        breakMinutes: Number(breakMin) || 0,
        isOvernight: overnight || shiftType === "night",
        branchId: directory?.options.branches[0]?.id,
        extension: {
          ...DEFAULT_SHIFT_EXTENSION,
          description,
          breakStart,
          breakEnd,
          graceOutMinutes: Number(graceOut) || 0,
          minWorkingHours: Number(minH) || 8,
          maxWorkingHours: Number(maxH) || 12,
          lateAfterMinutes: Number(lateAfter) || 15,
          earlyExitBeforeMinutes: Number(earlyExit) || 15,
          overtimeAllowed: otAllowed,
          autoAttendance: autoAtt,
          color,
          weeklyOffRule: weeklyOff as typeof DEFAULT_SHIFT_EXTENSION.weeklyOffRule,
        },
      });
      toast("Shift created", "success");
      onSaved();
      onClose();
    } catch {
      toast("Create failed", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <SetupDrawer
      open={open}
      title="Create shift"
      description="Shift master — timing, grace, OT, color, weekly off rule."
      wide
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" size="sm" className="cursor-pointer" onClick={onClose}>Cancel</Button>
          <Button size="sm" className="cursor-pointer" disabled={saving} onClick={() => void submit()}>
            {saving ? "Saving…" : "Save shift"}
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <SetupField label="Shift code" hint="Auto-generated">
          <SetupInput value={shiftCode} onChange={(e) => setShiftCode(e.target.value)} />
        </SetupField>
        <SetupField label="Shift name" required>
          <SetupInput value={shiftName} onChange={(e) => setShiftName(e.target.value)} />
        </SetupField>
        <SetupField label="Shift type">
          <SetupSelect value={shiftType} onChange={(e) => setShiftType(e.target.value as ShiftTypeCode)}>
            {Object.entries(SHIFT_TYPE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </SetupSelect>
        </SetupField>
        <SetupField label="Color">
          <input type="color" value={color} className="h-8 w-full cursor-pointer" onChange={(e) => setColor(e.target.value)} />
        </SetupField>
        <SetupField label="Start time" required>
          <SetupTimeInput value={startTime} onChange={setStartTime} />
        </SetupField>
        <SetupField label="End time" required>
          <SetupTimeInput value={endTime} onChange={setEndTime} />
        </SetupField>
        <SetupField label="Break start">
          <SetupTimeInput value={breakStart} onChange={setBreakStart} />
        </SetupField>
        <SetupField label="Break end">
          <SetupTimeInput value={breakEnd} onChange={setBreakEnd} />
        </SetupField>
        <SetupField label="Grace in (min)">
          <SetupInput type="number" value={graceIn} onChange={(e) => setGraceIn(e.target.value)} />
        </SetupField>
        <SetupField label="Grace out (min)">
          <SetupInput type="number" value={graceOut} onChange={(e) => setGraceOut(e.target.value)} />
        </SetupField>
        <SetupField label="Break duration (min)">
          <SetupInput type="number" value={breakMin} onChange={(e) => setBreakMin(e.target.value)} />
        </SetupField>
        <SetupField label="Min working hours">
          <SetupInput type="number" value={minH} onChange={(e) => setMinH(e.target.value)} />
        </SetupField>
        <SetupField label="Max working hours">
          <SetupInput type="number" value={maxH} onChange={(e) => setMaxH(e.target.value)} />
        </SetupField>
        <SetupField label="Late after (min)">
          <SetupInput type="number" value={lateAfter} onChange={(e) => setLateAfter(e.target.value)} />
        </SetupField>
        <SetupField label="Early exit before (min)">
          <SetupInput type="number" value={earlyExit} onChange={(e) => setEarlyExit(e.target.value)} />
        </SetupField>
        <SetupField label="Weekly off rule">
          <SetupSelect value={weeklyOff} onChange={(e) => setWeeklyOff(e.target.value)}>
            <option value="sunday">Sunday</option>
            <option value="alternate_saturday">Alternate Saturday</option>
            <option value="second_saturday">Second Saturday</option>
            <option value="rotating">Rotating weekly off</option>
            <option value="custom">Custom</option>
          </SetupSelect>
        </SetupField>
        <div className="flex flex-col gap-2 text-xs sm:col-span-2">
          <label className="flex cursor-pointer items-center gap-2">
            <input type="checkbox" checked={overnight} onChange={(e) => setOvernight(e.target.checked)} />
            Cross midnight / night shift
          </label>
          <label className="flex cursor-pointer items-center gap-2">
            <input type="checkbox" checked={otAllowed} onChange={(e) => setOtAllowed(e.target.checked)} />
            Overtime allowed
          </label>
          <label className="flex cursor-pointer items-center gap-2">
            <input type="checkbox" checked={autoAtt} onChange={(e) => setAutoAtt(e.target.checked)} />
            Auto attendance
          </label>
        </div>
        <SetupField label="Description" hint={`API times ${toApiTimeValue(startTime)} – ${toApiTimeValue(endTime)}`}>
          <SetupTextarea value={description} onChange={(e) => setDescription(e.target.value)} className="sm:col-span-2" />
        </SetupField>
      </div>
    </SetupDrawer>
  );
}
