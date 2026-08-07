"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SubHeader } from "@/components/app-header";
import { AlertBox } from "@/components/ui";
import { ApiClientError } from "@/services/api-client";
import { essService } from "@/services/ess-service";
import type { EssMeetingRoom } from "@/types/api";
import { todayLocalDate } from "@/utils/datetime";
import * as ui from "@/theme/classes";

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
        const list = res.data ?? [];
        setRooms(list);
        if (list[0] && !roomId) setRoomId(list[0].id);
      })
      .catch(() => setRooms([]));
  }, [roomId]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
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
    <div className="space-y-5">
      <SubHeader title="Book room" backHref="/rooms" />

      {error ? <AlertBox tone="danger">{error}</AlertBox> : null}

      <form onSubmit={onSubmit} className="space-y-4">
        <label className="block space-y-1.5 text-sm font-semibold text-[#434655]">
          Room
          <select
            className={ui.input}
            required
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
          >
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.room_name} ({r.capacity} seats)
              </option>
            ))}
          </select>
        </label>

        <label className="block space-y-1.5 text-sm font-semibold text-[#434655]">
          Meeting title
          <input
            className={ui.input}
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Team sync"
          />
        </label>

        <label className="block space-y-1.5 text-sm font-semibold text-[#434655]">
          Date
          <input
            type="date"
            className={ui.input}
            required
            value={onDate}
            onChange={(e) => setOnDate(e.target.value)}
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block space-y-1.5 text-sm font-semibold text-[#434655]">
            Start
            <input
              type="time"
              className={ui.input}
              required
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
          </label>
          <label className="block space-y-1.5 text-sm font-semibold text-[#434655]">
            End
            <input
              type="time"
              className={ui.input}
              required
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
            />
          </label>
        </div>

        <label className="block space-y-1.5 text-sm font-semibold text-[#434655]">
          Agenda (optional)
          <textarea
            className={`${ui.input} min-h-[80px] resize-none`}
            value={agenda}
            onChange={(e) => setAgenda(e.target.value)}
          />
        </label>

        <button type="submit" className={`${ui.btn} w-full`} disabled={loading || !roomId}>
          {loading ? "Booking…" : "Confirm booking"}
        </button>
      </form>
    </div>
  );
}
