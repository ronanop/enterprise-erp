"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { AlertBox, EmptyState } from "@/components/ui";
import { IconClock } from "@/components/icons";
import { ApiClientError } from "@/services/api-client";
import { essService } from "@/services/ess-service";
import type { EssAttendance, EssMe } from "@/types/api";
import * as ui from "@/theme/classes";
import { formatHoursLabel, formatTime } from "@/utils/datetime";

export default function TimesheetPage() {
  const [me, setMe] = useState<EssMe | null>(null);
  const [rows, setRows] = useState<EssAttendance[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([essService.me(), essService.attendance()])
      .then(([meRes, attRes]) => {
        setMe(meRes.data);
        setRows(attRes.data ?? []);
      })
      .catch((err) =>
        setError(
          err instanceof ApiClientError
            ? err.message
            : "Failed to load timesheet",
        ),
      )
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-5">
      <AppHeader title="Timesheet" name={me?.display_name} />
      <p className="text-sm text-[#434655]">
        Hours from your attendance punches. Full roster planning stays with HR.
      </p>
      {error ? <AlertBox>{error}</AlertBox> : null}
      {loading ? (
        <p className="text-sm text-[#434655]">Loading…</p>
      ) : rows.length === 0 ? (
        <EmptyState
          title="No timesheet entries"
          description="Check in from Attendance to start logging hours."
          icon={<IconClock size={20} />}
        />
      ) : (
        <ul className="space-y-2">
          {rows.slice(0, 31).map((row) => (
            <li key={row.id} className={`${ui.card} p-4`}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-[#0b1c30]">
                    {row.attendance_date}
                  </p>
                  <p className="text-xs text-[#434655]">
                    {formatTime(row.check_in_at)} – {formatTime(row.check_out_at)}
                  </p>
                </div>
                <p className="font-mono text-sm font-bold text-[#004ac6]">
                  {formatHoursLabel(row.total_hours)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
      <Link
        href="/attendance/history"
        className="block text-center text-sm font-semibold text-[#004ac6]"
      >
        Open attendance history
      </Link>
    </div>
  );
}
