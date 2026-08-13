"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { SetupDrawer } from "@/components/hr/setup/setup-drawer";
import { toast } from "@/components/hr/setup/setup-toast";
import { Button } from "@/components/ui/button";
import { isWeeklyOffDay } from "@/lib/hr/weekly-off-rules";
import { setRosterCell } from "@/services/shift-roster-service";
import type { ShiftRosterDirectory } from "@/services/shift-roster-service";
import { cn } from "@/lib/utils";

type CalMode = "week" | "month";

export function RosterCalendarView({
  directory,
  onUpdated,
}: {
  directory: ShiftRosterDirectory;
  onUpdated: () => void;
}) {
  const [mode, setMode] = useState<CalMode>("week");
  const [anchor, setAnchor] = useState(() => new Date());
  const [dragShiftId, setDragShiftId] = useState("");
  const [detail, setDetail] = useState<{ date: string; employeeId: string } | null>(null);

  const employees = directory.options.employees.slice(0, 8);

  const dates = useMemo(() => {
    const list: string[] = [];
    if (mode === "week") {
      const start = new Date(anchor);
      start.setDate(start.getDate() - start.getDay());
      for (let i = 0; i < 7; i++) {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        list.push(d.toISOString().slice(0, 10));
      }
    } else {
      const y = anchor.getFullYear();
      const m = anchor.getMonth();
      const days = new Date(y, m + 1, 0).getDate();
      for (let d = 1; d <= days; d++) {
        list.push(`${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
      }
    }
    return list;
  }, [anchor, mode]);

  function cellShift(date: string, employeeId: string) {
    const holiday = directory.holidays.some((h) => h.date === date);
    const override = directory.rosterCells.find((c) => c.date === date && c.employeeId === employeeId);
    if (override) return override;

    const weeklyOff = isWeeklyOffDay(date, directory.weeklyOffRules, {
      alternateSaturdayStart: directory.weeklyOffAlternateSaturdayStart || null,
    });
    if (holiday) {
      return {
        date,
        employeeId,
        shiftId: "",
        shiftName: "Holiday",
        color: "#f59e0b",
        isWeeklyOff: false,
        isHoliday: true,
      };
    }
    if (weeklyOff) {
      return {
        date,
        employeeId,
        shiftId: "",
        shiftName: "WO",
        color: "#94a3b8",
        isWeeklyOff: true,
        isHoliday: false,
      };
    }

    const assign = directory.assignments.find(
      (a) =>
        a.employeeId === employeeId &&
        a.effectiveFrom <= date &&
        (!a.effectiveTo || a.effectiveTo >= date) &&
        a.status !== "inactive",
    );
    if (assign) {
      const sh = directory.shifts.find((s) => s.id === assign.shiftId);
      return {
        date,
        employeeId,
        shiftId: assign.shiftId,
        shiftName: sh ? `${sh.shiftCode}` : assign.shiftName || "—",
        color: sh?.extension.color ?? "#64748b",
        isWeeklyOff: false,
        isHoliday: false,
      };
    }

    const rot = directory.rotations.find(
      (r) =>
        r.status === "active" &&
        r.employeeIds.includes(employeeId) &&
        r.effectiveFrom &&
        r.effectiveFrom <= date &&
        r.sequence.length > 0,
    );
    if (rot) {
      const start = new Date(`${rot.effectiveFrom}T12:00:00`);
      const cur = new Date(`${date}T12:00:00`);
      const dayDiff = Math.floor((cur.getTime() - start.getTime()) / 86_400_000);
      if (dayDiff >= 0) {
        const token = String(rot.sequence[dayDiff % rot.sequence.length] ?? "").trim();
        if (/^(off|wo|weekly.?off)$/i.test(token)) {
          return {
            date,
            employeeId,
            shiftId: "",
            shiftName: "WO",
            color: "#94a3b8",
            isWeeklyOff: true,
            isHoliday: false,
          };
        }
        const sh = directory.shifts.find(
          (s) =>
            s.shiftCode.toLowerCase() === token.toLowerCase() ||
            s.shiftName.toLowerCase() === token.toLowerCase() ||
            s.shiftType.toLowerCase() === token.toLowerCase(),
        );
        return {
          date,
          employeeId,
          shiftId: sh?.id ?? "",
          shiftName: (sh?.shiftCode ?? token) || "—",
          color: sh?.extension.color ?? "#64748b",
          isWeeklyOff: false,
          isHoliday: false,
        };
      }
    }

    return null;
  }

  function onDrop(date: string, employeeId: string) {
    if (!dragShiftId) return;
    const sh = directory.shifts.find((s) => s.id === dragShiftId);
    if (!sh) return;
    void setRosterCell({
      date,
      employeeId,
      shiftId: sh.id,
      shiftName: sh.shiftName,
      color: sh.extension.color,
      isWeeklyOff: false,
      isHoliday: directory.holidays.some((h) => h.date === date),
    }).then(() => {
      toast("Roster updated", "info");
      onUpdated();
    });
  }

  return (
    <div className="space-y-3 rounded-xl border border-border/70 bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant={mode === "week" ? "default" : "outline"}
            className="cursor-pointer"
            onClick={() => setMode("week")}
          >
            Weekly
          </Button>
          <Button
            type="button"
            size="sm"
            variant={mode === "month" ? "default" : "outline"}
            className="cursor-pointer"
            onClick={() => setMode("month")}
          >
            Monthly
          </Button>
        </div>
        <div className="flex items-center gap-1">
          <Button type="button" variant="outline" size="icon-sm" className="cursor-pointer" onClick={() => {
            const d = new Date(anchor);
            d.setDate(d.getDate() - (mode === "week" ? 7 : 30));
            setAnchor(d);
          }}>
            <ChevronLeft className="size-4" />
          </Button>
          <Button type="button" variant="outline" size="icon-sm" className="cursor-pointer" onClick={() => {
            const d = new Date(anchor);
            d.setDate(d.getDate() + (mode === "week" ? 7 : 30));
            setAnchor(d);
          }}>
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {directory.shifts.map((s) => (
          <button
            key={s.id}
            type="button"
            draggable
            className="cursor-grab rounded-md border px-2 py-1 text-[10px] font-medium text-white"
            style={{ backgroundColor: s.extension.color }}
            onDragStart={() => setDragShiftId(s.id)}
          >
            {s.shiftCode}
          </button>
        ))}
        <span className="text-[10px] text-muted-foreground self-center">Drag shift onto roster cells</span>
      </div>

      <div className="erp-scroll overflow-x-scroll">
        <table className="w-max min-w-full text-left text-xs">
          <thead>
            <tr className="border-b border-border/70">
              <th className="sticky left-0 bg-card py-2 pr-2">Employee</th>
              {dates.map((d) => (
                <th key={d} className="min-w-11 px-1 py-2 text-center font-normal text-muted-foreground">
                  {d.slice(5)}
                  {directory.holidays.some((h) => h.date === d) ? (
                    <span className="block text-[9px] text-amber-600">HOL</span>
                  ) : null}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {employees.map((emp) => (
              <tr key={emp.id} className="border-b border-border/40">
                <td className="sticky left-0 bg-card py-1 pr-2 font-medium">{emp.label.split(" ")[0]}</td>
                {dates.map((date) => {
                  const cell = cellShift(date, emp.id);
                  return (
                    <td
                      key={date}
                      className="p-0.5"
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => onDrop(date, emp.id)}
                    >
                      <button
                        type="button"
                        className={cn(
                          "cursor-pointer h-8 w-full rounded text-[9px] font-medium text-white",
                          !cell && "border border-dashed border-border bg-muted/30 text-muted-foreground",
                        )}
                        style={cell ? { backgroundColor: cell.color } : undefined}
                        onClick={() => setDetail({ date, employeeId: emp.id })}
                      >
                        {cell?.shiftName.slice(0, 3) ?? "—"}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <SetupDrawer
        open={Boolean(detail)}
        title="Roster detail"
        onClose={() => setDetail(null)}
      >
        {detail ? (
          <p className="text-xs text-muted-foreground">
            {detail.date} · Employee {detail.employeeId.slice(0, 8)}…
            <br />
            Use drag-and-drop to assign or swap shifts. Approve roster changes from HR workflow.
          </p>
        ) : null}
      </SetupDrawer>
    </div>
  );
}
