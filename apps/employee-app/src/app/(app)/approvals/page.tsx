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
  on_duty: "On duty",
  compoff: "Comp off",
  attendance_correction: "Attendance",
  wfh: "WFH",
};

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
    setRows(res.data ?? []);
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
      setMessage(action === "approve" ? "Approved" : "Rejected");
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
        <SubHeader title="Approvals" backHref="/home" />

        {error ? <AlertBox>{error}</AlertBox> : null}
        {message ? <AlertBox tone="success">{message}</AlertBox> : null}

        <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
          {filters.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold ${
                filter === f ? "bg-[#004ac6] text-white" : "bg-[#eff4ff] text-[#434655]"
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {loading ? (
          <EmptyState title="Loading approvals…" />
        ) : visible.length === 0 ? (
          <EmptyState title="No pending approvals" />
        ) : (
          <ul className="space-y-3">
            {visible.map((item) => {
              const key = `${item.category}:${item.id}`;
              return (
                <li key={key} className={`${ui.card} space-y-3 p-4`}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-bold uppercase text-[#004ac6]">
                        {CATEGORY_LABEL[item.category]}
                      </span>
                      <p className="font-semibold text-[#0b1c30]">{item.title}</p>
                      <p className="text-sm text-[#434655]">
                        {item.display_name} · {item.employee_code}
                      </p>
                    </div>
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-800">
                      {item.status}
                    </span>
                  </div>
                  <p className="text-sm text-[#434655]">{item.detail}</p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={acting === key}
                      onClick={() => void act(item, "approve")}
                      className="flex-1 rounded-lg bg-[#004ac6] py-2.5 text-sm font-bold text-white disabled:opacity-60"
                    >
                      Approve
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
