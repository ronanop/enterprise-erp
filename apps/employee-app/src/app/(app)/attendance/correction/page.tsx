"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SubHeader } from "@/components/app-header";
import {
  IconAlert,
  IconCheck,
  IconClock,
  IconFingerprint,
  IconUser,
} from "@/components/icons";
import { AlertBox } from "@/components/ui";
import { ApiClientError } from "@/services/api-client";
import { essService } from "@/services/ess-service";
import type { EssAttendance, EssMe } from "@/types/api";
import * as ui from "@/theme/classes";
import { formatTime, todayLocalDate } from "@/utils/datetime";

export default function AttendanceCorrectionPage() {
  const router = useRouter();
  const [me, setMe] = useState<EssMe | null>(null);
  const [target, setTarget] = useState<EssAttendance | null>(null);
  const [time, setTime] = useState("18:30");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    Promise.all([essService.attendance(), essService.me()])
      .then(([att, meRes]) => {
        setMe(meRes.data);
        const rows = att.data ?? [];
        const missing =
          rows.find(
            (r) =>
              r.check_in_at &&
              !r.check_out_at &&
              r.attendance_date !== todayLocalDate(),
          ) ??
          rows.find((r) => r.attendance_status === "absent") ??
          rows[1] ??
          null;
        setTarget(missing);
      })
      .catch((err) =>
        setError(
          err instanceof ApiClientError
            ? err.message
            : "Failed to load attendance",
        ),
      );
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!target) {
      setError("No attendance record selected for correction");
      return;
    }
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const datePart = target.attendance_date;
      const iso = `${datePart}T${time}:00`;
      await essService.createAttendanceCorrection({
        attendance_date: datePart,
        field_name: target.check_out_at ? "check_in" : "check_out",
        new_value: iso,
        reason: reason || "Miss punch / attendance correction",
        attendance_id: target.id,
        old_value: target.check_out_at
          ? target.check_in_at ?? undefined
          : target.check_out_at ?? undefined,
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

  return (
    <div className="space-y-5">
      <SubHeader
        title="Correction Request"
        backHref="/attendance/history"
        name={me?.display_name}
      />

      {error ? <AlertBox>{error}</AlertBox> : null}
      {message ? <AlertBox tone="success">{message}</AlertBox> : null}

      <section className={`${ui.card} space-y-3 p-4`}>
        <div className="flex items-start justify-between gap-2">
          <span className="rounded-full bg-[#ffdad6] px-2.5 py-0.5 text-[10px] font-bold uppercase text-[#ba1a1a]">
            Missing Check-out
          </span>
          <span className="text-sm text-[#434655]">
            {target?.attendance_date ?? "—"}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#dce9ff] text-[#004ac6]">
            <IconFingerprint size={22} />
          </span>
          <div>
            <p className="text-sm text-[#434655]">Checked In at</p>
            <p className="text-xl font-bold text-[#0b1c30]">
              {formatTime(target?.check_in_at ?? null)}
            </p>
          </div>
        </div>
        <p className="flex items-center gap-2 text-sm font-medium text-[#ba1a1a]">
          <IconAlert size={16} />
          Automatic checkout failed at 18:00
        </p>
      </section>

      <form onSubmit={onSubmit} className="space-y-4">
        <label className="block space-y-1.5 text-sm font-semibold text-[#434655]">
          Corrected Time
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
          Reason for Correction
          <textarea
            className={`${ui.input} min-h-[100px] resize-none`}
            required
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Briefly describe why the punch was missed (e.g., Client meeting offsite, forgot to punch out)"
          />
        </label>

        <div>
          <p className="mb-2 text-sm font-semibold text-[#434655]">
            Verification Proof (Optional)
          </p>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-[#2563eb]/40 bg-[#eff4ff] px-3 py-5 text-sm font-semibold text-[#004ac6]"
            >
              Upload File
            </button>
            <button
              type="button"
              className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-[#2563eb]/40 bg-[#eff4ff] px-3 py-5 text-sm font-semibold text-[#004ac6]"
            >
              Open Camera
            </button>
          </div>
        </div>

        <section>
          <p className="mb-3 text-xs font-bold uppercase tracking-wide text-[#434655]">
            Workflow Timeline
          </p>
          <ol>
            <Timeline
              active
              icon={<IconCheck size={14} />}
              title="Request Submitted"
              subtitle="Current Stage"
            />
            <Timeline
              icon={<IconUser size={14} />}
              title="Manager Approval"
              subtitle="Awaiting Manager review"
            />
            <Timeline
              icon={<IconCheck size={14} />}
              title="HR Verification"
              subtitle="Final processing"
              last
            />
          </ol>
        </section>

        <button className={`${ui.btn} w-full`} disabled={loading || !reason}>
          {loading ? "Submitting…" : "Submit Request"}
        </button>
      </form>
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
