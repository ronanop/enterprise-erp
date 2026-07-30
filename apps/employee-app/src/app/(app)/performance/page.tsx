"use client";

import { useEffect, useState } from "react";
import { AppHeader } from "@/components/app-header";
import { AiFab, EmptyState } from "@/components/ui";
import { essService } from "@/services/ess-service";
import type { EssPerformanceItem } from "@/types/api";
import * as ui from "@/theme/classes";

export default function PerformancePage() {
  const [rows, setRows] = useState<EssPerformanceItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    essService
      .performance()
      .then((res) => {
        if (!cancelled) setRows(res.data ?? []);
      })
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

  return (
    <div className="space-y-5">
      <AppHeader title="Performance" />
      {loading ? (
        <p className="text-sm text-[#434655]">Loading…</p>
      ) : rows.length === 0 ? (
        <EmptyState title="No performance reviews yet" />
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
                {r.review_cycle}
                {r.period_start && r.period_end ? ` · ${r.period_start} → ${r.period_end}` : ""}
                {r.overall_rating != null ? ` · Rating ${r.overall_rating}/5` : ""}
              </p>
            </li>
          ))}
        </ul>
      )}
      <AiFab />
    </div>
  );
}
