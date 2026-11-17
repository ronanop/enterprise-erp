"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { SubHeader } from "@/components/app-header";
import {
  IconAlert,
  IconCheck,
  IconFingerprint,
  IconUser,
} from "@/components/icons";
import { MonthSingleCalendar } from "@/components/month-range-calendar";
import { AlertBox } from "@/components/ui";
import { ApiClientError } from "@/services/api-client";
import { essService } from "@/services/ess-service";
import type {
  EssAttendance,
  EssAttendanceCorrection,
  EssMe,
} from "@/types/api";
import * as ui from "@/theme/classes";
import {
  formatDisplayDateDDMMYYYY,
  formatTime,
  parseIsoDate,
  todayLocalDate,
} from "@/utils/datetime";

type CorrectionField = "check_in" | "check_out";

function hhmmFromIso(
  value: string | null | undefined,
  fallback: string,
): string {
  if (!value) return fallback;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return fallback;
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function localDateTimeToIso(datePart: string, timeHm: string): string {
  const match = /^(\d{2}):(\d{2})$/.exec((timeHm || "").trim());
  if (!match) {
    throw new Error("Enter a valid corrected time");
  }
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const d = new Date(`${datePart.slice(0, 10)}T12:00:00`);
  d.setHours(hours, minutes, 0, 0);
  return d.toISOString();
}

function fieldLabel(field: string) {
  if (field === "check_out") return "Check-out";
  if (field === "check_in") return "Check-in";
  return field.replace(/_/g, " ");
}

function statusTone(status: string) {
  const s = status.toLowerCase();
  if (s === "submitted") return "bg-[#EEF2FF] text-[#3730A3]";
  if (s === "approved") return "bg-emerald-100 text-emerald-800";
  if (s === "rejected" || s === "cancelled") return "bg-[#ffdad6] text-[#ba1a1a]";
  return "bg-[#F1F5F9] text-[#475569]";
}

export default function AttendanceCorrectionPage() {
  const searchParams = useSearchParams();
  const initialDate = searchParams.get("date")?.slice(0, 10) ?? "";

  const [me, setMe] = useState<EssMe | null>(null);
  const [rows, setRows] = useState<EssAttendance[]>([]);
  const [corrections, setCorrections] = useState<EssAttendanceCorrection[]>([]);
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [calendarCursor, setCalendarCursor] = useState(() => {
    const base = initialDate ? parseIsoDate(initialDate) : new Date();
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });
  const [fieldName, setFieldName] = useState<CorrectionField>("check_in");
  const [time, setTime] = useState("09:30");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [lastSubmittedId, setLastSubmittedId] = useState<string | null>(null);

  const refreshCorrections = useCallback(async () => {
    const res = await essService.listAttendanceCorrections();
    const list = [...(res.data ?? [])].sort((a, b) =>
      String(b.attendance_date).localeCompare(String(a.attendance_date)),
    );
    setCorrections(list);
    return list;
  }, []);

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
    refreshCorrections().catch(() => undefined);
  }, [refreshCorrections]);

  useEffect(() => {
    if (initialDate && !selectedDate) {
      setSelectedDate(initialDate);
    }
  }, [initialDate, selectedDate]);

  const target = useMemo(
    () =>
      rows.find((r) => String(r.attendance_date).slice(0, 10) === selectedDate) ??
      null,
    [rows, selectedDate],
  );

  const openForSelectedDate = useMemo(
    () =>
      corrections.find(
        (c) =>
          String(c.attendance_date).slice(0, 10) === selectedDate &&
          ["draft", "submitted"].includes(c.status.toLowerCase()),
      ) ?? null,
    [corrections, selectedDate],
  );

  const markedDates = useMemo(
    () => new Set(rows.map((r) => String(r.attendance_date).slice(0, 10))),
    [rows],
  );

  const myOpenRequests = useMemo(
    () =>
      corrections.filter((c) =>
        ["draft", "submitted"].includes(c.status.toLowerCase()),
      ),
    [corrections],
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
    } else {
      setFieldName("check_in");
    }
  }, [selectedDate, target]);

  useEffect(() => {
    if (!selectedDate) return;
    if (fieldName === "check_in") {
      setTime(hhmmFromIso(target?.check_in_at, "09:30"));
    } else {
      setTime(hhmmFromIso(target?.check_out_at, "18:30"));
    }
  }, [selectedDate, fieldName, target?.check_in_at, target?.check_out_at]);

  const issueHint = useMemo(() => {
    if (!target) return "No punch record for this day - choose what to add.";
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
    if (!/^\d{2}:\d{2}$/.test(time)) {
      setError("Enter a valid corrected time");
      return;
    }
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const datePart = selectedDate.slice(0, 10);
      const iso = localDateTimeToIso(datePart, time);
      const res = await essService.createAttendanceCorrection({
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
      const managerLabel = me?.manager_name?.trim() || "your manager";
      setLastSubmittedId(res.data?.id ?? null);
      setMessage(
        `Submitted and sent to ${managerLabel}. Pending under Team Approvals → Regularization.`,
      );
      setReason("");
      await refreshCorrections();
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Submit failed",
      );
    } finally {
      setLoading(false);
    }
  }

  async function onRevoke(id: string) {
    setRevokingId(id);
    setError(null);
    setMessage(null);
    try {
      await essService.cancelAttendanceCorrection(id);
      setMessage("Request revoked. Manager no longer needs to action it.");
      if (lastSubmittedId === id) setLastSubmittedId(null);
      await refreshCorrections();
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Revoke failed",
      );
    } finally {
      setRevokingId(null);
    }
  }

  const showForm = Boolean(selectedDate) && !openForSelectedDate;
  const today = todayLocalDate();
  const managerLabel = me?.manager_name?.trim() || "Manager";

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

      {myOpenRequests.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-wide text-[#434655]">
            Your submitted requests
          </h2>
          {myOpenRequests.map((item) => {
            const submitted = item.status.toLowerCase() === "submitted";
            const highlight = item.id === lastSubmittedId;
            return (
              <article
                key={item.id}
                className={`${ui.card} space-y-3 p-4 ${
                  highlight ? "ring-2 ring-[#004ac6]/30" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-bold text-[#0b1c30]">
                      {formatDisplayDateDDMMYYYY(item.attendance_date)} ·{" "}
                      {fieldLabel(item.field_name)}
                    </p>
                    <p className="mt-1 text-sm text-[#434655]">
                      Corrected time:{" "}
                      <span className="font-semibold text-[#0b1c30]">
                        {formatTime(item.new_value)}
                      </span>
                    </p>
                    {item.reason ? (
                      <p className="mt-1 text-sm text-[#64748B]">
                        Reason: {item.reason}
                      </p>
                    ) : null}
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${statusTone(
                      item.status,
                    )}`}
                  >
                    {item.status}
                  </span>
                </div>

                <ol>
                  <Timeline
                    active
                    done
                    icon={<IconCheck size={14} />}
                    title="Request Submitted"
                    subtitle="Sent to manager"
                  />
                  <Timeline
                    active={submitted}
                    icon={<IconUser size={14} />}
                    title="Manager Approval"
                    subtitle={
                      submitted
                        ? `Waiting for ${managerLabel}`
                        : "Manager review"
                    }
                  />
                  <Timeline
                    icon={<IconCheck size={14} />}
                    title="Completed"
                    subtitle="Applied after approval"
                    last
                  />
                </ol>

                {submitted ? (
                  <button
                    type="button"
                    className="w-full rounded-xl border border-[#ba1a1a]/30 bg-[#fff5f4] px-3 py-2.5 text-sm font-semibold text-[#ba1a1a] disabled:opacity-60"
                    disabled={revokingId === item.id}
                    onClick={() => void onRevoke(item.id)}
                  >
                    {revokingId === item.id ? "Revoking…" : "Revoke request"}
                  </button>
                ) : null}
              </article>
            );
          })}
        </section>
      ) : null}

      <section className={`${ui.card} space-y-4 p-4`}>
        <div>
          <h2 className="text-base font-bold text-[#0b1c30]">1. Select date</h2>
          <p className="mt-1 text-sm text-[#434655]">
            Tap the day you need to fix (within the last 14 days). Highlighted
            days have attendance records.
          </p>
        </div>
        <MonthSingleCalendar
          cursor={calendarCursor}
          onCursorChange={setCalendarCursor}
          selectedDate={selectedDate}
          onSelectDate={(iso) => {
            setSelectedDate(iso);
            setError(null);
            setMessage(null);
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

      {openForSelectedDate ? (
        <AlertBox tone="success">
          You already have a {openForSelectedDate.status} request for this date.
          Revoke it above if you want to submit a new one.
        </AlertBox>
      ) : null}

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
              <input
                className={`${ui.input} [color-scheme:light]`}
                type="time"
                required
                step={60}
                value={time}
                onChange={(e) => {
                  const next = e.target.value?.slice(0, 5) || "";
                  setTime(next);
                }}
              />
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
                  subtitle={`Goes to ${managerLabel}`}
                />
                <Timeline
                  icon={<IconCheck size={14} />}
                  title="Applied"
                  subtitle="Attendance updated"
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
  done,
  last,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  active?: boolean;
  done?: boolean;
  last?: boolean;
}) {
  return (
    <li className="flex gap-3">
      <div className="flex w-7 shrink-0 flex-col items-center">
        <span
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
            done || active
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
