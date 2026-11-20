"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ApplyCta,
  ModuleHeader,
  RequestListCard,
  StatusTabs,
  countByStatusTab,
} from "@/components/attendance-request-shell";
import { IconBriefcase } from "@/components/icons";
import { EmptyState } from "@/components/ui";
import {
  formatDateRange,
  isOnTourPurpose,
  matchesStatusTab,
  type StatusTab,
} from "@/lib/attendance-request-ui";
import { essService } from "@/services/ess-service";
import type { EssOnDutyRequest } from "@/types/api";

function portionLabel(portion: string): string {
  if (portion === "first_half") return "First half";
  if (portion === "second_half") return "Second half";
  return "Full day";
}

export default function OnDutyListPage() {
  const [tab, setTab] = useState<StatusTab>("all");
  const [rows, setRows] = useState<EssOnDutyRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    essService
      .listOnDuty()
      .then((res) => {
        if (cancelled) return;
        const all = (res.data as EssOnDutyRequest[]) ?? [];
        setRows(all.filter((r) => !isOnTourPurpose(r.purpose)));
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

  const filtered = useMemo(
    () => rows.filter((r) => matchesStatusTab(r.status, tab)),
    [rows, tab],
  );
  const counts = useMemo(() => countByStatusTab(rows), [rows]);

  return (
    <div className="space-y-4 pb-8">
      <ModuleHeader title="On Duty" backHref="/attendance" />

      <section className="overflow-hidden rounded-[22px] bg-gradient-to-br from-[#2563EB] via-[#1D4ED8] to-[#1E40AF] p-5 text-white shadow-[0_12px_28px_rgba(37,99,235,0.35)]">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15">
            <IconBriefcase size={24} />
          </div>
          <div>
            <h2 className="text-[20px] font-bold tracking-tight">Official Duty</h2>
            <p className="mt-1 text-[13px] leading-snug text-white/85">
              Apply and track on-duty requests when working away from the office.
            </p>
          </div>
        </div>
      </section>

      <ApplyCta href="/attendance/on-duty/apply" label="Apply On Duty" />

      <StatusTabs value={tab} onChange={setTab} counts={counts} />

      {loading ? (
        <p className="py-8 text-center text-sm text-[#434655]">Loading…</p>
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No On Duty requests"
          description="Tap Apply On Duty when working away from office."
        />
      ) : (
        <ul className="space-y-3">
          {filtered.map((r) => (
            <li key={r.id}>
              <RequestListCard
                dateYmd={r.duty_date}
                title={r.purpose || "On Duty"}
                subtitle={formatDateRange(r.duty_date, r.end_date)}
                meta={[portionLabel(r.portion), r.duty_location]
                  .filter(Boolean)
                  .join(" · ")}
                status={r.status}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
