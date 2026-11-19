"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import {
  IconCalendar,
  IconFingerprint,
  IconSparkle,
  IconWallet,
} from "@/components/icons";
import { AiFab, AlertBox } from "@/components/ui";
import { ApiClientError } from "@/services/api-client";
import { essService } from "@/services/ess-service";
import type {
  EssAttendance,
  EssLeaveBalance,
  EssMe,
} from "@/types/api";
import * as ui from "@/theme/classes";
import {
  formatHmsSince,
  formatTime,
  greetingForNow,
  hoursBetween,
  todayLocalDate,
} from "@/utils/datetime";

const DAILY_GOAL_H = 8;

export default function HomePage() {
  const [me, setMe] = useState<EssMe | null>(null);
  const [today, setToday] = useState<EssAttendance | null>(null);
  const [balances, setBalances] = useState<EssLeaveBalance[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [timer, setTimer] = useState("00:00:00");
  const [greeting, setGreeting] = useState("Good day");

  useEffect(() => {
    setGreeting(greetingForNow());
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [meRes, attRes, balRes] = await Promise.all([
          essService.me(),
          essService.attendance(),
          essService.leaveBalances(),
        ]);
        if (cancelled) return;
        setMe(meRes.data);
        const todayStr = todayLocalDate();
        setToday(
          (attRes.data ?? []).find((row) => row.attendance_date === todayStr) ??
            null,
        );
        setBalances(balRes.data ?? []);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof ApiClientError ? err.message : "Failed to load home",
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const punchDone = Boolean(today?.check_out_at);
  const punchedIn = Boolean(today?.check_in_at) && !punchDone;

  useEffect(() => {
    const tick = () => {
      if (today?.check_in_at && !today.check_out_at) {
        setTimer(formatHmsSince(today.check_in_at));
      } else if (today?.check_in_at && today.check_out_at) {
        const secs =
          (new Date(today.check_out_at).getTime() -
            new Date(today.check_in_at).getTime()) /
          1000;
        const h = Math.floor(secs / 3600);
        const m = Math.floor((secs % 3600) / 60);
        const s = Math.floor(secs % 60);
        setTimer(
          `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`,
        );
      } else {
        setTimer("00:00:00");
      }
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [today?.check_in_at, today?.check_out_at]);

  const workedH =
    punchedIn && today?.check_in_at
      ? hoursBetween(today.check_in_at)
      : today?.total_hours != null
        ? Number(today.total_hours)
        : 0;
  const pct = Math.min(100, Math.round((workedH / DAILY_GOAL_H) * 100));

  const leavesLeft = balances.reduce(
    (sum, b) => sum + (Number(b.closing_balance) || 0),
    0,
  );

  const firstName = me?.display_name?.split(/\s+/)[0] ?? "there";

  return (
    <div className="space-y-8">
      <AppHeader name={me?.display_name} />

      {error ? <AlertBox>{error}</AlertBox> : null}

      <section className="space-y-3">
        <div>
          <h1 className="text-[1.75rem] font-bold leading-tight tracking-tight text-[#0b1c30]">
            {greeting}, {firstName}
          </h1>
          <p className="mt-1 text-base text-[#434655]">
            Ready for a productive day?
          </p>
        </div>
        {leavesLeft > 0 ? (
          <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-[#c3c6d7]/30 bg-[#eff4ff] px-4 py-2 animate-pulse-soft">
            <IconSparkle size={16} className="shrink-0 text-[#712ae2]" />
            <span className="truncate text-sm font-medium text-[#434655]">
              You have {leavesLeft % 1 === 0 ? leavesLeft : leavesLeft.toFixed(1)}{" "}
              leaves remaining. Planning a trip?
            </span>
          </div>
        ) : null}
      </section>

      <section className={`${ui.card} flex flex-col gap-4 p-4`}>
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#004ac6]">
              Current Status
            </span>
            <div className="flex items-center gap-2">
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  punchedIn
                    ? "animate-pulse bg-[#007d55]"
                    : punchDone
                      ? "bg-[#10B981]"
                      : "bg-[#c3c6d7]"
                }`}
              />
              <h2 className="text-xl font-semibold text-[#0b1c30]">
                {punchDone
                  ? "Day complete"
                  : punchedIn
                    ? "Checked In"
                    : "Not checked in"}
              </h2>
            </div>
            <p className="text-sm text-[#434655]">
              {today?.check_in_at
                ? `Since ${formatTime(today.check_in_at)}`
                : "Tap Check In when you arrive"}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold text-[#434655]">Working Hours</p>
            <p className="font-mono text-2xl font-bold tabular-nums text-[#004ac6]">
              {timer}
            </p>
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex justify-between text-xs font-semibold">
            <span className="text-[#434655]">Daily Goal: {DAILY_GOAL_H}h</span>
            <span className="text-[#0b1c30]">{pct}% Completed</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-[#d3e4fe]">
            <div
              className="h-full rounded-full bg-[#004ac6] transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="px-1 text-lg font-semibold text-[#0b1c30]">
          Quick Actions
        </h3>
        <div className="grid grid-cols-4 gap-2">
          <Link href="/attendance" className={ui.quick}>
            <span className={punchedIn ? ui.quickIconActive : ui.quickIcon}>
              <IconFingerprint size={26} />
            </span>
            <span className="text-[11px] font-semibold leading-tight text-[#434655]">
              {punchDone ? "Attendance" : punchedIn ? "Check Out" : "Check In"}
            </span>
          </Link>
          <Link href="/leave" className={ui.quick}>
            <span className={ui.quickIcon}>
              <IconCalendar size={26} />
            </span>
            <span className="text-[11px] font-semibold leading-tight text-[#434655]">
              Apply Leave
            </span>
          </Link>
          <Link href="/payslips" className={ui.quick}>
            <span className={ui.quickIcon}>
              <IconWallet size={26} />
            </span>
            <span className="text-[11px] font-semibold leading-tight text-[#434655]">
              Payslip
            </span>
          </Link>
          <Link href="/leave" className={ui.quick}>
            <span className={ui.quickIcon}>
              <svg
                width="26"
                height="26"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.9"
                strokeLinecap="round"
                aria-hidden
              >
                <path d="M3 10.5 12 3l9 7.5" />
                <path d="M5.5 9.5V20h13V9.5" />
                <path d="M9 14h6" />
              </svg>
            </span>
            <span className="text-[11px] font-semibold leading-tight text-[#434655]">
              WFH
            </span>
          </Link>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-end justify-between px-1">
          <h3 className="text-lg font-semibold text-[#0b1c30]">Upcoming Today</h3>
          <Link href="/announcements" className="text-sm font-medium text-[#004ac6]">
            View All
          </Link>
        </div>
        <div className="space-y-0">
          <TimelineItem
            active
            time={
              today?.check_in_at
                ? `${formatTime(today.check_in_at)} — now`
                : "When you check in"
            }
            title={
              punchedIn
                ? "Active work session"
                : punchDone
                  ? "Session complete"
                  : "Start your day"
            }
            subtitle={
              me?.designation
                ? `${me.designation} · Employee Portal`
                : "Office attendance"
            }
          />
          <TimelineItem
            time="Leave balances"
            title={`${leavesLeft % 1 === 0 ? leavesLeft : leavesLeft.toFixed(1)} days available`}
            subtitle="Tap Apply Leave to request time off"
            soft
          />
          <TimelineItem
            time="Payslips"
            title="Latest salary docs"
            subtitle="Open Salary tab for downloads"
            soft
            last
          />
        </div>
      </section>

      <AiFab href="/leave" />
    </div>
  );
}

function TimelineItem({
  time,
  title,
  subtitle,
  active,
  soft,
  last,
}: {
  time: string;
  title: string;
  subtitle: string;
  active?: boolean;
  soft?: boolean;
  last?: boolean;
}) {
  return (
    <div className="relative flex gap-4">
      <div className="flex flex-col items-center">
        <div
          className={`h-3 w-3 rounded-full ${
            active
              ? "bg-[#004ac6] ring-4 ring-[#dbe1ff]"
              : "bg-[#c3c6d7]"
          }`}
        />
        {!last ? (
          <div className="mt-1 w-0.5 flex-1 bg-[#c3c6d7]/40" />
        ) : null}
      </div>
      <div className={last ? "pb-0" : "pb-6"}>
        <p
          className={`mb-1 text-xs font-semibold ${
            active ? "text-[#004ac6]" : "text-[#434655]"
          }`}
        >
          {time}
        </p>
        <div
          className={`w-full rounded-2xl border p-4 ${
            soft
              ? "border-[#c3c6d7]/15 bg-[#eff4ff] opacity-90"
              : "border-[#c3c6d7]/25 bg-white/80 shadow-sm"
          }`}
        >
          <h4 className="text-base font-semibold text-[#0b1c30]">{title}</h4>
          <p className="mt-1 text-sm text-[#434655]">{subtitle}</p>
        </div>
      </div>
    </div>
  );
}
