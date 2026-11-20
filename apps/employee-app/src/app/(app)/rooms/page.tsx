"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CacheBrandLogo } from "@/components/cache-brand-logo";
import {
  IconBack,
  IconCheck,
  IconChevronRight,
  IconClock,
  IconLocation,
  IconPlus,
} from "@/components/icons";
import { NotificationBellLink } from "@/components/notification-bell-link";
import { EmptyState } from "@/components/ui";
import { essService } from "@/services/ess-service";
import type { EssMeetingBooking } from "@/types/api";
import { todayLocalDate } from "@/utils/datetime";

type TabKey = "upcoming" | "past" | "cancelled";

function parseYmd(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

function formatMonthShort(ymd: string): string {
  return parseYmd(ymd)
    .toLocaleDateString("en-US", { month: "short" })
    .toUpperCase();
}

function formatDayNum(ymd: string): string {
  return String(parseYmd(ymd).getDate()).padStart(2, "0");
}

function formatTime12(t: string | null): string {
  if (!t) return "";
  const raw = t.slice(0, 5);
  const [hh, mm] = raw.split(":").map(Number);
  if (Number.isNaN(hh)) return raw;
  const period = hh >= 12 ? "PM" : "AM";
  const h12 = hh % 12 || 12;
  return `${String(h12).padStart(2, "0")}:${String(mm || 0).padStart(2, "0")} ${period}`;
}

function formatTimeRange(start: string | null, end: string | null): string {
  if (!start && !end) return "All day";
  if (start && end) return `${formatTime12(start)} – ${formatTime12(end)}`;
  return formatTime12(start || end);
}

function statusMeta(status: string): {
  label: string;
  className: string;
  icon: "clock" | "check" | "none";
} {
  const s = status.toLowerCase();
  if (s === "submitted" || s === "pending") {
    return {
      label: "Pending HR",
      className: "bg-[#FFF4D6] text-[#9A6B00]",
      icon: "clock",
    };
  }
  if (s === "approved") {
    return {
      label: "Approved",
      className: "bg-[#DCFCE7] text-[#166534]",
      icon: "check",
    };
  }
  if (s === "cancelled") {
    return {
      label: "Cancelled",
      className: "bg-[#F1F5F9] text-[#64748B]",
      icon: "none",
    };
  }
  if (s === "rejected") {
    return {
      label: "Rejected",
      className: "bg-[#FFE4E1] text-[#BA1A1A]",
      icon: "none",
    };
  }
  return {
    label: status,
    className: "bg-[#EFF4FF] text-[#004AC6]",
    icon: "none",
  };
}

function isCancelledLike(status: string): boolean {
  const s = status.toLowerCase();
  return s === "cancelled" || s === "rejected";
}

export default function MeetingRoomsPage() {
  const today = todayLocalDate();
  const [tab, setTab] = useState<TabKey>("upcoming");
  const [bookings, setBookings] = useState<EssMeetingBooking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    essService
      .meetingBookings()
      .then((res) => {
        if (!cancelled) setBookings(res.data ?? []);
      })
      .catch(() => {
        if (!cancelled) setBookings([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const grouped = useMemo(() => {
    const upcoming: EssMeetingBooking[] = [];
    const past: EssMeetingBooking[] = [];
    const cancelled: EssMeetingBooking[] = [];

    for (const b of bookings) {
      if (isCancelledLike(b.status)) {
        cancelled.push(b);
        continue;
      }
      if (b.request_date >= today) upcoming.push(b);
      else past.push(b);
    }

    const byDateAsc = (a: EssMeetingBooking, b: EssMeetingBooking) =>
      a.request_date.localeCompare(b.request_date) ||
      (a.start_time || "").localeCompare(b.start_time || "");
    const byDateDesc = (a: EssMeetingBooking, b: EssMeetingBooking) =>
      b.request_date.localeCompare(a.request_date) ||
      (b.start_time || "").localeCompare(a.start_time || "");

    upcoming.sort(byDateAsc);
    past.sort(byDateDesc);
    cancelled.sort(byDateDesc);
    return { upcoming, past, cancelled };
  }, [bookings, today]);

  const list =
    tab === "upcoming"
      ? grouped.upcoming
      : tab === "past"
        ? grouped.past
        : grouped.cancelled;

  const tabs: { key: TabKey; label: string; count: number }[] = [
    { key: "upcoming", label: "Upcoming", count: grouped.upcoming.length },
    { key: "past", label: "Past", count: grouped.past.length },
    { key: "cancelled", label: "Cancelled", count: grouped.cancelled.length },
  ];

  return (
    <div className="space-y-4 pb-8">
      <header className="sticky top-0 z-40 -mx-5 mb-1 flex h-14 items-center justify-between gap-2 border-b border-[#c3c6d7]/30 bg-[#f8f9ff]/90 px-3 backdrop-blur-xl">
        <div className="flex min-w-0 items-center gap-1.5">
          <Link
            href="/home"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[#0b1c30] transition active:scale-95"
            aria-label="Back"
          >
            <IconBack size={20} />
          </Link>
          <CacheBrandLogo href="/home" height={26} />
        </div>
        <h1 className="pointer-events-none absolute inset-x-0 mx-auto max-w-[46%] truncate text-center text-[17px] font-bold tracking-tight text-[#0b1c30]">
          Meeting Rooms
        </h1>
        <div className="relative z-10 shrink-0 pr-1">
          <NotificationBellLink />
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden rounded-[22px] shadow-[0_10px_28px_rgba(15,23,42,0.12)]">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage:
              "url(https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1200&q=80)",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0b1c30]/90 via-[#0b1c30]/45 to-[#0b1c30]/15" />
        <div className="relative flex min-h-[168px] flex-col justify-end gap-3 p-5 pt-16">
          <div>
            <h2 className="text-[22px] font-bold tracking-tight text-white">
              Meeting Rooms
            </h2>
            <p className="mt-1 max-w-[28ch] text-[13px] leading-snug text-white/85">
              View your room requests, track status, and book a new room.
            </p>
          </div>
          <Link
            href="/rooms/book"
            className="inline-flex w-fit items-center gap-1.5 rounded-full bg-[#2563eb] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(37,99,235,0.45)] transition active:scale-[0.98]"
          >
            <IconPlus size={16} />
            Book Room
          </Link>
        </div>
      </section>

      {/* Tabs */}
      <div className="rounded-full bg-[#E8EEF8] p-1">
        <div className="grid grid-cols-3 gap-1">
          {tabs.map((t) => {
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`rounded-full px-2 py-2.5 text-center text-[13px] font-semibold transition ${
                  active
                    ? "bg-[#2563eb] text-white shadow-[0_6px_16px_rgba(37,99,235,0.35)]"
                    : "text-[#5B6475] active:bg-white/60"
                }`}
              >
                {t.label} ({t.count})
              </button>
            );
          })}
        </div>
      </div>

      {loading ? (
        <p className="py-8 text-center text-sm text-[#434655]">Loading requests…</p>
      ) : list.length === 0 ? (
        <EmptyState
          title={
            tab === "upcoming"
              ? "No upcoming bookings"
              : tab === "past"
                ? "No past bookings"
                : "No cancelled bookings"
          }
          description={
            tab === "upcoming"
              ? "Tap Book Room to raise a request for HR approval."
              : undefined
          }
        />
      ) : (
        <ul className="space-y-3">
          {list.map((b) => {
            const tone = statusMeta(b.status);
            return (
              <li key={b.id}>
                <div className="flex items-center gap-3 rounded-2xl border border-[#E2E8F0] bg-white p-3.5 shadow-[0_4px_16px_rgba(15,23,42,0.05)]">
                  <div className="flex h-[58px] w-[58px] shrink-0 flex-col items-center justify-center rounded-xl bg-[#EFF4FF] text-[#004AC6]">
                    <span className="text-[10px] font-bold tracking-wide">
                      {formatMonthShort(b.request_date)}
                    </span>
                    <span className="text-[20px] font-bold leading-none tabular-nums">
                      {formatDayNum(b.request_date)}
                    </span>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="truncate text-[15px] font-bold text-[#0b1c30]">
                        {b.title}
                      </p>
                      <span
                        className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${tone.className}`}
                      >
                        {tone.icon === "clock" ? <IconClock size={11} /> : null}
                        {tone.icon === "check" ? <IconCheck size={11} /> : null}
                        {tone.label}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[12px] font-medium text-[#5B6475]">
                      {formatTimeRange(b.start_time, b.end_time)}
                    </p>
                    <p className="mt-1 flex items-center gap-1 truncate text-[12px] text-[#737686]">
                      <IconLocation size={12} className="shrink-0 text-[#2563eb]" />
                      {b.room_name || "Meeting room"}
                    </p>
                  </div>

                  <IconChevronRight size={18} className="shrink-0 text-[#C3C6D7]" />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
