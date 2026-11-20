"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  IconBriefcase,
  IconCalendar,
  IconCheck,
  IconChevronRight,
  IconClock,
  IconDocument,
  IconGrid,
  IconHouse,
  IconLayers,
  IconLocation,
  IconMeetingRoom,
  IconPlane,
  IconPolicy,
  IconSun,
  IconUser,
  IconUsers,
} from "@/components/icons";
import { CacheBrandLogo } from "@/components/cache-brand-logo";
import { NotificationBellLink } from "@/components/notification-bell-link";
import { AlertBox, Avatar } from "@/components/ui";
import { useEssMe } from "@/context/ess-me-context";
import { DAILY_QUOTES, quoteIndexForDate } from "@/data/daily-quotes";
import {
  fetchLiveLocationLabel,
  type WorkLocationFence,
} from "@/lib/live-location";
import { ApiClientError } from "@/services/api-client";
import { essService } from "@/services/ess-service";
import type {
  EssApprovalItem,
  EssAttendance,
  EssHolidayCalendar,
  EssMeetingBooking,
} from "@/types/api";
import {
  formatTime,
  greetingForNow,
  hoursBetween,
  todayLocalDate,
} from "@/utils/datetime";

type QuickAction = {
  href: string;
  label: string;
  Icon: typeof IconCalendar;
  /** Soft pastel tile wash */
  tile: string;
  /** Soft matching border */
  border: string;
  /** Glow center color (radial blur) */
  glow: string;
  fg: string;
};

const QUICK_ACTIONS: QuickAction[] = [
  {
    href: "/leave?apply=1",
    label: "Apply Leave",
    Icon: IconCalendar,
    tile: "bg-[#F6FCF8]",
    border: "border-[#B7E4C7]",
    glow: "#BBF7D0",
    fg: "text-[#16A34A]",
  },
  {
    href: "/attendance/wfh",
    label: "WFH",
    Icon: IconHouse,
    tile: "bg-[#F9F7FF]",
    border: "border-[#D4C8F8]",
    glow: "#DDD6FE",
    fg: "text-[#7C3AED]",
  },
  {
    href: "/attendance/on-duty",
    label: "On Duty",
    Icon: IconBriefcase,
    tile: "bg-[#FFF9F4]",
    border: "border-[#F5CFA8]",
    glow: "#FED7AA",
    fg: "text-[#EA580C]",
  },
  {
    href: "/attendance/correction",
    label: "Correction",
    Icon: IconClock,
    tile: "bg-[#FFF7F8]",
    border: "border-[#F5B8C2]",
    glow: "#FECDD3",
    fg: "text-[#E11D48]",
  },
  {
    href: "/payslips",
    label: "Payslip",
    Icon: IconDocument,
    tile: "bg-[#F6F9FF]",
    border: "border-[#B8CFF5]",
    glow: "#BFDBFE",
    fg: "text-[#2563EB]",
  },
  {
    href: "/attendance/compoff",
    label: "Comp Off",
    Icon: IconLayers,
    tile: "bg-[#F8F6FF]",
    border: "border-[#D4C8F8]",
    glow: "#DDD6FE",
    fg: "text-[#7C3AED]",
  },
  {
    href: "/rooms",
    label: "Meeting Rooms",
    Icon: IconMeetingRoom,
    tile: "bg-[#F5FAFD]",
    border: "border-[#A8D5F0]",
    glow: "#BAE6FD",
    fg: "text-[#0284C7]",
  },
];

const MORE_TOGGLE_ACTION: QuickAction = {
  href: "#more",
  label: "More",
  Icon: IconGrid,
  tile: "bg-[#F5FBFA]",
  border: "border-[#A7E4D8]",
  glow: "#99F6E4",
  fg: "text-[#0D9488]",
};

