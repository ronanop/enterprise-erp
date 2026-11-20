"use client";

import { useMemo, useState } from "react";
import { IconBack, IconCalendar, IconChevronRight } from "@/components/icons";
import type { EssAttendance } from "@/types/api";
import { formatTime } from "@/utils/datetime";
import * as ui from "@/theme/classes";

export type DayTone = "today" | "present" | "absent" | "leave" | "wfh" | null;

type Props = {
  todayStr: string;
  rows: EssAttendance[];
  leaveDays: Set<string>;
};

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"] as const;

const TONE_META: Record<
  Exclude<DayTone, null>,
  { label: string; fill: string; soft: string; text: string }
> = {
  today: {
    label: "Today",
    fill: "bg-[#2563eb]",
    soft: "bg-[#dbeafe] text-[#1d4ed8]",
    text: "text-white",
  },
  present: {
    label: "Present",
    fill: "bg-[#10B981]",
    soft: "bg-[#d1fae5] text-[#047857]",
    text: "text-white",
  },
  absent: {
    label: "Absent",
    fill: "bg-[#EF4444]",
    soft: "bg-[#fee2e2] text-[#b91c1c]",
    text: "text-white",
  },
  leave: {
    label: "Leave",
    fill: "bg-[#F59E0B]",
    soft: "bg-[#fef3c7] text-[#b45309]",
    text: "text-white",
  },
  wfh: {
    label: "WFH",
    fill: "bg-[#712ae2]",
    soft: "bg-[#ede9fe] text-[#6d28d9]",
    text: "text-white",
  },
};

function attendanceDayKey(value: string | null | undefined): string {
  if (!value) return "";
  return String(value).slice(0, 10);
}

function findRow(rows: EssAttendance[], day: string): EssAttendance | undefined {
  return rows.find((row) => attendanceDayKey(row.attendance_date) === day);
}

export function resolveDayTone(
  iso: string | null | undefined,
  todayStr: string,
  row: EssAttendance | undefined,
  leaveDays: Set<string>,
): DayTone {
  if (!iso) return null;
  if (iso === todayStr) return "today";
  if (leaveDays.has(iso)) return "leave";
  const st = (row?.attendance_status ?? "").toLowerCase();
  if (st === "absent") return "absent";
  if (st === "work_from_home") return "wfh";
  if (
    st === "present" ||
    st === "late" ||
    st === "on_duty" ||
    st === "half_day" ||
    Boolean(row?.check_in_at)
  ) {
    return "present";
  }
  return null;
}

function monthLabel(cursor: Date): string {
  return cursor.toLocaleString(undefined, { month: "long", year: "numeric" });
}

