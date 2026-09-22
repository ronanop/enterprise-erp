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

type CompoffRow = {
  id: string;
  earned_date: string;
  extra_hours: number;
  requested_days: number;
  reason: string | null;
  status: string;
};

export default function CompOffRequestPage() {
  const router = useRouter();
  const [me, setMe] = useState<EssMe | null>(null);
  const [rows, setRows] = useState<CompoffRow[]>([]);
  const [earnedDate, setEarnedDate] = useState(todayLocalDate());
  const [extraHours, setExtraHours] = useState("8");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function refresh() {
    const [meRes, list] = await Promise.all([
      essService.me(),
      essService.listCompoff(),
    ]);
    setMe(meRes.data);
    setRows((list.data as CompoffRow[]) ?? []);
  }

  useEffect(() => {
    refresh().catch((err) =>
      setError(
        err instanceof ApiClientError ? err.message : "Failed to load Comp Off",
      ),
    );
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      await essService.createCompoff({
        earned_date: earnedDate,
        extra_hours: Number(extraHours),
        reason: reason || undefined,
      });
      setMessage("Comp Off request submitted for manager → HR approval");
      setReason("");
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
        title="Comp Off"
        backHref="/attendance"
        name={me?.display_name}
      />

      {error ? <AlertBox>{error}</AlertBox> : null}
      {message ? <AlertBox tone="success">{message}</AlertBox> : null}

      <form onSubmit={(e) => void onSubmit(e)} className={`${ui.card} space-y-3 p-4`}>
        <p className="text-sm text-[#434655]">
          Request Comp Off allocation for extra hours. Manager approves first, then HR credits
          leave balance.
        </p>
        <label className="block text-xs font-semibold text-[#434655]">
          Earned date
          <input
            type="date"
            className="mt-1 w-full rounded-lg border border-[#c4c6d4] px-3 py-2 text-sm"
            value={earnedDate}
            onChange={(e) => setEarnedDate(e.target.value)}
            required
          />
        </label>
        <label className="block text-xs font-semibold text-[#434655]">
          Extra hours
          <input
            type="number"
            min="0.5"
            step="0.5"
            className="mt-1 w-full rounded-lg border border-[#c4c6d4] px-3 py-2 text-sm"
            value={extraHours}
            onChange={(e) => setExtraHours(e.target.value)}
            required
          />
        </label>
        <label className="block text-xs font-semibold text-[#434655]">
          Reason
          <textarea
            className="mt-1 w-full rounded-lg border border-[#c4c6d4] px-3 py-2 text-sm"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="OT / week-off work details"
          />
        </label>
        <button type="submit" className={`${ui.btn} w-full`} disabled={loading}>
          {loading ? "Submitting…" : "Submit Comp Off request"}
        </button>
      </form>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-[#0b1c30]">Your requests</h3>
        {!rows.length ? (
          <p className="text-sm text-[#434655]">No Comp Off requests yet.</p>
        ) : (
          <ul className="space-y-2">
            {rows.map((r) => (
              <li key={r.id} className={`${ui.card} flex justify-between gap-2 p-3 text-sm`}>
                <span>
                  {r.earned_date} · {r.extra_hours}h → {r.requested_days}d
                </span>
                <span className="text-xs font-semibold uppercase text-[#004ac6]">
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
