"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AttachBox,
  FieldLabel,
  ModuleHeader,
} from "@/components/attendance-request-shell";
import {
  IconCalendar,
  IconDocument,
  IconLocation,
  IconPlane,
} from "@/components/icons";
import { AlertBox } from "@/components/ui";
import { TOUR_PURPOSE_PREFIX } from "@/lib/attendance-request-ui";
import { ApiClientError } from "@/services/api-client";
import { essService } from "@/services/ess-service";
import { todayLocalDate } from "@/utils/datetime";
import * as ui from "@/theme/classes";

const REASON_MAX = 500;
const TRAVEL_PURPOSES = [
  "Client Meeting",
  "Conference",
  "Training",
  "Branch Visit",
  "Other",
] as const;
const TRAVEL_MODES = ["Flight", "Train", "Bus", "Car", "Other"] as const;

export default function ApplyOnTourPage() {
  const router = useRouter();
  const [travelPurpose, setTravelPurpose] = useState<string>("Client Meeting");
  const [fromPlace, setFromPlace] = useState("");
  const [toPlace, setToPlace] = useState("");
  const [departure, setDeparture] = useState(todayLocalDate());
  const [returnDate, setReturnDate] = useState(todayLocalDate());
  const [travelMode, setTravelMode] = useState<string>("Flight");
  const [accommodation, setAccommodation] = useState<"required" | "not_required">(
    "required",
  );
  const [reason, setReason] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!fromPlace.trim() || !toPlace.trim()) {
      setError("Please enter From and To locations.");
      return;
    }
    if (returnDate < departure) {
      setError("Return date must be on or after departure.");
      return;
    }
    setLoading(true);
    try {
      const reasonParts = [
        `Mode: ${travelMode}`,
        `Accommodation: ${accommodation === "required" ? "Required" : "Not Required"}`,
        reason.trim() || null,
        file ? `Attachment: ${file.name}` : null,
      ].filter(Boolean);

      await essService.createOnDuty({
        duty_date: departure,
        end_date: returnDate,
        portion: "full_day",
        duty_location: `${fromPlace.trim()} → ${toPlace.trim()}`,
        purpose: `${TOUR_PURPOSE_PREFIX}${travelPurpose}`,
        reason: reasonParts.join("\n") || undefined,
      });
      router.push("/attendance/on-tour");
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Submit failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4 pb-10">
      <ModuleHeader title="Apply On Tour" backHref="/attendance/on-tour" />

      {error ? <AlertBox tone="danger">{error}</AlertBox> : null}

      <form onSubmit={onSubmit} className="space-y-4">
        <label className="block">
          <FieldLabel required>Travel Purpose</FieldLabel>
          <div className="relative">
            <IconPlane
              size={18}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#2563eb]"
            />
            <select
              className={`${ui.input} appearance-none pl-11`}
              value={travelPurpose}
              onChange={(e) => setTravelPurpose(e.target.value)}
            >
              {TRAVEL_PURPOSES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <FieldLabel required>From</FieldLabel>
            <div className="relative">
              <IconLocation
                size={16}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#2563eb]"
              />
              <input
                className={`${ui.input} pl-9`}
                required
                value={fromPlace}
                onChange={(e) => setFromPlace(e.target.value)}
                placeholder="City"
              />
            </div>
          </label>
          <label className="block">
            <FieldLabel required>To</FieldLabel>
            <div className="relative">
              <IconLocation
                size={16}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#2563eb]"
              />
              <input
                className={`${ui.input} pl-9`}
                required
                value={toPlace}
                onChange={(e) => setToPlace(e.target.value)}
                placeholder="City"
              />
            </div>
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <FieldLabel required>Departure Date</FieldLabel>
            <div className="relative">
              <IconCalendar
                size={16}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#2563eb]"
              />
              <input
                type="date"
                className={`${ui.input} pl-9 text-[13px]`}
                required
                value={departure}
                onChange={(e) => setDeparture(e.target.value)}
              />
            </div>
          </label>
          <label className="block">
            <FieldLabel required>Return Date</FieldLabel>
            <div className="relative">
              <IconCalendar
                size={16}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#2563eb]"
              />
              <input
                type="date"
                className={`${ui.input} pl-9 text-[13px]`}
                required
                min={departure}
                value={returnDate}
                onChange={(e) => setReturnDate(e.target.value)}
              />
            </div>
          </label>
        </div>

        <label className="block">
          <FieldLabel required>Travel Mode</FieldLabel>
          <select
            className={ui.input}
            value={travelMode}
            onChange={(e) => setTravelMode(e.target.value)}
          >
            {TRAVEL_MODES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>

        <div>
          <FieldLabel required>Accommodation</FieldLabel>
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                { key: "required", label: "Required" },
                { key: "not_required", label: "Not Required" },
              ] as const
            ).map((opt) => {
              const active = accommodation === opt.key;
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setAccommodation(opt.key)}
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
          <FieldLabel>Reason / Details</FieldLabel>
          <div className="relative">
            <IconDocument
              size={18}
              className="pointer-events-none absolute left-3.5 top-3.5 text-[#2563eb]"
            />
            <textarea
              className={`${ui.input} min-h-[100px] resize-none pl-11 pb-8`}
              value={reason}
              maxLength={REASON_MAX}
              onChange={(e) => setReason(e.target.value.slice(0, REASON_MAX))}
              placeholder="Travel details…"
            />
            <span className="pointer-events-none absolute bottom-2.5 right-3 text-[11px] tabular-nums text-[#737686]">
              {reason.length}/{REASON_MAX}
            </span>
          </div>
        </label>

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
