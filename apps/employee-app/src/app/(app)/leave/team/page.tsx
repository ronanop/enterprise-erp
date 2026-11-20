"use client";

import { useEffect, useMemo, useState } from "react";
import { AppHeader, FilterChips } from "@/components/app-header";
import { AiFab, AlertBox, EmptyState } from "@/components/ui";
import { ManagerRouteGuard } from "@/components/manager-route-guard";
import { ApiClientError } from "@/services/api-client";
import { essService } from "@/services/ess-service";
import type { EssTeamLeaveItem } from "@/types/api";
import { leaveStatusDisplay } from "@/utils/leave-status";
import * as ui from "@/theme/classes";

const FILTERS = ["All", "Approved", "Rejected"] as const;
type TeamLeaveFilter = (typeof FILTERS)[number];

function matchesFilter(status: string, filter: TeamLeaveFilter): boolean {
  if (filter === "All") return true;
  const label = leaveStatusDisplay(status);
  if (filter === "Approved") return label === "Approved";
  return label === "Rejected";
}

export default function TeamLeaveCalendarPage() {
  const [filter, setFilter] = useState<TeamLeaveFilter>("All");
  const [rows, setRows] = useState<EssTeamLeaveItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function refresh() {
    const res = await essService.teamLeave();
    setRows(res.data ?? []);
  }

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    refresh()
      .catch(() => {
        if (!cancelled) setRows([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(
    () => rows.filter((r) => matchesFilter(r.status, filter)),
    [rows, filter],
  );

  async function act(id: string, action: "approve" | "reject") {
    setActing(id);
    setError(null);
    setMessage(null);
    try {
      if (action === "approve") await essService.managerApproveTeamLeave(id);
      else await essService.rejectTeamLeave(id);
      setMessage(action === "approve" ? "Manager approved" : "Rejected");
      await refresh();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Action failed");
    } finally {
      setActing(null);
    }
  }

  return (
    <ManagerRouteGuard>
      <div className="space-y-5">
        <AppHeader title="Team Leave" />

        <FilterChips
          options={[...FILTERS]}
          value={filter}
          onChange={(v) => setFilter(v as TeamLeaveFilter)}
        />

        {error ? <AlertBox>{error}</AlertBox> : null}
        {message ? <AlertBox tone="success">{message}</AlertBox> : null}

        {loading ? (
          <p className="text-sm text-[#434655]">Loading…</p>
        ) : filtered.length === 0 ? (
          <EmptyState
            title={
              filter === "Rejected"
                ? "No rejected team leave"
                : filter === "Approved"
                  ? "No approved team leave"
                  : "No team leave found"
            }
          />
        ) : (
          <ul className="space-y-3">
            {filtered.map((r) => {
              const label = leaveStatusDisplay(r.status);
              return (
                <li key={r.id} className={`${ui.card} space-y-2 p-4`}>
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="font-semibold text-[#0b1c30]">
                        {r.display_name}
                      </p>
                      <p className="text-xs text-[#434655]">{r.employee_code}</p>
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${
                        label === "Rejected"
                          ? "bg-[#ffdad6] text-[#ba1a1a]"
                          : label === "Approved"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-[#e5eeff] text-[#004ac6]"
                      }`}
                    >
                      {label}
                    </span>
                  </div>
                  <p className="text-sm text-[#434655]">
                    {r.start_date} → {r.end_date} · {r.days_count} day(s)
                  </p>
                  <p className="text-xs text-[#434655]">{r.document_number}</p>
                  {r.status === "submitted" ? (
                    <div className="flex gap-2 pt-1">
                      <button
                        type="button"
                        disabled={acting === r.id}
                        onClick={() => void act(r.id, "approve")}
                        className="flex-1 rounded-lg bg-[#004ac6] py-2 text-xs font-bold text-white disabled:opacity-60"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        disabled={acting === r.id}
                        onClick={() => void act(r.id, "reject")}
                        className="flex-1 rounded-lg border border-[#ba1a1a] py-2 text-xs font-bold text-[#ba1a1a] disabled:opacity-60"
                      >
                        Reject
                      </button>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}

        <AiFab />
      </div>
    </ManagerRouteGuard>
  );
}
