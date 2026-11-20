"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AttachBox,
  FieldLabel,
  ModuleHeader,
} from "@/components/attendance-request-shell";
import { IconCalendar, IconDocument } from "@/components/icons";
import { AlertBox } from "@/components/ui";
import { ApiClientError } from "@/services/api-client";
import { essService } from "@/services/ess-service";
import { todayLocalDate } from "@/utils/datetime";
import * as ui from "@/theme/classes";

const REASON_MAX = 500;
const WORK_TYPES = ["Holiday", "Week Off", "Extra Hours", "Weekend"] as const;

export default function ApplyCompOffPage() {
  const router = useRouter();
  const [workedOn, setWorkedOn] = useState(todayLocalDate());
  const [workType, setWorkType] = useState<string>("Holiday");
  const [duration, setDuration] = useState<"full" | "half">("full");
  const [leaveDate, setLeaveDate] = useState("");
  const [reason, setReason] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!workedOn) {
      setError("Please select the worked-on date.");
      return;
    }
    setLoading(true);
    try {
      const parts = [
        `Work type: ${workType}`,
        `Duration: ${duration === "full" ? "Full Day" : "Half Day"}`,
        leaveDate ? `Requested leave date: ${leaveDate}` : null,
        reason.trim() || null,
        file ? `Attachment: ${file.name}` : null,
      ].filter(Boolean);

      await essService.createCompoff({
        earned_date: workedOn,
        extra_hours: duration === "full" ? 8 : 4,
        requested_days: duration === "full" ? 1 : 0.5,
        reason: parts.join("\n") || undefined,
      });
      router.push("/attendance/compoff");
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Submit failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4 pb-10">
      <ModuleHeader title="Apply Comp Off" backHref="/attendance/compoff" />

      {error ? <AlertBox tone="danger">{error}</AlertBox> : null}

      <form onSubmit={onSubmit} className="space-y-4">
        <label className="block">
          <FieldLabel required>Worked On</FieldLabel>
          <div className="relative">
            <IconCalendar
              size={18}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#2563eb]"
            />
            <input
              type="date"
              className={`${ui.input} pl-11`}
              required
              value={workedOn}
              max={todayLocalDate()}
              onChange={(e) => setWorkedOn(e.target.value)}
            />
          </div>
        </label>

        <label className="block">
          <FieldLabel required>Work Type</FieldLabel>
          <select
            className={ui.input}
            value={workType}
            onChange={(e) => setWorkType(e.target.value)}
          >
            {WORK_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>

        <div>
          <FieldLabel required>Work Duration</FieldLabel>
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                { key: "full", label: "Full Day" },
                { key: "half", label: "Half Day" },
              ] as const
            ).map((opt) => {
              const active = duration === opt.key;
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setDuration(opt.key)}
                  className={`rounded-xl border px-3 py-3 text-sm font-semibold transition ${
                    active
                      ? "border-[#2563eb] bg-[#EFF4FF] text-[#004ac6]"
                      : "border-[#c3c6d7]/50 bg-white text-[#434655]"
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        <label className="block">
          <FieldLabel>Requested Leave Date</FieldLabel>
          <div className="relative">
            <IconCalendar
              size={18}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#2563eb]"
            />
            <input
              type="date"
              className={`${ui.input} pl-11`}
              value={leaveDate}
              min={todayLocalDate()}
              onChange={(e) => setLeaveDate(e.target.value)}
            />
          </div>
        </label>

        <label className="block">
          <FieldLabel>Reason</FieldLabel>
          <div className="relative">
            <IconDocument
              size={18}
              className="pointer-events-none absolute left-3.5 top-3.5 text-[#2563eb]"
            />
            <textarea
              className={`${ui.input} min-h-[110px] resize-none pl-11 pb-8`}
              value={reason}
              maxLength={REASON_MAX}
              onChange={(e) => setReason(e.target.value.slice(0, REASON_MAX))}
              placeholder="Describe the work done…"
            />
            <span className="pointer-events-none absolute bottom-2.5 right-3 text-[11px] tabular-nums text-[#737686]">
              {reason.length}/{REASON_MAX}
            </span>
          </div>
        </label>

        <div>
          <FieldLabel>Supporting Document</FieldLabel>
          <AttachBox fileName={file?.name ?? null} onPick={setFile} />
        </div>

        <button
          type="submit"
          className={`${ui.btn} w-full rounded-2xl`}
          disabled={loading}
        >
          {loading ? "Submitting…" : "Submit Request"}
        </button>
      </form>
    </div>
  );
}
