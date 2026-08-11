"use client";

import { FormEvent, useEffect, useState } from "react";
import { AppHeader } from "@/components/app-header";
import { AlertBox, AiFab, EmptyState } from "@/components/ui";
import { ApiClientError } from "@/services/api-client";
import { essService } from "@/services/ess-service";
import type { EssSeparationItem } from "@/types/api";
import * as ui from "@/theme/classes";

export default function SeparationPage() {
  const [rows, setRows] = useState<EssSeparationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [lwd, setLwd] = useState("");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function reload() {
    setLoading(true);
    try {
      const res = await essService.separation();
      setRows(res.data ?? []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      await essService.createSeparation({
        separation_type: "resignation",
        requested_last_working_date: lwd,
        reason: reason || undefined,
      });
      setMessage("Resignation request created");
      setLwd("");
      setReason("");
      await reload();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to submit");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-5">
      <AppHeader title="Separation" />
      {message ? <AlertBox tone="success">{message}</AlertBox> : null}
      {error ? <AlertBox>{error}</AlertBox> : null}

      <form onSubmit={onSubmit} className={`${ui.card} space-y-3 p-4`}>
        <h2 className="text-lg font-semibold text-[#0b1c30]">Request resignation</h2>
        <label className="block space-y-1 text-sm font-semibold text-[#434655]">
          Last working day
          <input
            type="date"
            required
            className={ui.input}
            value={lwd}
            onChange={(e) => setLwd(e.target.value)}
          />
        </label>
        <label className="block space-y-1 text-sm font-semibold text-[#434655]">
          Reason
          <textarea
            className={`${ui.input} min-h-[80px] resize-none`}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Optional"
          />
        </label>
        <button className={`${ui.btn} w-full`} disabled={submitting || !lwd}>
          {submitting ? "Submitting…" : "Submit request"}
        </button>
      </form>

      {loading ? (
        <p className="text-sm text-[#434655]">Loading…</p>
      ) : rows.length === 0 ? (
        <EmptyState title="No separation requests" />
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.id} className={`${ui.card} space-y-1 p-4`}>
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold text-[#0b1c30]">{r.document_number}</p>
                <span className="rounded-full bg-[#e5eeff] px-2.5 py-1 text-[10px] font-bold uppercase text-[#004ac6]">
                  {r.status}
                </span>
              </div>
              <p className="text-xs text-[#434655]">
                {r.separation_type} · LWD {r.requested_last_working_date}
                {r.fnf_status ? ` · FNF ${r.fnf_status}` : ""}
              </p>
            </li>
          ))}
        </ul>
      )}
      <AiFab />
    </div>
  );
}
