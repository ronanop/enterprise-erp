"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AttendancePunchSheet } from "@/components/attendance-punch-sheet";
import { AppHeader } from "@/components/app-header";
import {
  IconAlert,
  IconCheck,
  IconChevronRight,
  IconClock,
  IconFingerprint,
  IconLocation,
  IconLogin,
  IconLogout,
} from "@/components/icons";
import { AlertBox, EmptyState } from "@/components/ui";
import { ApiClientError } from "@/services/api-client";
import { essService } from "@/services/ess-service";
import type { EssAttendance, EssAttendanceSummary, EssMe, EssPunchPolicy } from "@/types/api";
import * as ui from "@/theme/classes";
import {
  formatHours,
  formatHoursLabel,
  formatHmsSince,
  formatTime,
  greetingForNow,
  hoursBetween,
  todayLocalDate,
} from "@/utils/datetime";

const DAILY_GOAL_H = 8;

export default function AttendancePage() {
  const [me, setMe] = useState<EssMe | null>(null);
  const [rows, setRows] = useState<EssAttendance[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [todayStr, setTodayStr] = useState<string | null>(null);
  const [workedHours, setWorkedHours] = useState(0);
  const [timer, setTimer] = useState("00:00:00");
  const [showSuccess, setShowSuccess] = useState(false);
  const [greeting, setGreeting] = useState("Good day");
  const [summary, setSummary] = useState<EssAttendanceSummary | null>(null);
  const [punchPolicy, setPunchPolicy] = useState<EssPunchPolicy | null>(null);
  const [punchSheet, setPunchSheet] = useState<"in" | "out" | null>(null);

  async function refresh() {
    const monthKey = (todayStr ?? todayLocalDate()).slice(0, 7);
    const [att, meRes, sumRes, polRes] = await Promise.all([
      essService.attendance(),
      essService.me(),
      essService.attendanceSummary(monthKey),
      essService.punchPolicy(),
    ]);
    setRows(att.data ?? []);
    setMe(meRes.data);
    setSummary(sumRes.data);
    setPunchPolicy(polRes.data);
  }

  useEffect(() => {
    setTodayStr(todayLocalDate());
    setGreeting(greetingForNow());
    refresh().catch((err) =>
      setError(
        err instanceof ApiClientError ? err.message : "Failed to load attendance",
      ),
    );
  }, []);

  const today = todayStr
    ? rows.find((row) => row.attendance_date === todayStr)
    : undefined;
  const done = Boolean(today?.check_out_at);
  const punchedIn = Boolean(today?.check_in_at);
  const isOut = punchedIn && !done;

  useEffect(() => {
    const tick = () => {
      if (today?.check_in_at && !today.check_out_at) {
        setWorkedHours(hoursBetween(today.check_in_at));
        setTimer(formatHmsSince(today.check_in_at));
      } else if (today?.total_hours != null) {
        setWorkedHours(Number(today.total_hours));
        setTimer(formatHours(today.total_hours) + ":00");
      } else {
        setWorkedHours(0);
        setTimer("00:00:00");
      }
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [today?.check_in_at, today?.check_out_at, today?.total_hours]);

  async function runPunch(kind: "in" | "out", imageBase64: string | null) {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const res = await essService.punch({ image_base64: imageBase64 });
      const action = res.data?.action;
      const hours = res.data?.attendance?.total_hours;
      if (action === "check_in") {
        setMessage("Checked in successfully");
        setShowSuccess(true);
      } else {
        setMessage(
          hours != null
            ? `Checked out · total ${formatHoursLabel(hours)}`
            : "Checked out successfully",
        );
      }
      setPunchSheet(null);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Punch failed");
    } finally {
      setLoading(false);
    }
  }

  function onPunch(kind: "in" | "out") {
    if (kind === "in" && punchedIn) return;
    if (kind === "out" && (!punchedIn || done)) return;
    setPunchSheet(kind);
  }

  const ringPct = Math.min(100, (workedHours / DAILY_GOAL_H) * 100);
  const lateDays = summary?.late_days ?? 0;
  const overtimeH = (summary?.total_overtime_minutes ?? 0) / 60;
  const firstName = me?.display_name?.split(/\s+/)[0] ?? "there";
  const recent = rows.slice(0, 5);
  const calendar = useMemo(() => buildMonthGrid(todayStr), [todayStr]);

  if (showSuccess && today?.check_in_at && !today.check_out_at) {
    return (
      <CheckInSuccess
        name={me?.display_name}
        checkInAt={today.check_in_at}
        timer={timer}
        onContinue={() => setShowSuccess(false)}
      />
    );
  }

  return (
    <div className="space-y-6">
      <AppHeader title="Attendance" name={me?.display_name} />

      <div className="flex justify-end gap-3">
        <Link href="/attendance/wfh" className="text-sm font-semibold text-[#004ac6]">
          WFH
        </Link>
        <Link
          href="/attendance/history"
          className="text-sm font-semibold text-[#004ac6]"
        >
          History
        </Link>
      </div>

      <section className={`${ui.card} flex flex-col items-center gap-5 p-6`}>
        <Ring pct={ringPct} label={formatHours(workedHours)} />
        <div className="w-full space-y-2 text-center">
          <div className="flex flex-wrap items-center justify-center gap-2">
            <h2 className="text-xl font-bold text-[#0b1c30]">
              {greeting}, {firstName}
            </h2>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2 text-sm text-[#434655]">
            <span className="inline-flex items-center gap-1">
              <IconLocation size={14} className="text-[#004ac6]" />
              HQ Office
            </span>
            {punchedIn ? (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-800">
                Verified
              </span>
            ) : null}
          </div>
        </div>

        <div className="grid w-full grid-cols-2 gap-3">
          <button
            type="button"
            className={`${ui.btn} w-full !py-3`}
            onClick={() => onPunch("in")}
            disabled={loading || punchedIn}
          >
            <IconLogin size={18} />
            Check In
          </button>
          <button
            type="button"
            className={`${ui.btnPunchOut} w-full !py-3`}
            onClick={() => onPunch("out")}
            disabled={loading || !isOut}
          >
            <IconLogout size={18} />
            Check Out
          </button>
        </div>

        {error ? <AlertBox onLight>{error}</AlertBox> : null}
        {message && !showSuccess ? (
          <AlertBox tone="success" onLight>
            {message}
          </AlertBox>
        ) : null}
      </section>

      <div className="grid grid-cols-2 gap-3">
        <div className={`${ui.card} p-4`}>
          <div className="flex items-center justify-between">
            <span className="text-[#712ae2]">
              <IconClock size={20} />
            </span>
            {overtimeH > 0 ? (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                +{Math.round((overtimeH / DAILY_GOAL_H) * 100)}%
              </span>
            ) : null}
          </div>
          <p className="mt-2 text-sm text-[#434655]">Overtime</p>
          <p className="text-2xl font-bold text-[#0b1c30]">
            {overtimeH > 0 ? `${overtimeH.toFixed(1)}h` : "0h"}
          </p>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#eaddff]">
            <div
              className="h-full rounded-full bg-[#712ae2]"
              style={{ width: `${Math.min(100, overtimeH * 20)}%` }}
            />
          </div>
        </div>
        <div className={`${ui.card} p-4`}>
          <div className="flex items-center justify-between">
            <span className="text-[#ba1a1a]">
              <IconAlert size={20} />
            </span>
          </div>
          <p className="mt-2 text-sm text-[#434655]">Late Days</p>
          <p className="text-2xl font-bold text-[#0b1c30]">{lateDays}</p>
          <p className="text-xs font-medium text-[#10B981]">
            {lateDays === 0 ? "Perfect" : "This month"}
          </p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#d3e4fe]">
            <div
              className="h-full rounded-full bg-[#2563eb]"
              style={{ width: lateDays === 0 ? "100%" : "40%" }}
            />
          </div>
        </div>
      </div>

      <section className={`${ui.card} overflow-hidden p-5`}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-semibold text-[#0b1c30]">{calendar.label}</h3>
          <span className="text-xs text-[#434655]">This month</span>
        </div>
        <div className="mb-2 grid grid-cols-7 gap-1 text-center text-[10px] font-bold uppercase text-[#434655]">
          {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((d) => (
            <span key={d}>{d}</span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {calendar.cells.map((cell, i) => {
            const row = cell.iso
              ? rows.find((r) => r.attendance_date === cell.iso)
              : undefined;
            const isToday = cell.iso === todayStr;
            const st = (row?.attendance_status ?? "").toLowerCase();
            const dotColor =
              st === "late"
                ? "bg-[#ba1a1a]"
                : st === "work_from_home"
                  ? "bg-[#712ae2]"
                  : st === "absent"
                    ? "bg-[#c3c6d7]"
                    : row?.check_in_at
                      ? "bg-[#10B981]"
                      : null;
            return (
              <div
                key={i}
                className={`relative flex h-9 flex-col items-center justify-center rounded-full text-sm ${
                  isToday
                    ? "bg-[#2563eb] font-bold text-white"
                    : cell.day
                      ? "text-[#0b1c30]"
                      : ""
                }`}
              >
                {cell.day || ""}
                {dotColor && !isToday ? (
                  <span className={`absolute bottom-0.5 h-1 w-1 rounded-full ${dotColor}`} />
                ) : null}
                {isToday ? (
                  <span className="absolute bottom-1 h-1 w-1 rounded-full bg-white" />
                ) : null}
              </div>
            );
          })}
        </div>
        <div className="mt-3 flex gap-4 text-xs text-[#434655]">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[#10B981]" /> Present
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[#712ae2]" /> WFH
          </span>
        </div>
      </section>

      <AttendancePunchSheet
        open={punchSheet !== null}
        kind={punchSheet ?? "in"}
        policy={punchPolicy}
        loading={loading}
        onClose={() => setPunchSheet(null)}
        onConfirm={(img) => void runPunch(punchSheet ?? "in", img)}
      />

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-[#0b1c30]">Recent Activity</h3>
        {recent.length === 0 ? (
          <EmptyState
            title="No attendance yet"
            description="Your punches will show up here."
            icon={<IconFingerprint size={20} />}
          />
        ) : (
          <ul className="space-y-2">
            {recent.map((row) => (
              <li
                key={row.id}
                className={`${ui.card} flex items-center justify-between gap-3 p-4`}
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#eff4ff] text-[#434655]">
                    <IconClock size={18} />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-[#0b1c30]">
                      Clock In — Office
                    </p>
                    <p className="text-xs text-[#434655]">
                      {row.attendance_date}, {formatTime(row.check_in_at)}
                    </p>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#10B981]">
                  Verified <IconChevronRight size={14} className="text-[#c3c6d7]" />
                </span>
              </li>
            ))}
          </ul>
        )}
        <Link
          href="/attendance/history"
          className="block py-2 text-center text-sm font-semibold text-[#004ac6]"
        >
          View Full Attendance Report
        </Link>
      </section>
    </div>
  );
}

function Ring({ pct, label }: { pct: number; label: string }) {
  const size = 160;
  const r = 68;
  const c = 2 * Math.PI * r;
  const offset = c - (Math.max(0, Math.min(100, pct)) / 100) * c;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="#e5eeff"
          strokeWidth="10"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="#2563eb"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          className="transition-all duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <p className="text-3xl font-bold tabular-nums text-[#0b1c30]">{label}</p>
        <p className="text-[10px] font-bold uppercase tracking-wider text-[#434655]">
          Hrs Worked
        </p>
      </div>
    </div>
  );
}

function CheckInSuccess({
  name,
  checkInAt,
  timer,
  onContinue,
}: {
  name?: string;
  checkInAt: string;
  timer: string;
  onContinue: () => void;
}) {
  return (
    <div className="flex min-h-[70dvh] flex-col">
      <AppHeader name={name} />
      <div className="flex flex-1 flex-col items-center justify-center px-2 py-8">
        <div className="relative mb-8">
          <div className="absolute inset-0 rounded-full bg-[#10B981]/20 blur-[50px]" />
          <div className="success-glow relative flex h-32 w-32 items-center justify-center rounded-full bg-[#10B981] text-white shadow-2xl">
            <IconCheck size={64} />
          </div>
        </div>
        <h1 className="mb-2 text-center text-[1.75rem] font-bold tracking-tight text-[#0b1c30]">
          Check-In Successful!
        </h1>
        <p className="mb-8 max-w-xs text-center text-base text-[#434655]">
          Great to see you today. You are now officially clocked in.
        </p>

        <div className="mb-4 grid w-full gap-3">
          <div className={`${ui.card} flex items-center gap-4 p-4`}>
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#dce9ff] text-[#004ac6]">
              <IconLocation size={22} />
            </span>
            <div>
              <p className="text-xs font-semibold text-[#434655]">
                Location Verified
              </p>
              <p className="text-lg font-semibold text-[#0b1c30]">HQ Office</p>
            </div>
          </div>
          <div className={`${ui.card} flex items-center gap-4 p-4`}>
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#dce9ff] text-[#004ac6]">
              <IconClock size={22} />
            </span>
            <div>
              <p className="text-xs font-semibold text-[#434655]">Arrival Time</p>
              <p className="text-lg font-semibold text-[#0b1c30]">
                {formatTime(checkInAt)}
              </p>
            </div>
          </div>
          <div
            className={`${ui.card} relative overflow-hidden border-[#004ac6]/10 bg-[#2563eb]/5 p-4`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 animate-pulse rounded-full bg-[#10B981]" />
                <p className="text-sm font-semibold text-[#0b1c30]">
                  Active Session
                </p>
              </div>
              <p className="font-mono text-2xl font-bold tabular-nums text-[#004ac6]">
                {timer}
              </p>
            </div>
            <div className="absolute bottom-0 left-0 h-1 w-full bg-[#004ac6]/20">
              <div className="h-full w-1/3 rounded-r-full bg-[#004ac6]" />
            </div>
          </div>
        </div>

        <button type="button" className={`${ui.btn} mt-4 w-full`} onClick={onContinue}>
          View Today&apos;s Schedule
          <IconChevronRight />
        </button>
      </div>
    </div>
  );
}

function buildMonthGrid(todayIso: string | null) {
  const base = todayIso ? new Date(`${todayIso}T12:00:00`) : new Date();
  const year = base.getFullYear();
  const month = base.getMonth();
  const label = base.toLocaleString(undefined, {
    month: "long",
    year: "numeric",
  });
  const first = new Date(year, month, 1);
  const startPad = (first.getDay() + 6) % 7; // Monday-first
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: { day: number | null; iso: string | null }[] = [];
  for (let i = 0; i < startPad; i++) cells.push({ day: null, iso: null });
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    cells.push({ day: d, iso });
  }
  while (cells.length % 7 !== 0) cells.push({ day: null, iso: null });
  return { label, cells };
}
