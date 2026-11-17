"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { SubHeader } from "@/components/app-header";
import { ManagerRouteGuard } from "@/components/manager-route-guard";
import { AlertBox, EmptyState } from "@/components/ui";
import { useEssMe } from "@/context/ess-me-context";
import { ApiClientError } from "@/services/api-client";
import { essService } from "@/services/ess-service";
import type { EssApprovalItem } from "@/types/api";
import * as ui from "@/theme/classes";

const CATEGORY_LABEL: Record<EssApprovalItem["category"], string> = {
  leave: "Leave",
  on_duty: "On duty / On tour",
  compoff: "Comp off",
  attendance_correction: "Regularization",
  wfh: "WFH",
};

const GOES_TO_HR = new Set<EssApprovalItem["category"]>([
  "leave",
  "wfh",
  "on_duty",
  "attendance_correction",
  "compoff",
]);

export default function ApprovalsPage() {
  const { refresh } = useEssMe();
  const [rows, setRows] = useState<EssApprovalItem[]>([]);
  const [filter, setFilter] = useState("All");
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await essService.approvals();
    setRows((res.data ?? []).filter((row) => row.category !== "compoff"));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    load()
      .catch(() => {
        if (!cancelled) setRows([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [load]);

  const filters = useMemo(() => {
    const cats = new Set(rows.map((r) => CATEGORY_LABEL[r.category]));
    return ["All", ...Array.from(cats).sort()];
  }, [rows]);

  const visible = useMemo(() => {
    if (filter === "All") return rows;
    return rows.filter((r) => CATEGORY_LABEL[r.category] === filter);
  }, [rows, filter]);

  async function act(item: EssApprovalItem, action: "approve" | "reject") {
    const key = `${item.category}:${item.id}`;
    setActing(key);
    setError(null);
    setMessage(null);
    try {
      await essService.actOnApproval(item.category, item.id, action);
      setMessage(
        action === "approve"
          ? GOES_TO_HR.has(item.category)
            ? "Manager approved — sent to HR"
            : "Approved"
          : "Rejected",
      );
      await load();
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
        <SubHeader title="Team Approvals" backHref="/home" />

        <p className="text-sm text-[#64748B]">
          Requests from your direct reports. Your approve sends Leave, WFH, On
          duty/On tour, and Regularization to HR next in HRMS ESS Inbox.
        </p>

        {error ? <AlertBox>{error}</AlertBox> : null}
        {message ? <AlertBox tone="success">{message}</AlertBox> : null}

        <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
          {filters.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`inline-flex h-9 shrink-0 items-center rounded-full px-4 text-[13px] font-bold ${
                filter === f ? "bg-[#004ac6] text-white" : "bg-[#eff4ff] text-[#1e3a8a]"
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {loading ? (
          <EmptyState title="Loading approvals…" />
        ) : visible.length === 0 ? (
          <EmptyState title="No pending team requests" />
        ) : (
          <ul className="space-y-3">
            {visible.map((item) => {
              const key = `${item.category}:${item.id}`;
              const toHr = GOES_TO_HR.has(item.category);
              return (
                <li key={key} className={`${ui.card} space-y-3 p-4`}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-bold uppercase text-[#004ac6]">
                        {CATEGORY_LABEL[item.category]}
                      </span>
                      <p className="font-bold text-[#0b1c30]">{item.title}</p>
                      <p className="text-sm font-medium text-[#434655]">
                        {item.display_name} · {item.employee_code}
                      </p>
                    </div>
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-800">
                      {item.status}
                    </span>
                  </div>
                  <p className="text-sm text-[#434655]">{item.detail}</p>
                  {toHr ? (
                    <p className="text-xs font-medium text-[#64748B]">
                      Your approve sends this to HR for final approval in HRMS.
                    </p>
                  ) : null}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={acting === key}
                      onClick={() => void act(item, "approve")}
                      className="flex-1 rounded-lg bg-[#004ac6] py-2.5 text-sm font-bold text-white disabled:opacity-60"
                    >
                      {toHr ? "Approve → HR" : "Approve"}
                    </button>
                    <button
                      type="button"
                      disabled={acting === key}
                      onClick={() => void act(item, "reject")}
                      className="flex-1 rounded-lg border border-[#ba1a1a] py-2.5 text-sm font-bold text-[#ba1a1a] disabled:opacity-60"
                    >
                      Reject
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </ManagerRouteGuard>
  );
}
