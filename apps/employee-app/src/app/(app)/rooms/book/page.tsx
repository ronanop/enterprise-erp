"use client";

import { FormEvent, type ReactNode, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CacheBrandLogo } from "@/components/cache-brand-logo";
import {
  IconBack,
  IconBuilding,
  IconCalendar,
  IconClock,
  IconDocument,
  IconEdit,
  IconInfo,
  IconPlane,
} from "@/components/icons";
import { NotificationBellLink } from "@/components/notification-bell-link";
import { AlertBox } from "@/components/ui";
import { ApiClientError } from "@/services/api-client";
import { essService } from "@/services/ess-service";
import type { EssMeetingRoom } from "@/types/api";
import { todayLocalDate } from "@/utils/datetime";
import * as ui from "@/theme/classes";

const AGENDA_MAX = 500;

function buildTimeOptions(): { value: string; label: string }[] {
  const out: { value: string; label: string }[] = [];
  for (let h = 0; h < 24; h++) {
    for (const m of [0, 30]) {
      const value = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
      const period = h >= 12 ? "PM" : "AM";
      const h12 = h % 12 || 12;
      out.push({
        value,
        label: `${String(h12).padStart(2, "0")}:${String(m).padStart(2, "0")} ${period}`,
      });
    }
  }
  return out;
}

const TIME_OPTIONS = buildTimeOptions();

function FieldLabel({
  children,
  required,
}: {
  children: ReactNode;
  required?: boolean;
}) {
  return (
    <span className="mb-1.5 block text-[13px] font-semibold text-[#434655]">
      {children}
      {required ? <span className="ml-0.5 text-[#BA1A1A]">*</span> : null}
    </span>
  );
}

