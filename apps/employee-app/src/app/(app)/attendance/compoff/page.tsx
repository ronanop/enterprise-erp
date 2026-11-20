"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ApplyCta,
  ModuleHeader,
  RequestListCard,
  StatusTabs,
  countByStatusTab,
} from "@/components/attendance-request-shell";
import { IconLayers } from "@/components/icons";
import { EmptyState } from "@/components/ui";
import {
  formatDateRange,
  matchesStatusTab,
  type StatusTab,
} from "@/lib/attendance-request-ui";
import { essService } from "@/services/ess-service";
import type { EssLeaveBalance, EssLeaveType } from "@/types/api";

type CompoffRow = {
  id: string;
  earned_date: string;
  extra_hours: number;
  requested_days: number;
  reason: string | null;
  status: string;
};

function num(v: string | number | null | undefined): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export default function CompOffListPage() {
  const [tab, setTab] = useState<StatusTab>("all");
  const [rows, setRows] = useState<CompoffRow[]>([]);
  const [types, setTypes] = useState<EssLeaveType[]>([]);
  const [balances, setBalances] = useState<EssLeaveBalance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      essService.listCompoff(),
      essService.leaveTypes().catch(() => ({ data: [] as EssLeaveType[] })),
      essService.leaveBalances().catch(() => ({ data: [] as EssLeaveBalance[] })),
    ])
      .then(([list, typeRes, balRes]) => {
        if (cancelled) return;
        setRows((list.data as CompoffRow[]) ?? []);
        setTypes(typeRes.data ?? []);
        setBalances(balRes.data ?? []);
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

  const balance = useMemo(() => {
    const coType = types.find((t) => {
      const code = (t.leave_type_code || "").toLowerCase();
      const name = (t.leave_type_name || "").toLowerCase();
      return (
        code.includes("comp") ||
        code.includes("coff") ||
        code === "co" ||
        name.includes("comp")
      );
    });
    if (coType) {
      const bal = balances.find((b) => b.leave_type_id === coType.id);
      if (bal) {
        return {
          closing: num(bal.closing_balance),
          earned: num(bal.accrued) + num(bal.opening_balance),
          used: num(bal.used),
        };
      }
    }
    const approved = rows.filter((r) => r.status.toLowerCase() === "approved");
    const earned = approved.reduce((s, r) => s + num(r.requested_days), 0);
    return { closing: earned, earned, used: 0 };
  }, [types, balances, rows]);

  const filtered = useMemo(
    () => rows.filter((r) => matchesStatusTab(r.status, tab)),
    [rows, tab],
  );
  const counts = useMemo(() => countByStatusTab(rows), [rows]);

  return (
    <div className="space-y-4 pb-8">
      <ModuleHeader title="Comp Off" backHref="/attendance" />

      <section className="overflow-hidden rounded-[22px] bg-gradient-to-br from-[#7C3AED] via-[#6D28D9] to-[#5B21B6] p-5 text-white shadow-[0_12px_28px_rgba(109,40,217,0.35)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[13px] font-medium text-white/80">Comp Off Balance</p>
            <p className="mt-1 text-[34px] font-bold leading-none tracking-tight">
              {balance.closing.toFixed(1)}{" "}
              <span className="text-[16px] font-semibold opacity-90">Days</span>
            </p>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15">
            <IconLayers size={22} />
          </div>
        </div>
        <div className="mt-4 flex gap-6 text-[12px] font-medium text-white/85">
          <span>
            Earned:{" "}
            <strong className="text-white">{balance.earned.toFixed(0)} Days</strong>
          </span>
          <span>
            Used:{" "}
            <strong className="text-white">{balance.used.toFixed(0)} Day
            {balance.used === 1 ? "" : "s"}</strong>
          </span>
        </div>
      </section>

      <ApplyCta href="/attendance/compoff/apply" label="Apply Comp Off" />

      <StatusTabs value={tab} onChange={setTab} counts={counts} />

      {loading ? (
        <p className="py-8 text-center text-sm text-[#434655]">Loading…</p>
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No Comp Off requests"
          description="Tap Apply Comp Off to raise a request."
        />
      ) : (
        <ul className="space-y-3">
          {filtered.map((r) => (
            <li key={r.id}>
              <RequestListCard
                dateYmd={r.earned_date}
                title={`Worked · ${formatDateRange(r.earned_date)}`}
                subtitle={`${r.extra_hours}h · ${r.requested_days} day${
                  Number(r.requested_days) === 1 ? "" : "s"
                }`}
                meta={r.reason || undefined}
                status={r.status}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