function buildCells(cursor: Date, todayStr: string) {
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const first = new Date(year, month, 1);
  const startPad = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: {
    day: number | null;
    iso: string | null;
    inMonth: boolean;
    weekend: boolean;
  }[] = [];

  for (let i = 0; i < startPad; i++) {
    cells.push({ day: null, iso: null, inMonth: false, weekend: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d);
    const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const dow = date.getDay();
    cells.push({
      day: d,
      iso,
      inMonth: true,
      weekend: dow === 0 || dow === 6,
    });
  }
  while (cells.length % 7 !== 0) {
    cells.push({ day: null, iso: null, inMonth: false, weekend: false });
  }
  void todayStr;
  return cells;
}

function shiftMonth(base: Date, delta: number): Date {
  return new Date(base.getFullYear(), base.getMonth() + delta, 1);
}

function prettyDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function statusTitle(
  tone: DayTone,
  row: EssAttendance | undefined,
): string {
  if (tone === "today") {
    if (row?.check_out_at) return "Today · Day complete";
    if (row?.check_in_at) return "Today · Working";
    return "Today · Not checked in";
  }
  if (tone) return TONE_META[tone].label;
  if (row?.attendance_status) {
    return row.attendance_status.replaceAll("_", " ");
  }
  return "No record";
}

export function AttendanceMonthCalendar({
  todayStr,
  rows,
  leaveDays,
}: Props) {
  const initial = useMemo(() => {
    const [y, m] = todayStr.split("-").map(Number);
    return new Date(y, (m || 1) - 1, 1);
  }, [todayStr]);

  const [cursor, setCursor] = useState(initial);
  const [selectedIso, setSelectedIso] = useState<string>(todayStr);

  const cells = useMemo(
    () => buildCells(cursor, todayStr),
    [cursor, todayStr],
  );

  const monthKey = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`;

  const counts = useMemo(() => {
    const tallies = { present: 0, absent: 0, leave: 0, wfh: 0 };
    for (const cell of cells) {
      if (!cell.inMonth || !cell.iso) continue;
      const tone = resolveDayTone(
        cell.iso,
        todayStr,
        findRow(rows, cell.iso),
        leaveDays,
      );
      if (tone === "present" || (tone === "today" && findRow(rows, cell.iso)?.check_in_at)) {
        tallies.present += 1;
      } else if (tone === "absent") tallies.absent += 1;
      else if (tone === "leave") tallies.leave += 1;
      else if (tone === "wfh") tallies.wfh += 1;
    }
    return tallies;
  }, [cells, leaveDays, rows, todayStr]);

  const selectedRow = findRow(rows, selectedIso);
  const selectedTone = resolveDayTone(
    selectedIso,
    todayStr,
    selectedRow,
    leaveDays,
  );
  const selectedInView = selectedIso.startsWith(monthKey);

  return (
    <section className={`${ui.card} overflow-hidden`}>
      <div className="bg-gradient-to-br from-[#eff6ff] via-white to-[#f0fdf4] px-4 pb-3 pt-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <button
            type="button"
            aria-label="Previous month"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-[#0b1c30] shadow-sm ring-1 ring-[#c3c6d7]/35 transition active:scale-95"
            onClick={() => setCursor((c) => shiftMonth(c, -1))}
          >
            <IconBack size={16} />
          </button>
          <div className="min-w-0 text-center">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#64748b]">
              Attendance calendar
            </p>
            <h3 className="truncate text-lg font-bold tracking-tight text-[#0b1c30]">
              {monthLabel(cursor)}
            </h3>
          </div>
          <button
            type="button"
            aria-label="Next month"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-[#0b1c30] shadow-sm ring-1 ring-[#c3c6d7]/35 transition active:scale-95"
            onClick={() => setCursor((c) => shiftMonth(c, 1))}
          >
            <span className="inline-flex rotate-180">
              <IconBack size={16} />
            </span>
          </button>
        </div>

        <div className="mb-3 grid grid-cols-4 gap-2">
          {(
            [
              ["Present", counts.present, "bg-[#10B981]/15 text-[#047857]"],
              ["Absent", counts.absent, "bg-[#EF4444]/15 text-[#b91c1c]"],
              ["Leave", counts.leave, "bg-[#F59E0B]/15 text-[#b45309]"],
              ["WFH", counts.wfh, "bg-[#712ae2]/15 text-[#6d28d9]"],
            ] as const
          ).map(([label, value, cls]) => (
            <div
              key={label}
              className={`rounded-xl px-2 py-2 text-center ${cls}`}
            >
              <p className="text-base font-bold leading-none">{value}</p>
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide opacity-80">
                {label}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="px-3 pb-4 pt-2">
        <div className="mb-2 grid grid-cols-7 gap-1 text-center text-[10px] font-bold uppercase tracking-wide text-[#94a3b8]">
          {WEEKDAYS.map((d) => (
            <span key={d}>{d}</span>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1.5">
          {cells.map((cell, i) => {
            if (!cell.inMonth || !cell.iso) {
              return <div key={i} className="h-11" />;
            }
            const row = findRow(rows, cell.iso);
            const tone = resolveDayTone(cell.iso, todayStr, row, leaveDays);
            const selected = selectedIso === cell.iso;
            const meta = tone ? TONE_META[tone] : null;
            return (
              <button
                key={cell.iso}
                type="button"
                onClick={() => setSelectedIso(cell.iso!)}
                className={`relative flex h-11 flex-col items-center justify-center rounded-2xl text-sm transition active:scale-95 ${
                  meta
                    ? `${meta.fill} ${meta.text} shadow-[0_6px_14px_rgba(15,23,42,0.12)]`
                    : cell.weekend
                      ? "bg-[#f8fafc] text-[#94a3b8]"
                      : "bg-[#f8fafc] text-[#0b1c30]"
                } ${
                  selected
                    ? "ring-2 ring-[#0b1c30]/25 ring-offset-2 ring-offset-white"
                    : ""
                }`}
              >
                <span className="font-semibold leading-none">{cell.day}</span>
                {tone === "today" ? (
                  <span className="mt-1 h-1 w-1 rounded-full bg-white/90" />
                ) : row?.check_in_at && tone === "present" ? (
                  <span className="mt-1 h-1 w-1 rounded-full bg-white/80" />
                ) : null}
              </button>
            );
          })}
        </div>

        <div className="mt-4 rounded-2xl border border-[#c3c6d7]/30 bg-[#f8fafc] p-3.5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wide text-[#64748b]">
                {selectedInView ? prettyDate(selectedIso) : "Selected day"}
              </p>
              <p className="mt-1 text-sm font-bold capitalize text-[#0b1c30]">
                {statusTitle(selectedTone, selectedRow)}
              </p>
            </div>
            {selectedTone ? (
              <span
                className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${TONE_META[selectedTone].soft}`}
              >
                {TONE_META[selectedTone].label}
              </span>
            ) : (
              <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-[#64748b] ring-1 ring-[#c3c6d7]/40">
                —
              </span>
            )}
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <DetailChip
              label="Check in"
              value={
                selectedRow?.check_in_at
                  ? formatTime(selectedRow.check_in_at)
                  : "—"
              }
            />
            <DetailChip
              label="Check out"
              value={
                selectedRow?.check_out_at
                  ? formatTime(selectedRow.check_out_at)
                  : "—"
              }
            />
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {(Object.keys(TONE_META) as Exclude<DayTone, null>[]).map((key) => (
            <span
              key={key}
              className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-[#434655] ring-1 ring-[#c3c6d7]/35"
            >
              <span className={`h-2.5 w-2.5 rounded-full ${TONE_META[key].fill}`} />
              {TONE_META[key].label}
            </span>
          ))}
        </div>

        <button
          type="button"
          className="mt-3 inline-flex w-full items-center justify-center gap-1.5 text-xs font-semibold text-[#2563eb]"
          onClick={() => {
            const [y, m] = todayStr.split("-").map(Number);
            setCursor(new Date(y, (m || 1) - 1, 1));
            setSelectedIso(todayStr);
          }}
        >
          <IconCalendar size={14} />
          Jump to today
          <IconChevronRight size={14} />
        </button>
      </div>
    </section>
  );
}

function DetailChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white px-3 py-2 ring-1 ring-[#c3c6d7]/30">
      <p className="text-[10px] font-bold uppercase tracking-wide text-[#94a3b8]">
        {label}
      </p>
      <p className="mt-0.5 text-sm font-bold text-[#0b1c30]">{value}</p>
    </div>
  );
}