/** Extra tiles revealed after tapping the 8th "More" slot (Less stays last / right). */
const MORE_ACTIONS: QuickAction[] = [
  {
    href: "/attendance/on-tour",
    label: "On Tour",
    Icon: IconPlane,
    tile: "bg-[#FFF9F4]",
    border: "border-[#F5CFA8]",
    glow: "#FED7AA",
    fg: "text-[#EA580C]",
  },
  {
    href: "/compliance",
    label: "Policy",
    Icon: IconPolicy,
    tile: "bg-[#F8F6FF]",
    border: "border-[#D4C8F8]",
    glow: "#DDD6FE",
    fg: "text-[#7C3AED]",
  },
];

const MANAGER_MORE_ACTIONS: QuickAction[] = [
  {
    href: "/team",
    label: "Team",
    Icon: IconUsers,
    tile: "bg-[#EEF2FF]",
    border: "border-[#C7D2FE]",
    glow: "#BFDBFE",
    fg: "text-[#004ac6]",
  },
];

const MANAGER_QUICK_ACTION: QuickAction = {
  href: "/approvals",
  label: "Approvals",
  Icon: IconCheck,
  tile: "bg-[#EEF2FF]",
  border: "border-[#C7D2FE]",
  glow: "#BFDBFE",
  fg: "text-[#004ac6]",
};

/** Collapsed grid is always 8 tiles: 7 actions + More. */
const PRIMARY_ACTION_SLOTS = 7;

