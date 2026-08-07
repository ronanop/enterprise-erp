"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SubHeader } from "@/components/app-header";
import {
  IconAlert,
  IconCheck,
  IconClock,
  IconFingerprint,
  IconUser,
} from "@/components/icons";
import { MonthSingleCalendar } from "@/components/month-range-calendar";
import { AlertBox } from "@/components/ui";
import { ApiClientError } from "@/services/api-client";
import { essService } from "@/services/ess-service";
import type { EssAttendance, EssMe } from "@/types/api";
import * as ui from "@/theme/classes";
import {
  formatDisplayDateDDMMYYYY,
  formatTime,
  parseIsoDate,
  todayLocalDate,
} from "@/utils/datetime";

type CorrectionField = "check_in" | "check_out";

export default function AttendanceCorrectionPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialDate = searchParams.get("date")?.slice(0, 10) ?? "";

  const [me, setMe] = useState<EssMe | null>(null);
  const [rows, setRows] = useState<EssAttendance[]>([]);
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [calendarCursor, setCalendarCursor] = useState(() => {
    const base = initialDate
      ? parseIsoDate(initialDate)
      : new Date();
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });
  const [fieldName, setFieldName] = useState<CorrectionField>("check_out");
  const [time, setTime] = useState("18:30");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    essService
      .attendance()
      .then((att) => setRows(att.data ?? []))
      .catch((err) =>
        setLoadError(
          err instanceof ApiClientError
            ? err.message
            : "Failed to load attendance",
        ),
      );
    essService
      .me()
      .then((res) => setMe(res.data))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (initialDate && !selectedDate) {
      setSelectedDate(initialDate);
    }
  }, [initialDate, selectedDate]);

  const target = useMemo(
    () => rows.find((r) => r.attendance_date === selectedDate) ?? null,
    [rows, selectedDate],
  );

  const markedDates = useMemo(
    () => new Set(rows.map((r) => r.attendance_date)),
    [rows],
  );

  useEffect(() => {
    if (!selectedDate) return;
    if (target) {
      if (target.check_in_at && !target.check_out_at) {
        setFieldName("check_out");
      } else if (!target.check_in_at && target.check_out_at) {
        setFieldName("check_in");
      } else if (!target.check_in_at && !target.check_out_at) {
        setFieldName("check_in");
      } else {
        setFieldName("check_out");
      }
    }
  }, [selectedDate, target]);

  const issueHint = useMemo(() => {
    if (!target) return "No punch record for this day — choose what to add.";
    if (target.check_in_at && !target.check_out_at) {
      return "Missing check-out on this day.";
    }
    if (!target.check_in_at) return "Missing check-in on this day.";
    return "Adjust check-in or check-out time.";
  }, [target]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!selectedDate) {
      setError("Select the date you want to correct");
      return;
    }
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const datePart = selectedDate.slice(0, 10);
      const iso = `${datePart}T${time}:00`;
      await essService.createAttendanceCorrection({
        attendance_date: datePart,
        field_name: fieldName,
        new_value: iso,
        reason: reason || "Miss punch / attendance correction",
        attendance_id: target?.id,
        old_value:
          fieldName === "check_in"
            ? target?.check_in_at ?? undefined
            : target?.check_out_at ?? undefined,
      });
      setMessage("Correction request submitted for manager review");
      setTimeout(() => router.push("/attendance/history"), 900);
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : "Submit failed",
      );
    } finally {
      setLoading(false);
    }
  }

  const showForm = Boolean(selectedDate);
  const today = todayLocalDate();

  return (
    <div className="space-y-5">
      <SubHeader
        title="Correction Request"
        backHref="/attendance/history"
        name={me?.display_name}
      />

      {loadError ? <AlertBox>{loadError}</AlertBox> : null}
      {error ? <AlertBox>{error}</AlertBox> : null}
      {message ? <AlertBox tone="success">{message}</AlertBox> : null}

      <section className={`${ui.card} space-y-4 p-4`}>
        <div>
          <h2 className="text-base font-bold text-[#0b1c30]">
            1. Select date
          </h2>
          <p className="mt-1 text-sm text-[#434655]">
            Tap the day you need to fix (highlighted days have attendance
            records).
          </p>
        </div>
        <MonthSingleCalendar
          cursor={calendarCursor}
          onCursorChange={setCalendarCursor}
          selectedDate={selectedDate}
          onSelectDate={(iso) => {
            setSelectedDate(iso);
            setError(null);
          }}
          maxDate={today}
          markedDates={markedDates}
        />
        {selectedDate ? (
          <p className="text-center text-sm font-semibold text-[#004ac6]">
            Selected: {formatDisplayDateDDMMYYYY(selectedDate)}
          </p>
        ) : (
          <p className="text-center text-sm text-[#434655]">
            No date selected yet
          </p>
        )}
      </section>

      {showForm ? (
        <>
          <section className={`${ui.card} space-y-3 p-4`}>
            <div className="flex items-start justify-between gap-2">
              <span className="rounded-full bg-[#ffdad6] px-2.5 py-0.5 text-[10px] font-bold uppercase text-[#ba1a1a]">
                {fieldName === "check_out" ? "Check-out" : "Check-in"}
              </span>
              <span className="text-sm font-semibold text-[#0b1c30]">
                {formatDisplayDateDDMMYYYY(selectedDate)}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#dce9ff] text-[#004ac6]">
                <IconFingerprint size={22} />
              </span>
              <div className="min-w-0 flex-1 text-sm">
                <p className="text-[#434655]">Check in</p>
                <p className="font-bold text-[#0b1c30]">
                  {formatTime(target?.check_in_at ?? null)}
                </p>
                <p className="mt-2 text-[#434655]">Check out</p>
                <p className="font-bold text-[#0b1c30]">
                  {formatTime(target?.check_out_at ?? null)}
                </p>
              </div>
            </div>
            <p className="flex items-center gap-2 text-sm font-medium text-[#434655]">
              <IconAlert size={16} />
              {issueHint}
            </p>
          </section>

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <p className="mb-2 text-sm font-semibold text-[#434655]">
                2. What to correct
              </p>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    { id: "check_in" as const, label: "Check-in time" },
                    { id: "check_out" as const, label: "Check-out time" },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setFieldName(opt.id)}
                    className={`rounded-xl px-3 py-2.5 text-sm font-semibold ${
                      fieldName === opt.id
                        ? "bg-[#004ac6] text-white"
                        : "border border-[#c3c6d7]/50 bg-white text-[#434655]"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <label className="block space-y-1.5 text-sm font-semibold text-[#434655]">
              3. Corrected time
              <div className="relative">
                <input
                  className={ui.input}
                  type="time"
                  required
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#004ac6]">
                  <IconClock size={18} />
                </span>
              </div>
            </label>

            <label className="block space-y-1.5 text-sm font-semibold text-[#434655]">
              4. Reason
              <textarea
                className={`${ui.input} min-h-[100px] resize-none`}
                required
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Briefly describe why the punch was missed"
              />
            </label>

            <section>
              <p className="mb-3 text-xs font-bold uppercase tracking-wide text-[#434655]">
                Workflow
              </p>
              <ol>
                <Timeline
                  active
                  icon={<IconCheck size={14} />}
                  title="Request Submitted"
                  subtitle="After you submit"
                />
                <Timeline
                  icon={<IconUser size={14} />}
                  title="Manager Approval"
                  subtitle="Awaiting manager review"
                />
                <Timeline
                  icon={<IconCheck size={14} />}
                  title="HR Verification"
                  subtitle="Final processing"
                  last
                />
              </ol>
            </section>

            <button
              className={`${ui.btn} w-full`}
              disabled={loading || !reason.trim()}
            >
              {loading ? "Submitting…" : "Submit Request"}
            </button>
          </form>
        </>
      ) : null}
    </div>
  );
}

function Timeline({
  title,
  subtitle,
  icon,
  active,
  last,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  active?: boolean;
  last?: boolean;
}) {
  return (
    <li className="flex gap-3">
      <div className="flex w-7 shrink-0 flex-col items-center">
        <span
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
            active
              ? "bg-[#2563eb] text-white"
              : "bg-[#e5eeff] text-[#434655]"
          }`}
        >
          {icon}
        </span>
        {!last ? (
          <span className="mt-1 min-h-4 w-0.5 flex-1 bg-[#c3c6d7]/50" />
        ) : null}
      </div>
      <div className={last ? "min-w-0 pb-0" : "min-w-0 pb-5"}>
        <p className="font-semibold leading-7 text-[#0b1c30]">{title}</p>
        <p className="text-sm text-[#434655]">{subtitle}</p>
      </div>
    </li>
  );
}
