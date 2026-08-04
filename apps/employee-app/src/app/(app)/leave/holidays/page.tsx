"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AppHeader, SearchField } from "@/components/app-header";
import { IconCalendar } from "@/components/icons";
import { EmptyState } from "@/components/ui";
import { ApiClientError } from "@/services/api-client";
import { essService } from "@/services/ess-service";
import type { EssHolidayCalendar } from "@/types/api";
import * as ui from "@/theme/classes";

type HolidayRow = {
  id: string;
  name: string;
  date: string;
  weekday: string;
  kind: "mandatory" | "optional";
};

function flattenHolidays(calendars: EssHolidayCalendar[]): HolidayRow[] {
  const rows: HolidayRow[] = [];
  for (const cal of calendars) {
    if (String(cal.status).toLowerCase() === "archived") continue;
    const json = cal.holidays_json;
    const items = Array.isArray(json)
      ? json
      : json && typeof json === "object" && Array.isArray((json as { holidays?: unknown[] }).holidays)
        ? (json as { holidays: unknown[] }).holidays
        : [];
    for (const [idx, h] of items.entries()) {
      if (!h || typeof h !== "object") continue;
      const entry = h as {
        date?: string;
        holiday_date?: string;
        name?: string;
        title?: string;
        kind?: string;
        holiday_type?: string;
        half_day?: boolean;
        half_day_session?: string;
        remarks?: string;
      };
      const date = String(entry.date ?? entry.holiday_date ?? "").slice(0, 10);
      if (!date) continue;
      const d = new Date(`${date}T12:00:00`);
      const weekday = Number.isNaN(d.getTime())
        ? ""
        : d.toLocaleDateString(undefined, { weekday: "long" });
      const optional =
        String(entry.holiday_type ?? entry.kind ?? "").toLowerCase() === "optional";
      rows.push({
        id: `${cal.id}-${idx}-${date}`,
        name: String(entry.title ?? entry.name ?? "Holiday"),
        date,
        weekday,
        kind: optional ? "optional" : "mandatory",
      });
    }
  }
  return rows.sort((a, b) => a.date.localeCompare(b.date));
}

export default function HolidayCalendarPage() {
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selected, setSelected] = useState<string | null>(null);
  const [holidays, setHolidays] = useState<HolidayRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    essService
      .holidays()
      .then((res) => setHolidays(flattenHolidays(res.data ?? [])))
      .catch((err) =>
        setError(
          err instanceof ApiClientError ? err.message : "Failed to load holidays",
        ),
      );
  }, []);

  const calendar = useMemo(() => buildMonth(cursor), [cursor]);

  const holidayDates = useMemo(
    () => new Set(holidays.map((h) => h.date)),
    [holidays],
  );

  const upcoming = useMemo(() => {
    const q = query.trim().toLowerCase();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return holidays
      .filter((h) => new Date(`${h.date}T12:00:00`) >= today)
      .filter((h) => !q || h.name.toLowerCase().includes(q))
      .slice(0, 6);
  }, [holidays, query]);

  return (
    <div className="space-y-5">
      <AppHeader title={`Holidays ${cursor.getFullYear()}`} />

      {error ? (
        <p className="rounded-xl bg-[#ffdad6] px-3 py-2 text-sm text-[#ba1a1a]">{error}</p>
      ) : null}

      <SearchField
        value={query}
        onChange={setQuery}
        placeholder="Search for a festival..."
      />

      <section className={`${ui.card} p-4`}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-bold text-[#0b1c30]">{calendar.label}</h2>
          <div className="flex gap-2">
            <button
              type="button"
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#eff4ff] text-[#004ac6]"
              onClick={() =>
                setCursor(
                  new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1),
                )
              }
              aria-label="Previous month"
            >
              ‹
            </button>
            <button
              type="button"
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#eff4ff] text-[#004ac6]"
              onClick={() =>
                setCursor(
                  new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1),
                )
              }
              aria-label="Next month"
            >
              ›
            </button>
          </div>
        </div>
        <div className="mb-2 grid grid-cols-7 gap-1 text-center text-[10px] font-bold uppercase text-[#434655]">
          {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
            <span key={`${d}-${i}`}>{d}</span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {calendar.cells.map((cell, i) => {
            if (!cell.iso) return <div key={i} className="h-9" />;
            const isSelected = selected === cell.iso || (!selected && cell.isToday);
            const isHoliday = holidayDates.has(cell.iso);
            return (
              <button
                key={cell.iso}
                type="button"
                onClick={() => setSelected(cell.iso)}
                className={`relative flex h-9 items-center justify-center rounded-xl text-sm ${
                  isSelected
                    ? "bg-[#004ac6] font-bold text-white"
                    : cell.inMonth
                      ? "text-[#0b1c30]"
                      : "text-[#c3c6d7]"
                }`}
              >
                {cell.day}
                {isHoliday ? (
                  <span
                    className={`absolute bottom-0.5 h-1 w-1 rounded-full ${
                      isSelected ? "bg-white" : "bg-[#712ae2]"
                    }`}
                  />
                ) : null}
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[#0b1c30]">
            Upcoming Holidays
          </h2>
          <Link href="/leave" className="text-sm font-medium text-[#004ac6]">
            View All
          </Link>
        </div>
        {upcoming.length === 0 ? (
          <EmptyState
            title="No upcoming holidays"
            icon={<IconCalendar size={20} />}
          />
        ) : (
          <ul className="space-y-2">
            {upcoming.map((h) => {
              const d = new Date(`${h.date}T12:00:00`);
              const mon = d
                .toLocaleString(undefined, { month: "short" })
                .toUpperCase();
              const day = String(d.getDate()).padStart(2, "0");
              return (
                <li
                  key={h.id}
                  className={`${ui.card} flex items-center gap-3 p-3`}
                >
                  <div
                    className={`flex h-14 w-12 flex-col items-center justify-center rounded-xl text-center ${
                      h.kind === "mandatory"
                        ? "bg-[#dbe1ff] text-[#004ac6]"
                        : "bg-[#eaddff] text-[#712ae2]"
                    }`}
                  >
                    <span className="text-[10px] font-bold">{mon}</span>
                    <span className="text-lg font-bold leading-none">{day}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-[#0b1c30]">
                      {h.name}
                    </p>
                    <p className="text-xs text-[#434655]">
                      {h.weekday} · {d.getFullYear()}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                      h.kind === "mandatory"
                        ? "bg-[#ffdad6] text-[#ba1a1a]"
                        : "bg-[#eaddff] text-[#712ae2]"
                    }`}
                  >
                    {h.kind}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function buildMonth(cursor: Date) {
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const label = cursor.toLocaleString(undefined, {
    month: "long",
    year: "numeric",
  });
  const first = new Date(year, month, 1);
  const startPad = first.getDay(); // Sunday-first for holidays design
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const cells: {
    day: number;
    iso: string | null;
    inMonth: boolean;
    isToday: boolean;
  }[] = [];

  for (let i = 0; i < startPad; i++) {
    const d = new Date(year, month, -startPad + i + 1);
    cells.push({
      day: d.getDate(),
      iso: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
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
      iso: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
      inMonth: false,
      isToday: false,
    });
  }
  return { label, cells };
}
