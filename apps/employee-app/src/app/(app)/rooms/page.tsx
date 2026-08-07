"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { EmptyState } from "@/components/ui";
import { essService } from "@/services/ess-service";
import type { EssMeetingRoomAvailability } from "@/types/api";
import { todayLocalDate } from "@/utils/datetime";
import * as ui from "@/theme/classes";

function formatSlot(start: string | null, end: string | null): string {
  if (!start && !end) return "All day";
  const fmt = (t: string) => t.slice(0, 5);
  if (start && end) return `${fmt(start)} – ${fmt(end)}`;
  return start ? fmt(start) : end ? fmt(end) : "";
}

export default function MeetingRoomsPage() {
  const [onDate, setOnDate] = useState(todayLocalDate());
  const [rows, setRows] = useState<EssMeetingRoomAvailability[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    essService
      .meetingRoomAvailability(onDate)
      .then((res) => {
        if (!cancelled) setRows(res.data ?? []);
      })
      .catch(() => {
        if (!cancelled) setRows([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [onDate]);

  const busyCount = useMemo(() => rows.filter((r) => r.is_busy).length, [rows]);

  return (
    <div className="space-y-5">
      <AppHeader title="Meeting rooms" />

      <label className="block space-y-1.5 text-sm font-semibold text-[#434655]">
        Date
        <input
          type="date"
          className={ui.input}
          value={onDate}
          onChange={(e) => setOnDate(e.target.value)}
        />
      </label>

      <p className="text-sm text-[#434655]">
        {busyCount} of {rows.length} room{rows.length === 1 ? "" : "s"} have bookings on this date.
      </p>

      <Link
        href={`/rooms/book?date=${encodeURIComponent(onDate)}`}
        className={`${ui.btn} block text-center`}
      >
        Book a room
      </Link>

      {loading ? (
        <p className="text-sm text-[#434655]">Loading availability…</p>
      ) : rows.length === 0 ? (
        <EmptyState title="No meeting rooms" description="Ask HR to add rooms in HR Setup." />
      ) : (
        <ul className="space-y-3">
          {rows.map((item) => (
            <li key={item.room.id} className={`${ui.card} p-4`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-[#0b1c30]">{item.room.room_name}</p>
                  <p className="text-xs text-[#434655]">
                    {item.room.room_code} · seats {item.room.capacity}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                    item.is_busy
                      ? "bg-[#ffdad6] text-[#ba1a1a]"
                      : "bg-emerald-100 text-emerald-800"
                  }`}
                >
                  {item.is_busy ? "Busy" : "Free"}
                </span>
              </div>
              {item.bookings.length > 0 ? (
                <ul className="mt-3 space-y-1.5 border-t border-[#e8ecf4] pt-3 text-xs text-[#434655]">
                  {item.bookings.map((b) => (
                    <li key={b.id}>
                      <span className="font-semibold text-[#0b1c30]">{b.title}</span>
                      {b.requested_by_name ? (
                        <>
                          {" · "}
                          <span className="text-[#5c5f66]">{b.requested_by_name}</span>
                        </>
                      ) : null}
                      {" · "}
                      {formatSlot(b.start_time, b.end_time)}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-xs text-[#434655]">No bookings yet.</p>
              )}
            </li>
          ))}
        </ul>
      )}

    </div>
  );
}
