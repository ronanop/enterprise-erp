"use client";

import { useMemo } from "react";
import {
  compareIsoDates,
  isIsoInRange,
  todayLocalDate,
  toIsoDate,
} from "@/utils/datetime";

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"] as const;

export type MonthCell = {
  day: number;
  iso: string | null;
  inMonth: boolean;
  isToday: boolean;
};

export function buildMonthGridMondayFirst(cursor: Date): {
  label: string;
  cells: MonthCell[];
} {
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const label = cursor.toLocaleString(undefined, {
    month: "long",
    year: "numeric",
  });
  const first = new Date(year, month, 1);
  const startPad = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayIso = todayLocalDate();

  const cells: MonthCell[] = [];
  for (let i = 0; i < startPad; i++) {
    const d = new Date(year, month, -startPad + i + 1);
    cells.push({
      day: d.getDate(),
      iso: toIsoDate(d),
      inMonth: false,
      isToday: false,
    });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    cells.push({
      day: d,
      iso,
      inMonth: true,
      isToday: iso === todayIso,
    });
  }
  while (cells.length % 7 !== 0) {
    const next = cells.length - startPad - daysInMonth + 1;
    const d = new Date(year, month + 1, next);
    cells.push({
      day: d.getDate(),
      iso: toIsoDate(d),
      inMonth: false,
      isToday: false,
    });
  }
  return { label, cells };
}

type Props = {
  cursor: Date;
  onCursorChange: (next: Date) => void;
  startDate: string;
  endDate: string;
  onRangeChange: (start: string, end: string) => void;
  /** If set, days after this ISO are not selectable */
  maxDate?: string;
  className?: string;
};

export function MonthRangeCalendar({
  cursor,
  onCursorChange,
  startDate,
  endDate,
  onRangeChange,
  maxDate,
  className = "",
}: Props) {
  const { label, cells } = useMemo(
    () => buildMonthGridMondayFirst(cursor),
    [cursor],
  );

  function onDayTap(iso: string | null) {
    if (!iso) return;
    if (maxDate && compareIsoDates(iso, maxDate) > 0) return;

    if (!startDate || (startDate && endDate)) {
      onRangeChange(iso, "");
      return;
    }
    if (compareIsoDates(iso, startDate) < 0) {
      onRangeChange(iso, startDate);
      return;
    }
    onRangeChange(startDate, iso);
  }

  function prevMonth() {
    onCursorChange(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1));
  }

  function nextMonth() {
    onCursorChange(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1));
  }

  return (
    <div className={className}>
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={prevMonth}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-[#eff4ff] text-[#004ac6]"
          aria-label="Previous month"
        >
          ‹
        </button>
        <h3 className="text-sm font-bold text-[#0b1c30]">{label}</h3>
        <button
          type="button"
          onClick={nextMonth}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-[#eff4ff] text-[#004ac6]"
          aria-label="Next month"
        >
          ›
        </button>
      </div>
      <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[10px] font-bold uppercase text-[#434655]">
        {WEEKDAYS.map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((cell, i) => {
          const iso = cell.iso;
          const disabled = Boolean(
            !iso || (maxDate && iso && compareIsoDates(iso, maxDate) > 0),
          );
          const inRange =
            iso &&
            startDate &&
            endDate &&
            isIsoInRange(iso, startDate, endDate);
          const isStart = iso && startDate && iso === startDate.slice(0, 10);
          const isEnd = iso && endDate && iso === endDate.slice(0, 10);
          const isSingle =
            isStart && endDate && startDate.slice(0, 10) === endDate.slice(0, 10);

          return (
            <button
              key={`${iso ?? "x"}-${i}`}
              type="button"
              disabled={disabled}
              onClick={() => onDayTap(iso)}
              className={`relative flex h-9 items-center justify-center rounded-full text-sm transition ${
                !cell.inMonth ? "text-[#c3c6d7]" : "text-[#0b1c30]"
              } ${
                disabled
                  ? "cursor-not-allowed opacity-40"
                  : "active:scale-95"
              } ${
                isStart || isEnd || isSingle
                  ? "bg-[#004ac6] font-bold text-white"
                  : inRange
                    ? "bg-[#dbe1ff] font-semibold text-[#004ac6]"
                    : cell.isToday
                      ? "ring-2 ring-[#004ac6]/40 ring-offset-1"
                      : ""
              }`}
            >
              {cell.day}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Single-date picker (tap day to select). */
export function MonthSingleCalendar({
  cursor,
  onCursorChange,
  selectedDate,
  onSelectDate,
  maxDate,
  markedDates,
  className = "",
}: {
  cursor: Date;
  onCursorChange: (next: Date) => void;
  selectedDate: string;
  onSelectDate: (iso: string) => void;
  maxDate?: string;
  markedDates?: Set<string>;
  className?: string;
}) {
  const { label, cells } = useMemo(
    () => buildMonthGridMondayFirst(cursor),
    [cursor],
  );

  function prevMonth() {
    onCursorChange(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1));
  }

  function nextMonth() {
    onCursorChange(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1));
  }

  return (
    <div className={className}>
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={prevMonth}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-[#eff4ff] text-[#004ac6]"
          aria-label="Previous month"
        >
          ‹
        </button>
        <h3 className="text-sm font-bold text-[#0b1c30]">{label}</h3>
        <button
          type="button"
          onClick={nextMonth}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-[#eff4ff] text-[#004ac6]"
          aria-label="Next month"
        >
          ›
        </button>
      </div>
      <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[10px] font-bold uppercase text-[#434655]">
        {WEEKDAYS.map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((cell, i) => {
          const iso = cell.iso;
          const disabled = Boolean(
            !iso || (maxDate && iso && compareIsoDates(iso, maxDate) > 0),
          );
          const selected = iso && selectedDate && iso === selectedDate.slice(0, 10);
          const marked = iso && markedDates?.has(iso);

          return (
            <button
              key={`${iso ?? "x"}-${i}`}
              type="button"
              disabled={disabled}
              onClick={() => iso && onSelectDate(iso)}
              className={`relative flex h-9 items-center justify-center rounded-full text-sm ${
                !cell.inMonth ? "text-[#c3c6d7]" : "text-[#0b1c30]"
              } ${disabled ? "cursor-not-allowed opacity-40" : ""} ${
                selected
                  ? "bg-[#004ac6] font-bold text-white"
                  : marked
                    ? "bg-amber-100 font-semibold text-amber-900"
                    : cell.isToday
                      ? "ring-2 ring-[#004ac6]/30"
                      : ""
              }`}
            >
              {cell.day}
              {marked && !selected ? (
                <span className="absolute bottom-0.5 h-1 w-1 rounded-full bg-amber-600" />
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
