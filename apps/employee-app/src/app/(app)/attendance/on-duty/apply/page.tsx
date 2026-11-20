"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AttachBox,
  FieldLabel,
  ModuleHeader,
} from "@/components/attendance-request-shell";
import {
  IconBriefcase,
  IconCalendar,
  IconClock,
  IconDocument,
  IconLocation,
  IconUser,
} from "@/components/icons";
import { AlertBox } from "@/components/ui";
import { ApiClientError } from "@/services/api-client";
import { essService } from "@/services/ess-service";
import type { EssMe } from "@/types/api";
import { todayLocalDate } from "@/utils/datetime";
import * as ui from "@/theme/classes";

const PURPOSE_MAX = 500;
const DUTY_TYPES = [
  "Client Visit",
  "Official Meeting",
  "Training",
  "Site Visit",
  "Other",
] as const;

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

export default function ApplyOnDutyPage() {
  const router = useRouter();
  const [me, setMe] = useState<EssMe | null>(null);
  const [dutyDate, setDutyDate] = useState(todayLocalDate());
  const [dutyType, setDutyType] = useState<string>("Client Visit");
  const [startTime, setStartTime] = useState("10:00");
  const [endTime, setEndTime] = useState("18:00");
  const [location, setLocation] = useState("");
  const [purpose, setPurpose] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    essService.me().then((res) => setMe(res.data)).catch(() => setMe(null));
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!location.trim()) {
      setError("Please enter a location.");
      return;
    }
    if (endTime <= startTime) {
      setError("End time must be after start time.");
      return;
    }
    setLoading(true);
    try {
      const reasonParts = [
        `Time: ${startTime} – ${endTime}`,
        purpose.trim() || null,
        file ? `Attachment: ${file.name}` : null,
      ].filter(Boolean);

      await essService.createOnDuty({
        duty_date: dutyDate,
        portion: "full_day",
        duty_location: location.trim(),
        purpose: dutyType,
        reason: reasonParts.join("\n") || undefined,
      });
      router.push("/attendance/on-duty");
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Submit failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4 pb-10">
      <ModuleHeader title="Apply On Duty" backHref="/attendance/on-duty" />

      {error ? <AlertBox tone="danger">{error}</AlertBox> : null}

      <form onSubmit={onSubmit} className="space-y-4">
        <label className="block">
          <FieldLabel required>Duty Date</FieldLabel>
          <div className="relative">
            <IconCalendar
              size={18}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#2563eb]"
            />
            <input
              type="date"
              className={`${ui.input} pl-11`}
              required
              value={dutyDate}
              onChange={(e) => setDutyDate(e.target.value)}
            />
          </div>
        </label>

        <label className="block">
          <FieldLabel required>Duty Type</FieldLabel>
          <div className="relative">
            <IconBriefcase
              size={18}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#2563eb]"
            />
            <select
              className={`${ui.input} appearance-none pl-11`}
              value={dutyType}
              onChange={(e) => setDutyType(e.target.value)}
            >
              {DUTY_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
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
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              >
                {TIME_OPTIONS.filter((t) => t.value > startTime).map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
          </label>
        </div>

        <label className="block">
          <FieldLabel required>Location</FieldLabel>
          <div className="relative">
            <IconLocation
              size={18}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#2563eb]"
            />
            <input
              className={`${ui.input} pl-11`}
              required
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Client site / city"
            />
          </div>
        </label>

        <label className="block">
          <FieldLabel>Purpose</FieldLabel>
          <div className="relative">
            <IconDocument
              size={18}
              className="pointer-events-none absolute left-3.5 top-3.5 text-[#2563eb]"
            />
            <textarea
              className={`${ui.input} min-h-[100px] resize-none pl-11 pb-8`}
              value={purpose}
              maxLength={PURPOSE_MAX}
              onChange={(e) => setPurpose(e.target.value.slice(0, PURPOSE_MAX))}
              placeholder="Purpose of duty…"
            />
            <span className="pointer-events-none absolute bottom-2.5 right-3 text-[11px] tabular-nums text-[#737686]">
              {purpose.length}/{PURPOSE_MAX}
            </span>
          </div>
        </label>

        <div>
          <FieldLabel>Reporting Manager</FieldLabel>
          <div className="relative">
            <IconUser
              size={18}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#2563eb]"
            />
            <input
              className={`${ui.input} pl-11`}
              readOnly
              value={me?.manager_name || "Assigned manager"}
            />
          </div>
        </div>

        <div>
          <FieldLabel>Attachment</FieldLabel>
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