function formatWorkingDuration(hours: number): string {
  if (!Number.isFinite(hours) || hours <= 0) return "00h 00m";
  const totalMinutes = Math.round(hours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, "0")}h ${String(m).padStart(2, "0")}m`;
}

function formatShiftDay(d: Date): string {
  return d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function todayHolidayName(calendars: EssHolidayCalendar[]): string | null {
  const today = todayLocalDate();
  for (const cal of calendars) {
    const rows = Array.isArray(cal.holidays_json) ? cal.holidays_json : [];
    for (const row of rows) {
      if (!row || typeof row !== "object") continue;
      const date = typeof row.date === "string" ? row.date.slice(0, 10) : "";
      const name = typeof row.name === "string" ? row.name : "";
      if (date === today && name) return name;
    }
  }
  return null;
}

function formatBookingTime12(t: string | null | undefined): string {
  if (!t) return "";
  const raw = String(t).slice(0, 5);
  const [hh, mm] = raw.split(":").map(Number);
  if (Number.isNaN(hh)) return raw;
  const period = hh >= 12 ? "PM" : "AM";
  const h12 = hh % 12 || 12;
  return `${String(h12).padStart(2, "0")}:${String(mm || 0).padStart(2, "0")} ${period}`;
}

function formatBookingTimeLabel(b: EssMeetingBooking): string {
  const start = formatBookingTime12(b.start_time);
  const end = formatBookingTime12(b.end_time);
  if (start && end) return start;
  if (start) return start;
  return "All Day";
}

function isActiveBooking(status: string): boolean {
  const s = status.toLowerCase();
  return s !== "cancelled" && s !== "rejected";
}

const APPROVAL_CATEGORY_LABEL: Record<EssApprovalItem["category"], string> = {
  leave: "Leave",
  on_duty: "On duty",
  compoff: "Comp off",
  attendance_correction: "Regularization",
  wfh: "WFH",
};

export default function HomePage() {
  const { me, loading: meLoading } = useEssMe();
  const [today, setToday] = useState<EssAttendance | null>(null);
  const [holidayName, setHolidayName] = useState<string | null>(null);
  const [todayMeetings, setTodayMeetings] = useState<EssMeetingBooking[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [workedH, setWorkedH] = useState(0);
  const [quoteIndex, setQuoteIndex] = useState(() => quoteIndexForDate());
  const [liveLocation, setLiveLocation] = useState<string | null>(null);
  const [liveLocationLoading, setLiveLocationLoading] = useState(true);
  const [teamApprovals, setTeamApprovals] = useState<EssApprovalItem[]>([]);
  const [moreOpen, setMoreOpen] = useState(false);
  const isManager = Boolean(me?.can_approve_team_leave || me?.is_manager);

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLiveLocationLoading(true);
    (async () => {
      let workLocations: WorkLocationFence[] = [];
      let homeOfficeName: string | null = null;
      try {
        const pol = await essService.punchPolicy();
        workLocations = pol.data?.work_locations ?? [];
        homeOfficeName = pol.data?.home_office_name ?? null;
        // Show HRMS office / branch name immediately (e.g. Head Office) while GPS resolves.
        const quick =
          homeOfficeName?.trim() ||
          workLocations.find((loc) => loc.location_name?.trim())?.location_name ||
          null;
        if (!cancelled && quick) {
          setLiveLocation(quick);
          setLiveLocationLoading(false);
        }
      } catch {
        workLocations = [];
        homeOfficeName = null;
      }
      const label = await fetchLiveLocationLabel({
        workLocations,
        homeOfficeName,
      });
      if (cancelled) return;
      setLiveLocation(label);
      setLiveLocationLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (meLoading || !me) {
      return () => {
        cancelled = true;
      };
    }

    (async () => {
      try {
        const [attRes, holidayRes, bookingRes] = await Promise.all([
          essService.attendance(),
          essService.holidays().catch(() => ({ data: [] as EssHolidayCalendar[] })),
          essService.meetingBookings().catch(() => ({ data: [] as EssMeetingBooking[] })),
        ]);
        if (cancelled) return;
        const todayStr = todayLocalDate();
        setToday(
          (attRes.data ?? []).find(
            (row) => String(row.attendance_date).slice(0, 10) === todayStr,
          ) ?? null,
        );
        setHolidayName(todayHolidayName(holidayRes.data ?? []));
        const meetings = (bookingRes.data ?? [])
          .filter(
            (b) =>
              String(b.request_date).slice(0, 10) === todayStr &&
              isActiveBooking(b.status),
          )
          .sort((a, b) =>
            (a.start_time || "").localeCompare(b.start_time || ""),
          );
        setTodayMeetings(meetings);
        setError(null);
      } catch (err) {
        if (!cancelled) {
          const message =
            err instanceof ApiClientError ? err.message : "Failed to load home";
          // Stale sessions can still raise this until the user signs in again.
          if (/company scope mismatch/i.test(message)) {
            setError(null);
            setToday(null);
            setTodayMeetings([]);
          } else {
            setError(message);
          }
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [meLoading, me?.employee_id ?? ""]);

  useEffect(() => {
    if (meLoading || !me?.can_approve_team_leave) {
      setTeamApprovals([]);
      return;
    }
    let cancelled = false;
    essService
      .approvals()
      .then((res) => {
        if (cancelled) return;
        setTeamApprovals(
          (res.data ?? []).filter((row) => row.category !== "compoff"),
        );
      })
      .catch(() => {
        if (!cancelled) setTeamApprovals([]);
      });
    return () => {
      cancelled = true;
    };
  }, [meLoading, me?.can_approve_team_leave, me?.employee_id ?? ""]);

  const punchDone = Boolean(today?.check_out_at);
  const punchedIn = Boolean(today?.check_in_at) && !punchDone;

  useEffect(() => {
    const tick = () => {
      if (today?.check_in_at && !today.check_out_at) {
        setWorkedH(hoursBetween(today.check_in_at));
      } else if (today?.check_in_at && today.check_out_at) {
        setWorkedH(
          hoursBetween(
            today.check_in_at,
            new Date(today.check_out_at).getTime(),
          ),
        );
      } else if (today?.total_hours != null) {
        setWorkedH(Number(today.total_hours) || 0);
      } else {
        setWorkedH(0);
      }
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [today?.check_in_at, today?.check_out_at, today?.total_hours]);

  const fullName = me?.display_name?.trim() || "there";
  const greeting = greetingForNow(now);
  const checkInLabel = today?.check_in_at ? formatTime(today.check_in_at) : "--:--";
  const checkOutLabel = today?.check_out_at
    ? formatTime(today.check_out_at)
    : "--:--";

  const progressPct = useMemo(() => {
    if (!punchedIn && !punchDone) return 0;
    if (punchDone) return 100;
    return Math.min(92, Math.max(18, Math.round((workedH / 8) * 100)));
  }, [punchedIn, punchDone, workedH]);

  const punchSource = (today?.source || "").toLowerCase();
  const machinePunch =
    punchSource === "biometric" || punchSource === "device";
  const statusLabel = punchDone
    ? "Day complete"
    : punchedIn
      ? machinePunch
        ? "Checked in (machine)"
        : "You're Working"
      : "Not checked in";

  const primaryHref = "/attendance";
  const primaryLabel = punchDone
    ? "View Attendance"
    : punchedIn
      ? "Check Out"
      : "Check In";

  const { primaryActions, moreActions } = useMemo(() => {
    // Prefer Approvals first for managers, then the shared employee actions.
    const candidates = isManager
      ? [
          MANAGER_QUICK_ACTION,
          ...QUICK_ACTIONS.filter((a) => a.href !== "/approvals"),
        ]
      : QUICK_ACTIONS;
    const primary = candidates.slice(0, PRIMARY_ACTION_SLOTS);
    const overflow = candidates.slice(PRIMARY_ACTION_SLOTS);
    const extras = [
      ...(isManager ? MANAGER_MORE_ACTIONS : []),
      ...MORE_ACTIONS,
      ...overflow,
    ].filter(
      (a, idx, arr) =>
        !primary.some((p) => p.href === a.href) &&
        arr.findIndex((x) => x.href === a.href) === idx,
    );
    return { primaryActions: primary, moreActions: extras };
  }, [isManager]);

  // One continuous grid: collapsed = 7 + More; expanded = 7 + extras + Less (Less last/right).
  const gridActions = moreOpen
    ? [...primaryActions, ...moreActions]
    : primaryActions;

  return (
    <div className="relative -mx-5 min-h-full overflow-x-hidden bg-[#F7FAFD] text-[#152238]">
      {/*
        STRUCTURAL HERO: tall image layer + dedicated content band.
        Attendance card is a SIBLING below this band so the building stays visible.
      */}
      <div className="relative isolate">
        {/*
          Full hero photo: sky left/top, small glass building lower-right
          (matches your screenshot — clear, not zoomed).
        */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 z-0 h-[300px] overflow-hidden sm:h-[320px]"
        >
          <Image
            src="/home/hero-building-v2.jpg"
            alt=""
            fill
            priority
            className="object-cover"
            sizes="(max-width: 512px) 100vw, 512px"
            style={{ objectPosition: "92% 72%" }}
          />
          {/* Text-side wash only — keep building crisp on the right */}
          <div className="absolute inset-y-0 left-0 w-[55%] bg-gradient-to-r from-[#F7FAFD] from-35% via-[#F7FAFD]/75 to-transparent" />
          {/* Light bottom blend under chips / into attendance */}
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent to-[#F7FAFD]" />
        </div>

        <div className="relative z-10 flex min-h-[250px] flex-col px-4 pb-6 pt-3 sm:px-5">
          <header className="mb-0 flex items-center justify-between gap-3">
            <CacheBrandLogo priority height={40} />
            <div className="flex shrink-0 items-center gap-1.5">
              <NotificationBellLink className="!h-10 !w-10 !rounded-full !border !border-white/70 !bg-white/75 !text-[#1A2B56] !shadow-[0_2px_8px_rgba(26,43,86,0.06)] !backdrop-blur-md" />
              <Link href="/profile" className="shrink-0" aria-label="Profile">
                <Avatar
                  name={me?.display_name ?? ""}
                  size="sm"
                  ring
                  photoUrl={me?.photo_url}
                />
              </Link>
            </div>
          </header>

          {error ? (
            <div className="mb-3 mt-5">
              <AlertBox>{error}</AlertBox>
            </div>
          ) : null}

          {/* Space under logo — matches reference breathing room */}
          <section className="mt-6">
            <div className="max-w-[85%]">
              <h1 className="text-[26px] font-bold leading-[1.15] tracking-[-0.01em] text-[#0B1C30]">
                <span className="block">{greeting},</span>
                <span className="block">
                  {fullName}{" "}
                  <span aria-hidden className="inline-block">
                    👋
                  </span>
                </span>
              </h1>
              <p className="mt-2 text-[13px] font-medium leading-snug text-[#64748B]">
                Here&apos;s your day at a glance.
              </p>
            </div>
          </section>

          <div className="mt-auto flex w-full items-end gap-1.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <InfoChip
              Icon={IconUser}
              label={me?.employee_code || "—"}
              strong
            />
            <InfoChip
              Icon={IconUser}
              label={me?.designation || "Employee"}
              strong
            />
            <InfoChip
              Icon={IconLocation}
              label={
                liveLocation ||
                (liveLocationLoading
                  ? "Locating…"
                  : me?.branch_name || me?.company_name || "Office")
              }
              filledIcon
              strong
            />
          </div>
        </div>
      </div>

      {/* Attendance overlaps lower fade of hero — building still clear above */}
      <div className="relative z-10 -mt-3 space-y-4 px-4 pb-8 sm:px-5">
        <section className="rounded-[18px] border border-[#E8EEF5] bg-white px-3.5 py-3.5 shadow-[0_8px_20px_rgba(26,43,86,0.07)]">
          <div className="flex items-center gap-1.5">
            <span
              className={`h-2 w-2 shrink-0 rounded-full ${
                punchedIn || punchDone ? "bg-[#12B76A]" : "bg-[#94A3B8]"
              } ${punchedIn ? "animate-pulse" : ""}`}
            />
            <p className="text-[14px] font-bold leading-none text-[#1A2B56]">
              {statusLabel}
            </p>
          </div>
          <div className="mt-2 flex items-center justify-between gap-3">
            <p className="text-[12px] font-medium text-[#64748B]">
              {formatShiftDay(now)}
            </p>
            <p className="shrink-0 text-right text-[11px] font-medium text-[#64748B]">
              Shift: 09:30 AM – 06:30 PM
            </p>
          </div>

          <div className="relative mt-4">
            <div className="relative flex h-7 items-center">
              <div className="absolute left-[8px] right-[8px] top-1/2 h-[4px] -translate-y-1/2 rounded-full bg-[#E8EDF5]" />
              <div
                className="absolute left-[8px] top-1/2 h-[4px] -translate-y-1/2 rounded-full bg-[#12B76A]"
                style={{
                  width: punchDone
                    ? "calc(100% - 16px)"
                    : punchedIn || today?.check_in_at
                      ? `calc((100% - 16px) * ${Math.min(Math.max(progressPct, 12), 50) / 100})`
                      : "0px",
                }}
              />

              <div className="relative z-[1] grid w-full grid-cols-3 items-center">
                <div className="flex justify-start">
                  <span
                    className={`flex h-4 w-4 items-center justify-center rounded-full ${
                      today?.check_in_at
                        ? "bg-[#12B76A]"
                        : "border-2 border-[#CBD5E1] bg-white"
                    }`}
                  >
                    {today?.check_in_at ? (
                      <span className="h-1 w-1 rounded-full bg-white" />
                    ) : null}
                  </span>
                </div>

                <div className="flex justify-center">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full border border-[#F6D98A] bg-[#FFF8E8] text-[#F59E0B]">
                    <IconSun size={14} />
                  </span>
                </div>

                <div className="flex justify-end">
                  <span
                    className={`flex h-4 w-4 items-center justify-center rounded-full ${
                      punchDone
                        ? "bg-[#12B76A]"
                        : "border-2 border-[#C8D0DC] bg-white"
                    }`}
                  >
                    {punchDone ? (
                      <span className="h-1 w-1 rounded-full bg-white" />
                    ) : null}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-2 grid grid-cols-3 items-start">
              <div className="text-left">
                <p
                  className={`text-[12px] font-bold tabular-nums ${
                    today?.check_in_at ? "text-[#1A2B56]" : "text-[#94A3B8]"
                  }`}
                >
                  {today?.check_in_at ? checkInLabel : "--:--"}
                </p>
                <p className="text-[11px] font-medium text-[#64748B]">
                  Check In
                </p>
              </div>
              <div className="text-center">
                <p className="text-[18px] font-bold leading-none tabular-nums text-[#1A2B56]">
                  {formatWorkingDuration(workedH)}
                </p>
                <p className="mt-0.5 text-[11px] font-medium text-[#64748B]">
                  Working
                </p>
              </div>
              <div className="text-right">
                <p
                  className={`text-[12px] font-bold tabular-nums ${
                    punchDone ? "text-[#1A2B56]" : "text-[#94A3B8]"
                  }`}
                >
                  {checkOutLabel}
                </p>
                <p className="text-[11px] font-medium text-[#64748B]">
                  Check Out
                </p>
              </div>
            </div>
          </div>

          <Link
            href={primaryHref}
            className="mt-3.5 inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-[12px] bg-[#1A2B56] px-4 text-[14px] font-semibold text-white shadow-[0_6px_14px_rgba(26,43,86,0.18)] transition active:scale-[0.99]"
          >
            {primaryLabel}
            <span aria-hidden className="text-[15px] leading-none">
              →
            </span>
          </Link>
        </section>

        {isManager ? (
          <section className="overflow-hidden rounded-[18px] border border-[#C7D2FE] bg-gradient-to-br from-[#EEF2FF] to-white shadow-[0_8px_20px_rgba(37,99,235,0.08)]">
            <div className="flex items-start justify-between gap-3 px-3.5 pb-2 pt-3.5">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#004ac6] text-white">
                    <IconCheck size={16} />
                  </span>
                  <div>
                    <p className="text-[15px] font-bold leading-tight text-[#1A2B56]">
                      Team Approvals
                    </p>
                    <p className="text-[12px] font-medium text-[#64748B]">
                      Requests from people who report to you
                    </p>
                  </div>
                </div>
              </div>
              <span className="shrink-0 rounded-full bg-[#004ac6] px-2.5 py-1 text-[11px] font-bold tabular-nums text-white">
                {me?.pending_approvals_count ?? teamApprovals.length}
              </span>
            </div>

            {teamApprovals.length === 0 ? (
              <p className="px-3.5 pb-3.5 text-[13px] font-medium text-[#64748B]">
                No pending team requests right now.
              </p>
            ) : (
              <ul className="divide-y divide-[#E2E8F0] border-t border-[#E2E8F0]">
                {teamApprovals.slice(0, 3).map((item) => (
                  <li key={`${item.category}:${item.id}`}>
                    <Link
                      href="/approvals"
                      className="flex items-center gap-3 px-3.5 py-3 transition active:bg-[#F8FAFC]"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-[#004ac6]">
                          {APPROVAL_CATEGORY_LABEL[item.category]}
                        </p>
                        <p className="truncate text-[13px] font-bold text-[#0b1c30]">
                          {item.display_name}
                        </p>
                        <p className="truncate text-[12px] text-[#64748B]">
                          {item.detail}
                        </p>
                      </div>
                      <IconChevronRight size={16} className="shrink-0 text-[#94A3B8]" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}

            <div className="border-t border-[#E2E8F0] px-3.5 py-3">
              <Link
                href="/approvals"
                className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-[12px] bg-[#004ac6] text-[13px] font-bold text-white transition active:scale-[0.99]"
              >
                Open team inbox
                <span aria-hidden>→</span>
              </Link>
            </div>
          </section>
        ) : null}

        {/* Daily quote — LOCKED: do not restyle */}
        <DailyQuoteBanner index={quoteIndex} onIndexChange={setQuoteIndex} />

        {/* Quick Actions — new tile system (not prior button classes) */}
        <section>
          <div className="mb-3">
            <h2 className="text-[17px] font-semibold text-[#1A2B56]">
              Quick Actions
            </h2>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {gridActions.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`qa-tile group flex flex-col items-center justify-center gap-1 rounded-[12px] border px-1 py-2 shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition active:scale-[0.96] active:brightness-[0.98] ${item.tile} ${item.border}`}
              >
                <span
                  className={`qa-icon relative flex h-8 w-8 shrink-0 items-center justify-center ${item.fg}`}
                >
                  <span
                    aria-hidden
                    className="pointer-events-none absolute left-1/2 top-1/2 size-[32px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-35 blur-[8px]"
                    style={{ backgroundColor: item.glow }}
                  />
                  <item.Icon size={26} filled className="relative z-[1]" />
                </span>
                <span className="qa-label max-w-full px-0.5 text-center text-[12px] font-semibold leading-snug tracking-tight text-[#1A2B56]">
                  {item.label}
                </span>
              </Link>
            ))}
            <button
              type="button"
              aria-expanded={moreOpen}
              onClick={() => setMoreOpen((o) => !o)}
              className={`qa-tile group flex flex-col items-center justify-center gap-1 rounded-[12px] border px-1 py-2 shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition active:scale-[0.96] active:brightness-[0.98] ${MORE_TOGGLE_ACTION.tile} ${MORE_TOGGLE_ACTION.border} ${
                moreOpen ? "ring-2 ring-[#0D9488]/35" : ""
              }`}
            >
              <span
                className={`qa-icon relative flex h-8 w-8 shrink-0 items-center justify-center ${MORE_TOGGLE_ACTION.fg}`}
              >
                <span
                  aria-hidden
                  className="pointer-events-none absolute left-1/2 top-1/2 size-[32px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-35 blur-[8px]"
                  style={{ backgroundColor: MORE_TOGGLE_ACTION.glow }}
                />
                <IconGrid
                  size={26}
                  filled
                  className="relative z-[1]"
                />
              </span>
              <span className="qa-label max-w-full px-0.5 text-center text-[12px] font-semibold leading-snug tracking-tight text-[#1A2B56]">
                {moreOpen ? "Less" : "More"}
              </span>
            </button>
          </div>
        </section>

        <section className="pb-1">
          <div className="mb-3">
            <h2 className="text-[17px] font-semibold text-[#1A2B56]">
              Upcoming Today
            </h2>
          </div>
          {todayMeetings.length === 0 && !holidayName ? (
            <div className="rounded-[16px] border border-[#E5EAF2] bg-white px-4 py-5 text-center text-[13px] text-[#64748B] shadow-[0_2px_8px_rgba(15,23,42,0.03)]">
              Nothing scheduled for today.
            </div>
          ) : (
            <div className="overflow-hidden rounded-[16px] border border-[#E5EAF2] bg-white shadow-[0_2px_8px_rgba(15,23,42,0.03)]">
              {todayMeetings.map((b, idx) => (
                <UpcomingRow
                  key={b.id}
                  href="/rooms"
                  tone="purple"
                  Icon={IconMeetingRoom}
                  title={b.title || "Meeting"}
                  subtitle={[b.room_name, b.status.replace(/_/g, " ")]
                    .filter(Boolean)
                    .join(" · ")}
                  time={formatBookingTimeLabel(b)}
                  divided={idx < todayMeetings.length - 1 || Boolean(holidayName)}
                />
              ))}
              {holidayName ? (
                <UpcomingRow
                  href="/leave/holidays"
                  tone="green"
                  Icon={IconPlane}
                  title="Company Holiday"
                  subtitle={holidayName}
                  time="All Day"
                />
              ) : null}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function DailyQuoteBanner({
  index,
  onIndexChange,
}: {
  index: number;
  onIndexChange: (next: number) => void;
}) {
  const touchX = useRef<number | null>(null);
  const paused = useRef(false);
  const quote = DAILY_QUOTES[index] ?? DAILY_QUOTES[0]!;

  function goNext() {
    onIndexChange((index + 1) % DAILY_QUOTES.length);
  }

  function goPrev() {
    onIndexChange((index - 1 + DAILY_QUOTES.length) % DAILY_QUOTES.length);
  }

  useEffect(() => {
    const id = window.setInterval(() => {
      if (paused.current) return;
      onIndexChange((index + 1) % DAILY_QUOTES.length);
    }, 5500);
    return () => window.clearInterval(id);
  }, [index, onIndexChange]);

  return (
    <section className="mb-5">
      <div
        role="group"
        aria-roledescription="carousel"
        aria-label="Daily motivation quote"
        className="relative flex min-h-[88px] w-full flex-row items-center gap-2 overflow-hidden rounded-[20px] bg-gradient-to-r from-[#EDE7FF] via-[#F3EEFF] to-[#E8F1FF] px-4 py-3.5 shadow-[0_8px_20px_rgba(123,97,255,0.12)]"
        onMouseEnter={() => {
          paused.current = true;
        }}
        onMouseLeave={() => {
          paused.current = false;
        }}
        onTouchStart={(e) => {
          paused.current = true;
          touchX.current = e.changedTouches[0]?.clientX ?? null;
        }}
        onTouchEnd={(e) => {
          const start = touchX.current;
          const end = e.changedTouches[0]?.clientX;
          touchX.current = null;
          window.setTimeout(() => {
            paused.current = false;
          }, 4000);
          if (start == null || end == null) return;
          const delta = end - start;
          if (Math.abs(delta) < 40) return;
          if (delta < 0) goNext();
          else goPrev();
        }}
      >
        <button
          type="button"
          className="min-w-0 flex-1 text-left"
          onClick={goNext}
          aria-label="Next quote"
        >
          <p
            key={`${index}-title`}
            className="animate-[fade-up_0.35s_ease] text-[15px] font-bold leading-snug text-[#1A2B56]"
          >
            {quote.title}
          </p>
          <p
            key={`${index}-sub`}
            className="mt-1 animate-[fade-up_0.35s_ease] text-xs leading-snug text-[#6B7280]"
          >
            {quote.subtitle}
          </p>
          <div className="mt-2.5 flex items-center gap-1.5" aria-hidden>
            {DAILY_QUOTES.map((_, i) => (
              <span
                key={i}
                className={
                  i === index
                    ? "h-1.5 w-4 rounded-full bg-[#7B61FF]"
                    : "h-1.5 w-1.5 rounded-full bg-[#C4B5FD]"
                }
              />
            ))}
          </div>
        </button>

        <div className="relative h-[68px] w-[72px] shrink-0 overflow-hidden rounded-xl">
          <Image
            key={quote.image}
            src={quote.image}
            alt=""
            fill
            className="animate-[fade-up_0.35s_ease] object-cover object-center"
            sizes="72px"
          />
        </div>

        <button
          type="button"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#7B61FF] transition active:scale-95"
          onClick={goNext}
          aria-label="Show next quote"
        >
          <IconChevronRight size={18} />
        </button>
      </div>
    </section>
  );
}

function InfoChip({
  Icon,
  label,
  strong = false,
  filledIcon = false,
}: {
  Icon: typeof IconUser;
  label: string;
  strong?: boolean;
  filledIcon?: boolean;
}) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/70 bg-white/75 px-2.5 py-[6px] text-[#1A2B56] shadow-[0_1px_4px_rgba(26,43,86,0.06)] backdrop-blur-md">
      <Icon
        size={13}
        filled={filledIcon}
        className="shrink-0 text-[#1A2B56]"
      />
      <span
        className={`max-w-[12rem] truncate text-[12px] leading-none ${
          strong ? "font-bold" : "font-medium"
        }`}
      >
        {label}
      </span>
    </span>
  );
}

function UpcomingRow({
  href,
  tone,
  Icon,
  title,
  subtitle,
  time,
  divided = false,
}: {
  href: string;
  tone: "purple" | "green";
  Icon: typeof IconCalendar;
  title: string;
  subtitle: string;
  time: string;
  divided?: boolean;
}) {
  const tones =
    tone === "purple"
      ? {
          wrap: "bg-[#EEF2FF]",
          icon: "text-[#6366F1]",
        }
      : {
          wrap: "bg-[#ECFDF5]",
          icon: "text-[#12B76A]",
        };

  return (
    <Link
      href={href}
      className={`flex min-h-[68px] items-center gap-3 px-3.5 py-3.5 transition active:bg-[#F8FAFC] ${
        divided ? "border-b border-[#EEF2F7]" : ""
      }`}
    >
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] ${tones.wrap} ${tones.icon}`}
      >
        <Icon size={18} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-semibold text-[#1A2B56]">
          {title}
        </p>
        <p className="truncate text-[12px] text-[#64748B]">{subtitle}</p>
      </div>
      <span className="shrink-0 text-[12px] font-semibold text-[#64748B]">
        {time}
      </span>
    </Link>
  );
}
