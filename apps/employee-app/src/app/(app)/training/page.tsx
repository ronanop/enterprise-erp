"use client";

import { useEffect, useState } from "react";
import { AppHeader } from "@/components/app-header";
import { AiFab, EmptyState } from "@/components/ui";
import { essService } from "@/services/ess-service";
import type { EssTrainingItem } from "@/types/api";
import * as ui from "@/theme/classes";

export default function TrainingPage() {
  const [rows, setRows] = useState<EssTrainingItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    essService
      .training()
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
      <AppHeader title="My Training" />
      {loading ? (
        <p className="text-sm text-[#434655]">Loading…</p>
      ) : rows.length === 0 ? (
        <EmptyState title="No training assigned" />
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.id} className={`${ui.card} space-y-1 p-4`}>
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold text-[#0b1c30]">{r.training_name}</p>
                <span className="rounded-full bg-[#e5eeff] px-2.5 py-1 text-[10px] font-bold uppercase text-[#004ac6]">
                  {r.attendance_status}
                </span>
              </div>
              <p className="text-xs text-[#434655]">
                {r.training_code}
                {r.start_date ? ` · ${r.start_date}` : ""}
                {r.training_type ? ` · ${r.training_type}` : ""}
              </p>
            </li>
          ))}
        </ul>
      )}
      <AiFab />
    </div>
  );
}
