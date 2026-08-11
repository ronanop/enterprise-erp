"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import {
  IconCalendar,
  IconClock,
  IconFingerprint,
  IconHelp,
  IconHome,
  IconLocation,
  IconWallet,
} from "@/components/icons";
import { AlertBox } from "@/components/ui";
import { useEssMe } from "@/context/ess-me-context";
import { ApiClientError } from "@/services/api-client";
import { essService } from "@/services/ess-service";
import type { EssAttendance } from "@/types/api";
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
  const { me, loading: meLoading } = useEssMe();
  const [today, setToday] = useState<EssAttendance | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [timer, setTimer] = useState("00:00:00");
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const greeting = greetingForNow(now);

  useEffect(() => {
    let cancelled = false;

    if (meLoading || !me) {
      return () => {
        cancelled = true;
      };
    }

    (async () => {
      try {
        const attRes = await essService.attendance();
        if (cancelled) return;
        const todayStr = todayLocalDate();
        setToday(
          (attRes.data ?? []).find((row) => row.attendance_date === todayStr) ??
            null,
        );
        setError(null);
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
  }, [meLoading, me?.employee_id ?? ""]);

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
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-[#434655]">
            <span>
              {now.toLocaleDateString("en-IN", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </span>
            <span aria-hidden>·</span>
            <span className="font-mono tabular-nums">
              {now.toLocaleTimeString("en-IN", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}
            </span>
          </div>
        </div>
        {me?.can_approve_team_leave ? (
          <Link
            href="/approvals"
            className={`${ui.card} flex items-center justify-between gap-3 p-4 transition active:scale-[0.99]`}
          >
            <div>
              <p className="font-semibold text-[#0b1c30]">Team approvals</p>
              <p className="text-sm text-[#434655]">
                Leave, on-duty, attendance corrections
              </p>
            </div>
            {(me.pending_approvals_count ?? 0) > 0 ? (
              <span className="flex h-8 min-w-8 items-center justify-center rounded-full bg-[#ba1a1a] px-2 text-sm font-bold text-white">
                {me.pending_approvals_count! > 99 ? "99+" : me.pending_approvals_count}
              </span>
            ) : (
              <span className="text-sm font-semibold text-[#004ac6]">Open</span>
            )}
          </Link>
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

      <section className="space-y-3">
        <h3 className="px-1 text-lg font-semibold text-[#0b1c30]">
          Quick Actions
        </h3>
        <div className="grid grid-cols-4 gap-2.5">
          <Link
            href="/attendance"
            className={`${ui.quickPremium} ${ui.fadeUp}`}
            style={{ animationDelay: "0ms" }}
          >
            <span
              className={
                punchDone
                  ? ui.quickIconPremium
                  : ui.quickIconPremiumPrimary
              }
            >
              <IconFingerprint size={28} />
            </span>
            <span className={ui.quickLabel}>
              {punchDone ? "Attendance" : punchedIn ? "Check Out" : "Check In"}
            </span>
          </Link>
          <Link
            href="/leave"
            className={`${ui.quickPremium} ${ui.fadeUp}`}
            style={{ animationDelay: "40ms" }}
          >
            <span className={ui.quickIconPremiumViolet}>
              <IconCalendar size={28} />
            </span>
            <span className={ui.quickLabel}>Apply Leave</span>
          </Link>
          <Link
            href="/payslips"
            className={`${ui.quickPremium} ${ui.fadeUp}`}
            style={{ animationDelay: "80ms" }}
          >
            <span className={ui.quickIconPremiumEmerald}>
              <IconWallet size={28} />
            </span>
            <span className={ui.quickLabel}>Payslip</span>
          </Link>
          <Link
            href="/attendance/correction"
            className={`${ui.quickPremium} ${ui.fadeUp}`}
            style={{ animationDelay: "120ms" }}
          >
            <span className={ui.quickIconPremiumAmber}>
              <IconClock size={28} />
            </span>
            <span className={ui.quickLabel}>Correction</span>
          </Link>
        </div>
        <div className="grid grid-cols-4 gap-2.5">
          <Link
            href="/attendance/wfh"
            className={`${ui.quickPremium} ${ui.fadeUp}`}
            style={{ animationDelay: "160ms" }}
          >
            <span className={ui.quickIconPremium}>
              <IconHome size={28} />
            </span>
            <span className={ui.quickLabel}>WFH</span>
          </Link>
          <Link
            href="/rooms"
            className={`${ui.quickPremium} ${ui.fadeUp}`}
            style={{ animationDelay: "200ms" }}
          >
            <span className={ui.quickIconPremiumViolet}>
              <IconLocation size={28} />
            </span>
            <span className={ui.quickLabel}>Meeting rooms</span>
          </Link>
          <Link
            href="/support"
            className={`${ui.quickPremium} ${ui.fadeUp}`}
            style={{ animationDelay: "240ms" }}
          >
            <span className={ui.quickIconPremiumAmber}>
              <IconHelp size={28} />
            </span>
            <span className={ui.quickLabel}>Help</span>
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
            time="Leave"
            title="Balances & requests"
            subtitle="Open Leave for balances and new applications"
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
