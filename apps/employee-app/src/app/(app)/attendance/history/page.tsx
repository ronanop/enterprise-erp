"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  FilterChips,
  SearchField,
  SubHeader,
} from "@/components/app-header";
import {
  IconChevronRight,
  IconClock,
  IconFingerprint,
  IconLogin,
  IconLogout,
} from "@/components/icons";
import { AlertBox, EmptyState, ViewportFab } from "@/components/ui";
import { ApiClientError } from "@/services/api-client";
import { essService } from "@/services/ess-service";
import type { EssAttendance, EssMe } from "@/types/api";
import * as ui from "@/theme/classes";
import { formatHoursLabel, formatTime, todayLocalDate } from "@/utils/datetime";

const FILTERS = ["All", "Present", "Late", "Overtime", "Absent"];

export default function AttendanceHistoryPage() {
  const [me, setMe] = useState<EssMe | null>(null);
  const [rows, setRows] = useState<EssAttendance[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All");
  const [selectedDate, setSelectedDate] = useState(todayLocalDate());

  useEffect(() => {
    Promise.all([essService.attendance(), essService.me()])
      .then(([att, meRes]) => {
        setRows(att.data ?? []);
        setMe(meRes.data);
      })
      .catch((err) =>
        setError(
          err instanceof ApiClientError
            ? err.message
            : "Failed to load attendance history",
        ),
      );
  }, []);

  const stats = useMemo(() => {
    const present = rows.filter((r) =>
      ["present", "complete"].includes(r.attendance_status.toLowerCase()),
    ).length;
    const absent = rows.filter((r) =>
      r.attendance_status.toLowerCase().includes("absent"),
    ).length;
    const late = rows.filter((r) => {
      if (!r.check_in_at) return false;
      const h = new Date(r.check_in_at).getHours();
      const m = new Date(r.check_in_at).getMinutes();
      return h > 9 || (h === 9 && m > 30);
    }).length;
    const ot = rows.reduce((sum, r) => {
      const h = Number(r.total_hours) || 0;
      return sum + Math.max(0, h - 8);
    }, 0);
    return { total: rows.length, present, late, absent, ot };
  }, [rows]);

  const week = useMemo(() => buildWeek(selectedDate), [selectedDate]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      const status = r.attendance_status.toLowerCase();
      const q = query.trim().toLowerCase();
      if (q && !`${r.attendance_date} ${status}`.includes(q)) return false;
      if (filter === "Present") return status.includes("present");
      if (filter === "Absent") return status.includes("absent");
      if (filter === "Late") {
        if (!r.check_in_at) return false;
        const h = new Date(r.check_in_at).getHours();
        const m = new Date(r.check_in_at).getMinutes();
        return h > 9 || (h === 9 && m > 30);
      }
      if (filter === "Overtime") return Number(r.total_hours) > 8;
      return true;
    });
  }, [rows, query, filter]);

  return (
    <div className="space-y-5">
      <SubHeader title="Attendance History" backHref="/attendance" name={me?.display_name} />

      {error ? <AlertBox>{error}</AlertBox> : null}

      <SearchField
        value={query}
        onChange={setQuery}
        placeholder="Search by date or status..."
      />
      <FilterChips options={FILTERS} value={filter} onChange={setFilter} />

      <section className={`${ui.card} p-4`}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold text-[#0b1c30]">{week.label}</h2>
          <span className="text-xs text-[#434655]">This week</span>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center">
          {week.days.map((d) => {
            const active = d.iso === selectedDate;
            const has = rows.some((r) => r.attendance_date === d.iso);
            return (
              <button
                key={d.iso}
                type="button"
                onClick={() => setSelectedDate(d.iso)}
                className={`flex flex-col items-center gap-1 rounded-2xl py-2 text-xs ${
                  active
                    ? "bg-[#004ac6] text-white"
                    : "text-[#0b1c30]"
                }`}
              >
                <span className={active ? "text-white/70" : "text-[#434655]"}>
                  {d.dow}
                </span>
                <span className="text-sm font-bold">{d.day}</span>
                {has && !active ? (
                  <span className="h-1 w-1 rounded-full bg-[#10B981]" />
                ) : (
                  <span className="h-1 w-1" />
                )}
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-[#0b1c30]">
          Monthly Overview
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <Stat label="Total Days" value={String(stats.total)} color="#004ac6" />
          <Stat label="Present" value={String(stats.present)} color="#006242" />
          <Stat label="Late" value={String(stats.late).padStart(2, "0")} color="#712ae2" />
          <Stat
            label="Overtime"
            value={`${stats.ot.toFixed(0)}h`}
            color="#2563eb"
          />
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-end justify-between">
          <h2 className="text-lg font-semibold text-[#0b1c30]">Past Records</h2>
          <Link
            href="/attendance/correction"
            className="text-sm font-medium text-[#004ac6]"
          >
            Request correction
          </Link>
        </div>
        {filtered.length === 0 ? (
          <EmptyState
            title="No records"
            description="Try another filter or date range."
            icon={<IconFingerprint size={20} />}
          />
        ) : (
          <ul className="space-y-3">
            {filtered.map((row) => {
              const hours = Number(row.total_hours) || 0;
              const overtime = hours > 8;
              const late =
                row.check_in_at &&
                (new Date(row.check_in_at).getHours() > 9 ||
                  (new Date(row.check_in_at).getHours() === 9 &&
                    new Date(row.check_in_at).getMinutes() > 30));
              return (
                <li key={row.id} className={`${ui.card} space-y-3 p-4`}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-[#0b1c30]">
                        {formatLongDate(row.attendance_date)}
                      </p>
                      <p className="text-[10px] font-bold uppercase tracking-wide text-[#434655]">
                        Regular shift · {row.source}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                        overtime
                          ? "bg-[#eaddff] text-[#712ae2]"
                          : late
                            ? "bg-amber-100 text-amber-800"
                            : row.attendance_status === "absent"
                              ? "bg-[#ffdad6] text-[#ba1a1a]"
                              : "bg-emerald-100 text-emerald-800"
                      }`}
                    >
                      {overtime
                        ? "Overtime"
                        : late
                          ? "Late"
                          : row.attendance_status}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#dce9ff] text-[#004ac6]">
                        <IconLogin size={14} />
                      </span>
                      <div>
                        <p className="text-[10px] text-[#434655]">Check In</p>
                        <p className="font-semibold text-[#0b1c30]">
                          {formatTime(row.check_in_at)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#dce9ff] text-[#004ac6]">
                        <IconLogout size={14} />
                      </span>
                      <div>
                        <p className="text-[10px] text-[#434655]">Check Out</p>
                        <p className="font-semibold text-[#0b1c30]">
                          {formatTime(row.check_out_at)}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-between border-t border-[#c3c6d7]/25 pt-2 text-xs">
                    <span className="font-semibold text-[#004ac6]">
                      Total: {formatHoursLabel(row.total_hours)}
                    </span>
                    <span className="text-[#434655]">
                      <IconClock size={12} className="mr-1 inline" />
                      Break: 01h 00m
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="grid grid-cols-2 gap-2">
        <Link
          href="/attendance/correction"
          className={`${ui.card} flex items-center justify-between px-3 py-3 text-sm font-semibold text-[#0b1c30]`}
        >
          Correction
          <IconChevronRight size={16} className="text-[#434655]" />
        </Link>
        <Link
          href="/attendance/on-duty"
          className={`${ui.card} flex items-center justify-between px-3 py-3 text-sm font-semibold text-[#0b1c30]`}
        >
          On Duty
          <IconChevronRight size={16} className="text-[#434655]" />
        </Link>
        <Link
          href="/attendance/compoff"
          className={`${ui.card} col-span-2 flex items-center justify-between px-3 py-3 text-sm font-semibold text-[#0b1c30]`}
        >
          Comp Off request
          <IconChevronRight size={16} className="text-[#434655]" />
        </Link>
      </section>

      <ViewportFab
        href="/attendance/correction"
        aria-label="Request correction"
        className="bg-[#2563eb]"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M12 16V4" />
          <path d="M8 8l4-4 4 4" />
          <path d="M4 20h16" />
          <path d="M6 16h12v4H6z" />
        </svg>
      </ViewportFab>
    </div>
  );
}

function Stat({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="rounded-2xl bg-[#eff4ff] p-4">
      <p className="text-xs font-semibold text-[#434655]">{label}</p>
      <p className="mt-1 text-2xl font-bold" style={{ color }}>
        {value}
      </p>
    </div>
  );
}

function formatLongDate(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

function buildWeek(centerIso: string) {
  const center = new Date(`${centerIso}T12:00:00`);
  const day = (center.getDay() + 6) % 7;
  const monday = new Date(center);
  monday.setDate(center.getDate() - day);
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    return {
      iso,
      day: d.getDate(),
      dow: d.toLocaleDateString(undefined, { weekday: "short" }).slice(0, 3).toUpperCase(),
    };
  });
  const label = monday.toLocaleString(undefined, {
    month: "long",
    year: "numeric",
  });
  return { label, days };
}
