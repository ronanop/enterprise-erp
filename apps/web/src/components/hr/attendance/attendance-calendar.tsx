"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { SetupDrawer } from "@/components/hr/setup/setup-drawer";
import { Button } from "@/components/ui/button";
import type { AttendanceRecord } from "@/types/attendance-management";
import { CALENDAR_CODES } from "@/types/attendance-management";
import { cn } from "@/lib/utils";

export function AttendanceCalendar({
  records,
  month,
  onMonthChange,
  onSelectDate,
}: {
  records: AttendanceRecord[];
  month: Date;
  onMonthChange: (d: Date) => void;
  onSelectDate: (date: string, dayRecords: AttendanceRecord[]) => void;
}) {
  const byDate = useMemo(() => {
    const map = new Map<string, AttendanceRecord[]>();
    for (const r of records) {
      const list = map.get(r.attendanceDate) ?? [];
      list.push(r);
      map.set(r.attendanceDate, list);
    }
    return map;
  }, [records]);

  const year = month.getFullYear();
  const mon = month.getMonth();
  const firstDow = new Date(year, mon, 1).getDay();
  const daysInMonth = new Date(year, mon + 1, 0).getDate();

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  function dateKey(day: number) {
    return `${year}-${String(mon + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  return (
    <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          className="cursor-pointer"
          onClick={() => onMonthChange(new Date(year, mon - 1, 1))}
        >
          <ChevronLeft className="size-4" />
        </Button>
        <h3 className="text-sm font-semibold">
          {month.toLocaleString("default", { month: "long", year: "numeric" })}
        </h3>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          className="cursor-pointer"
          onClick={() => onMonthChange(new Date(year, mon + 1, 1))}
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-medium text-muted-foreground">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="py-1">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (day === null) return <div key={`e-${i}`} />;
          const key = dateKey(day);
          const dayRows = byDate.get(key) ?? [];
          const code = dayRows[0] ? CALENDAR_CODES[dayRows[0].status] ?? "·" : "—";
          const count = dayRows.length;
          return (
            <button
              key={key}
              type="button"
              className={cn(
                "cursor-pointer flex min-h-[3.25rem] flex-col items-center justify-center rounded-lg border border-border/50 p-1 text-xs transition-colors hover:bg-muted/50",
                count > 0 && "border-primary/30 bg-primary/5",
              )}
              onClick={() => onSelectDate(key, dayRows)}
            >
              <span className="font-medium">{day}</span>
              <span className="text-[9px] text-muted-foreground">{count ? `${code} (${count})` : code}</span>
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-[10px] text-muted-foreground">
        Legend: P Present · A Absent · L Leave · WFH · WO Weekend · H Holiday / Half day · Late · MP Missed punch
      </p>
    </div>
  );
}

export function AttendanceDayDetailDrawer({
  open,
  date,
  records,
  onClose,
}: {
  open: boolean;
  date: string;
  records: AttendanceRecord[];
  onClose: () => void;
}) {
  return (
    <SetupDrawer
      open={open}
      title={`Attendance · ${date}`}
      description={`${records.length} record(s)`}
      onClose={onClose}
    >
      {records.length === 0 ? (
        <p className="text-xs text-muted-foreground">No punches recorded for this date.</p>
      ) : (
        <ul className="space-y-2 text-xs">
          {records.map((r) => (
            <li key={r.id} className="rounded-lg border border-border/60 px-3 py-2">
              <p className="font-medium">{r.extension.employeeName}</p>
              <p className="text-muted-foreground">
                {r.checkIn ? new Date(r.checkIn).toLocaleTimeString() : "—"} –{" "}
                {r.checkOut ? new Date(r.checkOut).toLocaleTimeString() : "—"} · {r.workingHours}h · OT{" "}
                {r.overtimeHours}h
              </p>
              <p className="capitalize text-muted-foreground">{r.status.replace(/_/g, " ")}</p>
            </li>
          ))}
        </ul>
      )}
    </SetupDrawer>
  );
}
