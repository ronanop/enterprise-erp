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
  toTimeInputValue,
} from "@/components/hr/setup/setup-drawer";
import { toast } from "@/components/hr/setup/setup-toast";
import { Button } from "@/components/ui/button";
import { WEEKLY_OFF_RULE_OPTIONS, type WeeklyOffRuleCode } from "@/lib/hr/weekly-off-rules";
import { ApiClientError, formatApiError } from "@/services/api-client";
import { createShift, peekNextShiftCode, updateShift } from "@/services/shift-roster-service";
import type { ShiftRosterDirectory } from "@/services/shift-roster-service";
import type { ShiftRecord, ShiftTypeCode, WeeklyOffRule } from "@/types/shift-roster-management";
import {
  coerceShiftExtension,
  DEFAULT_SHIFT_EXTENSION,
  SHIFT_TYPE_LABELS,
} from "@/types/shift-roster-management";

const SHIFT_WEEKLY_OFF_OPTIONS = WEEKLY_OFF_RULE_OPTIONS.filter(
  (r) => r.id !== "custom" && r.id !== "rotating",
);

export function CreateShiftDrawer({
  open,
  onClose,
  onSaved,
  directory,
  initial = null,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  directory: ShiftRosterDirectory | null;
  initial?: ShiftRecord | null;
}) {
  const isEdit = Boolean(initial);
  const [shiftCode, setShiftCode] = useState("");
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
  const [color, setColor] = useState("#0F766E");
  const [weeklyOffRules, setWeeklyOffRules] = useState<WeeklyOffRule[]>(["sunday"]);
  const [altSatStart, setAltSatStart] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("active");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (initial) {
      const ext = coerceShiftExtension(initial.extension);
      setShiftCode(initial.shiftCode);
      setShiftName(initial.shiftName);
      setShiftType(initial.shiftType);
      setStartTime(toTimeInputValue(initial.startTime) || "09:00");
      setEndTime(toTimeInputValue(initial.endTime) || "18:00");
      setBreakStart(toTimeInputValue(ext.breakStart) || "");
      setBreakEnd(toTimeInputValue(ext.breakEnd) || "");
      setGraceIn(String(initial.graceMinutes ?? 0));
      setGraceOut(String(ext.graceOutMinutes ?? 0));
      setBreakMin(String(initial.breakMinutes ?? 0));
      setMinH(String(ext.minWorkingHours ?? 8));
      setMaxH(String(ext.maxWorkingHours ?? 12));
      setLateAfter(String(ext.lateAfterMinutes ?? 15));
      setEarlyExit(String(ext.earlyExitBeforeMinutes ?? 15));
      setOvernight(Boolean(initial.isOvernight));
      setOtAllowed(ext.overtimeAllowed !== false);
      setColor(ext.color || "#0F766E");
      setWeeklyOffRules(ext.weeklyOffRules);
      setAltSatStart(ext.weeklyOffAlternateSaturdayStart || "");
      setDescription(ext.description || "");
      setStatus(initial.status || "active");
      return;
    }
    setShiftCode(peekNextShiftCode());
    setShiftName("");
    setShiftType("general");
    setStartTime("09:00");
    setEndTime("18:00");
    setBreakStart("13:00");
    setBreakEnd("13:30");
    setGraceIn("15");
    setGraceOut("10");
    setBreakMin("30");
    setMinH("8");
    setMaxH("12");
    setLateAfter("15");
    setEarlyExit("15");
    setOvernight(false);
    setOtAllowed(true);
    setColor("#0F766E");
    setWeeklyOffRules(["sunday"]);
    setAltSatStart("");
    setDescription("");
    setStatus("active");
  }, [open, initial]);

  function toggleWeeklyOff(id: WeeklyOffRuleCode, checked: boolean) {
    setWeeklyOffRules((prev) => {
      if (checked) return prev.includes(id) ? prev : [...prev, id];
      const next = prev.filter((r) => r !== id);
      return next.length ? next : ["sunday"];
    });
  }

  async function submit() {
    if (!shiftName.trim()) {
      toast("Shift name required", "error");
      return;
    }
    if (!weeklyOffRules.length) {
      toast("Select at least one weekly off day", "error");
      return;
    }
    setSaving(true);
    try {
      const extension = {
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
        color,
        weeklyOffRules,
        weeklyOffAlternateSaturdayStart: weeklyOffRules.includes("alternate_saturday")
          ? altSatStart
          : "",
      };
      const body = {
        shiftName: shiftName.trim(),
        shiftType,
        startTime,
        endTime,
        graceMinutes: Number(graceIn) || 0,
        breakMinutes: Number(breakMin) || 0,
        isOvernight: overnight || shiftType === "night",
        extension,
      };
      if (initial) {
        await updateShift(initial, { ...body, status });
        toast("Shift updated", "success");
      } else {
        await createShift({
          ...body,
          shiftCode: shiftCode.trim() || peekNextShiftCode(),
          branchId: directory?.options.branches[0]?.id,
        });
        toast("Shift created", "success");
      }
      onSaved();
      onClose();
    } catch (err) {
      toast(
        formatApiError(err, isEdit ? "Update failed" : "Create failed"),
        "error",
      );
      if (!(err instanceof ApiClientError)) {
        console.error(isEdit ? "Shift update failed" : "Shift create failed", err);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <SetupDrawer
      open={open}
      title={isEdit ? "Edit shift" : "Create shift"}
      description={
        isEdit
          ? "Update shift timing, grace, OT, color, weekly offs, and status."
          : "Shift master — timing, grace, OT, color, and weekly offs for this shift."
      }
      wide
      onClose={onClose}
      footer={
        <>
          <Button
            variant="outline"
            size="sm"
            className="cursor-pointer transition-colors duration-200"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            className="cursor-pointer transition-colors duration-200"
            disabled={saving}
            onClick={() => void submit()}
          >
            {saving ? "Saving…" : isEdit ? "Save changes" : "Save shift"}
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <SetupField label="Shift code" hint={isEdit ? "Code cannot be changed" : "Auto-generated"}>
          <SetupInput
            value={shiftCode}
            onChange={(e) => setShiftCode(e.target.value)}
            disabled={isEdit}
          />
        </SetupField>
        <SetupField label="Shift name" required>
          <SetupInput value={shiftName} onChange={(e) => setShiftName(e.target.value)} />
        </SetupField>
        <SetupField label="Shift type">
          <SetupSelect value={shiftType} onChange={(e) => setShiftType(e.target.value as ShiftTypeCode)}>
            {Object.entries(SHIFT_TYPE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </SetupSelect>
        </SetupField>
        <SetupField label="Color">
          <input
            type="color"
            value={color}
            className="h-8 w-full cursor-pointer"
            onChange={(e) => setColor(e.target.value)}
          />
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
        {isEdit ? (
          <SetupField label="Status">
            <SetupSelect value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </SetupSelect>
          </SetupField>
        ) : null}

        <div className="space-y-2 rounded-lg border border-border/70 bg-muted/20 p-3 text-xs sm:col-span-2">
          <p className="font-medium text-foreground">Weekly offs for this shift</p>
          <p className="text-[11px] text-muted-foreground">
            Applies to employees assigned to this shift (e.g. Sat + Sun). Roster WO uses these rules.
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 cursor-pointer text-[11px]"
              onClick={() => setWeeklyOffRules(["saturday", "sunday"])}
            >
              Sat + Sun
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 cursor-pointer text-[11px]"
              onClick={() => setWeeklyOffRules(["sunday"])}
            >
              Sunday only
            </Button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {SHIFT_WEEKLY_OFF_OPTIONS.map((rule) => (
              <label key={rule.id} className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={weeklyOffRules.includes(rule.id)}
                  onChange={(e) => toggleWeeklyOff(rule.id, e.target.checked)}
                />
                {rule.label}
              </label>
            ))}
          </div>
          {weeklyOffRules.includes("alternate_saturday") ? (
            <SetupField
              label="Alternate Saturday starts on"
              hint="First Saturday that is weekly off in the cycle"
            >
              <SetupInput
                type="date"
                value={altSatStart}
                onChange={(e) => setAltSatStart(e.target.value)}
              />
            </SetupField>
          ) : null}
        </div>

        <div className="flex flex-col gap-2 text-xs sm:col-span-2">
          <label className="flex cursor-pointer items-center gap-2">
            <input type="checkbox" checked={overnight} onChange={(e) => setOvernight(e.target.checked)} />
            Cross midnight / night shift
          </label>
          <label className="flex cursor-pointer items-center gap-2">
            <input type="checkbox" checked={otAllowed} onChange={(e) => setOtAllowed(e.target.checked)} />
            Overtime allowed
          </label>
        </div>
        <SetupField label="Description" hint={`API times ${toApiTimeValue(startTime)} - ${toApiTimeValue(endTime)}`}>
          <SetupTextarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="sm:col-span-2"
          />
        </SetupField>
      </div>
    </SetupDrawer>
  );
}
