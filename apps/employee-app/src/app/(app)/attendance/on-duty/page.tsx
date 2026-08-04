"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SubHeader } from "@/components/app-header";
import { AlertBox } from "@/components/ui";
import { ApiClientError } from "@/services/api-client";
import { essService } from "@/services/ess-service";
import type { EssMe } from "@/types/api";
import * as ui from "@/theme/classes";
import { todayLocalDate } from "@/utils/datetime";

type OnDutyRow = {
  id: string;
  duty_date: string;
  end_date: string | null;
  portion: string;
  duty_location: string | null;
  purpose: string | null;
  reason: string | null;
  status: string;
};

export default function OnDutyPage() {
  const router = useRouter();
  const [me, setMe] = useState<EssMe | null>(null);
  const [rows, setRows] = useState<OnDutyRow[]>([]);
  const [dutyDate, setDutyDate] = useState(todayLocalDate());
  const [endDate, setEndDate] = useState("");
  const [portion, setPortion] = useState("full_day");
  const [location, setLocation] = useState("");
  const [purpose, setPurpose] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function refresh() {
    const [meRes, list] = await Promise.all([
      essService.me(),
      essService.listOnDuty(),
    ]);
    setMe(meRes.data);
    setRows((list.data as OnDutyRow[]) ?? []);
  }

  useEffect(() => {
    refresh().catch((err) =>
      setError(
        err instanceof ApiClientError ? err.message : "Failed to load On Duty",
      ),
    );
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      await essService.createOnDuty({
        duty_date: dutyDate,
        end_date: endDate || undefined,
        portion,
        duty_location: location || undefined,
        purpose: purpose || undefined,
        reason: reason || undefined,
      });
      setMessage("On Duty request submitted for approval");
      setPurpose("");
      setReason("");
      setLocation("");
      await refresh();
      setTimeout(() => router.push("/attendance/history"), 900);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Submit failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <SubHeader
        title="On Duty"
        backHref="/attendance"
        name={me?.display_name}
      />

      {error ? <AlertBox>{error}</AlertBox> : null}
      {message ? <AlertBox tone="success">{message}</AlertBox> : null}

      <form onSubmit={(e) => void onSubmit(e)} className={`${ui.card} space-y-3 p-4`}>
        <p className="text-sm text-[#434655]">
          Apply for On Duty when working away from your base location.
        </p>
        <label className="block text-xs font-semibold text-[#434655]">
          Duty date
          <input
            type="date"
            className="mt-1 w-full rounded-lg border border-[#c4c6d4] px-3 py-2 text-sm"
            value={dutyDate}
            onChange={(e) => setDutyDate(e.target.value)}
            required
          />
        </label>
        <label className="block text-xs font-semibold text-[#434655]">
          End date (optional)
          <input
            type="date"
            className="mt-1 w-full rounded-lg border border-[#c4c6d4] px-3 py-2 text-sm"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </label>
        <label className="block text-xs font-semibold text-[#434655]">
          Portion
          <select
            className="mt-1 w-full rounded-lg border border-[#c4c6d4] px-3 py-2 text-sm"
            value={portion}
            onChange={(e) => setPortion(e.target.value)}
          >
            <option value="full_day">Full day</option>
            <option value="first_half">First half</option>
            <option value="second_half">Second half</option>
          </select>
        </label>
        <label className="block text-xs font-semibold text-[#434655]">
          Duty location
          <input
            className="mt-1 w-full rounded-lg border border-[#c4c6d4] px-3 py-2 text-sm"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Client site / city"
          />
        </label>
        <label className="block text-xs font-semibold text-[#434655]">
          Purpose
          <input
            className="mt-1 w-full rounded-lg border border-[#c4c6d4] px-3 py-2 text-sm"
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
          />
        </label>
        <label className="block text-xs font-semibold text-[#434655]">
          Reason
          <textarea
            className="mt-1 w-full rounded-lg border border-[#c4c6d4] px-3 py-2 text-sm"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </label>
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-[#004ac6] py-3 text-sm font-bold text-white disabled:opacity-60"
        >
          {loading ? "Submitting…" : "Submit On Duty"}
        </button>
      </form>

      <section className={`${ui.card} space-y-2 p-4`}>
        <h2 className="text-sm font-bold text-[#0b1c30]">My requests</h2>
        {!rows.length ? (
          <p className="text-sm text-[#434655]">No On Duty requests yet.</p>
        ) : (
          <ul className="space-y-2">
            {rows.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between rounded-lg border border-[#e2e2ec] px-3 py-2 text-sm"
              >
                <span>
                  {r.duty_date}
                  {r.end_date && r.end_date !== r.duty_date ? ` → ${r.end_date}` : ""}
                  {" · "}
                  {r.portion.replace("_", " ")}
                </span>
                <span className="text-xs font-semibold uppercase text-[#434655]">
                  {r.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
