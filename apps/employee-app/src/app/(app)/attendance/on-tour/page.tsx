"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ApplyCta,
  ModuleHeader,
  RequestListCard,
  StatusTabs,
  countByStatusTab,
} from "@/components/attendance-request-shell";
import { IconPlane } from "@/components/icons";
import { EmptyState } from "@/components/ui";
import {
  formatDateRange,
  isOnTourPurpose,
  matchesStatusTab,
  stripTourPrefix,
  type StatusTab,
} from "@/lib/attendance-request-ui";
import { essService } from "@/services/ess-service";

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

export default function OnTourListPage() {
  const [tab, setTab] = useState<StatusTab>("all");
  const [rows, setRows] = useState<OnDutyRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    essService
      .listOnDuty()
      .then((res) => {
        if (cancelled) return;
        const all = (res.data as OnDutyRow[]) ?? [];
        setRows(all.filter((r) => isOnTourPurpose(r.purpose)));
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
      <ModuleHeader title="On Tour" backHref="/attendance" />

      <section className="overflow-hidden rounded-[22px] bg-gradient-to-br from-[#F97316] via-[#EA580C] to-[#C2410C] p-5 text-white shadow-[0_12px_28px_rgba(234,88,12,0.35)]">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15">
            <IconPlane size={24} />
          </div>
          <div>
            <h2 className="text-[20px] font-bold tracking-tight">Business Travel</h2>
            <p className="mt-1 text-[13px] leading-snug text-white/85">
              Track your travel requests and approval status.
            </p>
          </div>
        </div>
      </section>

      <ApplyCta href="/attendance/on-tour/apply" label="Apply On Tour" />

      <StatusTabs value={tab} onChange={setTab} counts={counts} />

      {loading ? (
        <p className="py-8 text-center text-sm text-[#434655]">Loading…</p>
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No On Tour requests"
          description="Tap Apply On Tour for business travel approval."
        />
      ) : (
        <ul className="space-y-3">
          {filtered.map((r) => (
            <li key={r.id}>
              <RequestListCard
                dateYmd={r.duty_date}
                title={stripTourPrefix(r.purpose) || "Business Travel"}
                subtitle={formatDateRange(r.duty_date, r.end_date)}
                meta={r.duty_location || undefined}
                status={r.status}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