export default function BookMeetingRoomPage() {
  const router = useRouter();
  const search = useSearchParams();
  const [rooms, setRooms] = useState<EssMeetingRoom[]>([]);
  const [roomId, setRoomId] = useState("");
  const [title, setTitle] = useState("");
  const [onDate, setOnDate] = useState(search.get("date") || todayLocalDate());
  const [startTime, setStartTime] = useState("10:00");
  const [endTime, setEndTime] = useState("11:00");
  const [agenda, setAgenda] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    essService
      .meetingRooms()
      .then((res) => {
        const list = (res.data ?? []).filter(
          (r) => (r.status || "").toLowerCase() !== "inactive",
        );
        setRooms(list);
        setRoomId((prev) => prev || list[0]?.id || "");
      })
      .catch(() => setRooms([]));
  }, []);

  const selectedRoom = useMemo(
    () => rooms.find((r) => r.id === roomId) ?? null,
    [rooms, roomId],
  );

  const roomFeatures = useMemo(() => {
    const raw = selectedRoom?.equipment_json;
    if (!Array.isArray(raw) || !raw.length) return [] as string[];
    return raw
      .map((item) => {
        if (item && typeof item === "object" && "name" in item) {
          const o = item as { name?: string; remarks?: string };
          const name = String(o.name ?? "").trim();
          if (!name) return "";
          const remarks = String(o.remarks ?? "").trim();
          return remarks ? `${name} (${remarks})` : name;
        }
        return String(item).trim();
      })
      .filter(Boolean);
  }, [selectedRoom]);

  const endOptions = useMemo(
    () => TIME_OPTIONS.filter((t) => t.value > startTime),
    [startTime],
  );

  useEffect(() => {
    if (endTime <= startTime && endOptions[0]) {
      setEndTime(endOptions[0].value);
    }
  }, [startTime, endTime, endOptions]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!roomId) {
      setError("Please select a room.");
      return;
    }
    if (!title.trim()) {
      setError("Please enter a meeting title.");
      return;
    }
    if (endTime <= startTime) {
      setError("End time must be after start time.");
      return;
    }
    setLoading(true);
    try {
      await essService.createMeetingBooking({
        room_id: roomId,
        title: title.trim(),
        request_date: onDate,
        start_time: startTime,
        end_time: endTime,
        agenda: agenda.trim() || undefined,
      });
      router.push("/rooms");
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Booking failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4 pb-10">
      <header className="sticky top-0 z-40 -mx-5 mb-1 flex h-14 items-center justify-between gap-2 border-b border-[#c3c6d7]/30 bg-[#f8f9ff]/90 px-3 backdrop-blur-xl">
        <div className="flex min-w-0 items-center gap-1.5">
          <Link
            href="/rooms"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[#0b1c30] transition active:scale-95"
            aria-label="Back"
          >
            <IconBack size={20} />
          </Link>
          <CacheBrandLogo href="/home" height={26} />
        </div>
        <h1 className="pointer-events-none absolute inset-x-0 mx-auto max-w-[52%] truncate text-center text-[17px] font-bold tracking-tight text-[#0b1c30]">
          Book Meeting Room
        </h1>
        <div className="relative z-10 shrink-0 pr-1">
          <NotificationBellLink />
        </div>
      </header>

      {/* Info banner */}
      <div className="flex items-center gap-3 rounded-2xl border border-[#BFDBFE] bg-[#EFF6FF] p-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white text-[#2563eb] shadow-sm">
          <IconCalendar size={24} />
        </div>
        <div className="min-w-0">
          <p className="text-[15px] font-bold text-[#0b1c30]">
            Request a Meeting Room
          </p>
          <p className="mt-0.5 text-[12px] leading-snug text-[#434655]">
            Raise a room booking request. It will be sent to HR for approval.
          </p>
        </div>
      </div>

      {error ? <AlertBox tone="danger">{error}</AlertBox> : null}

      <form onSubmit={onSubmit} className="space-y-4">
        <label className="block">
          <FieldLabel required>Room</FieldLabel>
          <div className="relative">
            <IconBuilding
              size={18}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#2563eb]"
            />
            <select
              className={`${ui.input} appearance-none pl-11`}
              required
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
            >
              <option value="" disabled>
                Select a room
              </option>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.room_name} ({r.capacity} seats)
                </option>
              ))}
            </select>
          </div>
        </label>

        {selectedRoom ? (
          <div className="rounded-2xl border border-[#E2E8F0] bg-white p-3.5 shadow-[0_4px_12px_rgba(15,23,42,0.04)]">
            <p className="text-[14px] font-bold text-[#0b1c30]">
              {selectedRoom.room_name}
            </p>
            <p className="mt-0.5 text-[12px] text-[#5B6475]">
              Code {selectedRoom.room_code} · Capacity {selectedRoom.capacity}
            </p>
            {selectedRoom.notes ? (
              <p className="mt-1.5 text-[12px] leading-snug text-[#737686]">
                {selectedRoom.notes}
              </p>
            ) : null}
            {roomFeatures.length ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {roomFeatures.map((f) => (
                  <span
                    key={f}
                    className="rounded-full bg-[#EFF4FF] px-2 py-0.5 text-[10px] font-semibold text-[#004AC6]"
                  >
                    {f}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        <label className="block">
          <FieldLabel required>Meeting Title</FieldLabel>
          <div className="relative">
            <IconEdit
              size={18}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#2563eb]"
            />
            <input
              className={`${ui.input} pl-11`}
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Team Sync"
              maxLength={120}
            />
          </div>
        </label>

        <label className="block">
          <FieldLabel required>Date</FieldLabel>
          <div className="relative">
            <IconCalendar
              size={18}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#2563eb]"
            />
            <input
              type="date"
              className={`${ui.input} pl-11`}
              required
              min={todayLocalDate()}
              value={onDate}
              onChange={(e) => setOnDate(e.target.value)}
            />
          </div>
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <FieldLabel required>Start Time</FieldLabel>
            <div className="relative">
              <IconClock
                size={16}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#2563eb]"
              />
              <select
                className={`${ui.input} appearance-none pl-9 text-[13px]`}
                required
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              >
                {TIME_OPTIONS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
          </label>
          <label className="block">
            <FieldLabel required>End Time</FieldLabel>
            <div className="relative">
              <IconClock
                size={16}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#2563eb]"
              />
              <select
                className={`${ui.input} appearance-none pl-9 text-[13px]`}
                required
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              >
                {endOptions.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
          </label>
        </div>

        <label className="block">
          <FieldLabel>Agenda (Optional)</FieldLabel>
          <div className="relative">
            <IconDocument
              size={18}
              className="pointer-events-none absolute left-3.5 top-3.5 text-[#2563eb]"
            />
            <textarea
              className={`${ui.input} min-h-[110px] resize-none pl-11 pb-8`}
              value={agenda}
              maxLength={AGENDA_MAX}
              onChange={(e) => setAgenda(e.target.value.slice(0, AGENDA_MAX))}
              placeholder="Add meeting agenda, discussion points, etc."
            />
            <span className="pointer-events-none absolute bottom-2.5 right-3 text-[11px] tabular-nums text-[#737686]">
              {agenda.length}/{AGENDA_MAX}
            </span>
          </div>
        </label>

        <div className="flex gap-2.5 rounded-2xl border border-[#BFDBFE] bg-[#EFF6FF] px-3.5 py-3">
          <IconInfo size={18} className="mt-0.5 shrink-0 text-[#2563eb]" />
          <p className="text-[12px] leading-snug text-[#1E3A5F]">
            This is a request and will be sent to HR for approval. You will be
            notified once it is reviewed.
          </p>
        </div>

        <button
          type="submit"
          className={`${ui.btn} w-full rounded-2xl`}
          disabled={loading || !roomId}
        >
          <IconPlane size={18} />
          {loading ? "Submitting…" : "Submit Request"}
        </button>
      </form>
    </div>
  );
}
