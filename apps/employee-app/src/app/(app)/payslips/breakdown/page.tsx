"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { IconEye, IconEyeOff } from "@/components/icons";
import { AlertBox, EmptyState } from "@/components/ui";
import { ApiClientError } from "@/services/api-client";
import { essService } from "@/services/ess-service";
import type { EssMe, EssPayslip } from "@/types/api";
import * as ui from "@/theme/classes";
import { formatDateTime } from "@/utils/datetime";

type MoneyLine = { label: string; amount: number };

function money(value: number, hidden: boolean, prefix = "₹") {
  if (hidden) return "••••";
  return `${prefix}${value.toLocaleString("en-IN")}`;
}

function humanizeKey(key: string) {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function toMoneyLines(source: unknown): MoneyLine[] {
  if (Array.isArray(source)) {
    return source
      .map((row) => {
        const item = row as { label?: string; code?: string; amount?: number };
        const amount = Number(item.amount) || 0;
        const label =
          (item.label && String(item.label).trim()) ||
          (item.code ? humanizeKey(String(item.code)) : "Item");
        return { label, amount };
      })
      .filter((row) => row.amount !== 0 || /basic/i.test(row.label));
  }
  if (source && typeof source === "object") {
    return Object.entries(source as Record<string, unknown>)
      .map(([key, value]) => ({
        label: humanizeKey(key),
        amount: Number(value) || 0,
      }))
      .filter((row) => row.amount !== 0);
  }
  return [];
}

function periodLabel(slip: EssPayslip) {
  if (slip.period_name) return slip.period_name;
  if (slip.period_start && slip.period_end) {
    return `${slip.period_start} → ${slip.period_end}`;
  }
  if (slip.issued_at) {
    return new Date(slip.issued_at).toLocaleDateString("en-IN", {
      month: "long",
      year: "numeric",
    });
  }
  return slip.document_number;
}

export default function SalaryBreakdownPage() {
  const [me, setMe] = useState<EssMe | null>(null);
  const [list, setList] = useState<EssPayslip[]>([]);
  const [index, setIndex] = useState(0);
  const [detail, setDetail] = useState<EssPayslip | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([essService.payslips(), essService.me()])
      .then(([pay, meRes]) => {
        if (cancelled) return;
        const rows = pay.data ?? [];
        setList(rows);
        setMe(meRes.data);
        setIndex(0);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(
            err instanceof ApiClientError
              ? err.message
              : "Failed to load salary",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const summary = list[index] ?? null;

  const loadDetail = useCallback(async (id: string) => {
    setDetailLoading(true);
    try {
      const res = await essService.payslip(id);
      setDetail(res.data);
    } catch (err) {
      setDetail(null);
      setError(
        err instanceof ApiClientError
          ? err.message
          : "Failed to load payslip detail",
      );
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!summary?.id) {
      setDetail(null);
      return;
    }
    void loadDetail(summary.id);
  }, [summary?.id, loadDetail]);

  const slip = detail ?? summary;

  const parsed = useMemo(() => {
    if (!slip) {
      return {
        net: 0,
        gross: 0,
        deductionsTotal: 0,
        earnings: [] as MoneyLine[],
        deductions: [] as MoneyLine[],
        attendance: {} as Record<string, unknown>,
      };
    }

    const pj = (slip.payslip_json ?? {}) as Record<string, unknown>;
    const earnings = toMoneyLines(slip.earnings ?? pj.earnings);
    const deductions = toMoneyLines(slip.deductions ?? pj.deductions);
    const grossFromLines = earnings.reduce((s, r) => s + r.amount, 0);
    const dedFromLines = deductions.reduce((s, r) => s + r.amount, 0);
    const gross = Number(slip.gross_salary) || grossFromLines;
    const deductionsTotal = Number(slip.total_deductions) || dedFromLines;
    const net =
      Number(slip.net_salary) || Math.max(0, gross - deductionsTotal);
    const attendance =
      slip.attendance_summary ??
      (pj.attendance as Record<string, unknown> | undefined) ??
      {};

    return {
      net,
      gross,
      deductionsTotal,
      earnings:
        earnings.length > 0
          ? earnings
          : gross
            ? [{ label: "Gross earnings", amount: gross }]
            : [],
      deductions:
        deductions.length > 0
          ? deductions
          : deductionsTotal
            ? [{ label: "Total deductions", amount: deductionsTotal }]
            : [],
      attendance,
    };
  }, [slip]);

  const periodDays = Number(parsed.attendance.period_days ?? 0);
  const leaveDays = Number(
    parsed.attendance.leave_days ?? parsed.attendance.paid_leave ?? 0,
  );
  const lopDays = Number(parsed.attendance.lop_days ?? 0);

  const canPrev = index < list.length - 1;
  const canNext = index > 0;

  return (
    <div className="space-y-5 pb-4">
      <AppHeader title="Salary Breakdown" name={me?.display_name} />

      {error ? <AlertBox>{error}</AlertBox> : null}

      {loading ? (
        <p className="py-12 text-center text-sm text-[#737686]">
          Loading salary…
        </p>
      ) : !summary ? (
        <EmptyState
          title="No payslips yet"
          description="When payroll publishes a slip, the breakdown will appear here."
        />
      ) : (
        <>
          <div
            className={`${ui.cardSoft} flex items-center justify-between px-4 py-3`}
          >
            <button
              type="button"
              className="px-2 text-lg font-bold text-[#004ac6] disabled:opacity-30"
              disabled={!canPrev}
              aria-label="Older period"
              onClick={() => setIndex((i) => Math.min(list.length - 1, i + 1))}
            >
              ‹
            </button>
            <div className="min-w-0 text-center">
              <p className="truncate font-semibold text-[#0b1c30]">
                {periodLabel(summary)}
              </p>
              <p className="text-[11px] text-[#64748B]">
                {summary.document_number}
              </p>
            </div>
            <button
              type="button"
              className="px-2 text-lg font-bold text-[#004ac6] disabled:opacity-30"
              disabled={!canNext}
              aria-label="Newer period"
              onClick={() => setIndex((i) => Math.max(0, i - 1))}
            >
              ›
            </button>
          </div>

          <section className={`${ui.cardPeach} p-5`}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-white/70">
                  Net take home
                </p>
                <p className="mt-2 text-4xl font-bold text-white">
                  {money(parsed.net, hidden)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setHidden((v) => !v)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white"
                aria-label={hidden ? "Show amounts" : "Hide amounts"}
              >
                {hidden ? <IconEyeOff size={16} /> : <IconEye size={16} />}
              </button>
            </div>
            <div className="mt-5 grid grid-cols-2 divide-x divide-white/20">
              <div className="pr-3">
                <p className="text-xs text-white/70">Total earnings (A)</p>
                <p className="font-bold text-white">
                  {money(parsed.gross, hidden)}
                </p>
              </div>
              <div className="pl-3">
                <p className="text-xs text-white/70">Total deductions (B)</p>
                <p className="font-bold text-white">
                  {money(parsed.deductionsTotal, hidden, "-₹")}
                </p>
              </div>
            </div>
            {detailLoading ? (
              <p className="mt-3 text-xs text-white/75">Updating slip lines…</p>
            ) : null}
          </section>

          <section className={`${ui.card} space-y-1 p-4`}>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="font-semibold text-[#0b1c30]">Earnings (A)</h2>
              <span className="text-xs font-semibold text-[#004ac6]">
                {money(parsed.gross, hidden)}
              </span>
            </div>
            {parsed.earnings.map((row) => (
              <PayRow
                key={`e-${row.label}`}
                label={row.label}
                amount={row.amount}
                hidden={hidden}
              />
            ))}
            <div className="mt-2 flex items-center justify-between border-t border-[#c3c6d7]/40 pt-2 text-sm font-bold text-[#0b1c30]">
              <span>Total earnings (A)</span>
              <span>{money(parsed.gross, hidden)}</span>
            </div>
          </section>

          <section className={`${ui.card} space-y-1 p-4`}>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="font-semibold text-[#0b1c30]">Deductions (B)</h2>
              <span className="text-xs font-semibold text-[#ba1a1a]">
                {money(parsed.deductionsTotal, hidden, "-₹")}
              </span>
            </div>
            {parsed.deductions.length === 0 ? (
              <p className="py-2 text-sm text-[#737686]">No deductions</p>
            ) : (
              parsed.deductions.map((row) => (
                <PayRow
                  key={`d-${row.label}`}
                  label={row.label}
                  amount={row.amount}
                  hidden={hidden}
                  negative
                />
              ))
            )}
            <div className="mt-2 flex items-center justify-between border-t border-[#c3c6d7]/40 pt-2 text-sm font-bold text-[#0b1c30]">
              <span>Total deductions (B)</span>
              <span className="text-[#ba1a1a]">
                {money(parsed.deductionsTotal, hidden, "-₹")}
              </span>
            </div>
          </section>

          <section className="rounded-2xl bg-[#eff4ff] p-4">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-[#004ac6]">Net pay (A − B)</p>
              <p className="text-lg font-bold text-[#004ac6]">
                {money(parsed.net, hidden)}
              </p>
            </div>
          </section>

          <section className={`${ui.card} p-4`}>
            <h2 className="mb-3 font-semibold text-[#0b1c30]">
              Attendance period
            </h2>
            <div className="grid grid-cols-3 divide-x divide-[#c3c6d7]/40 text-center">
              <Stat
                value={periodDays ? String(periodDays) : "—"}
                label="Scheduled"
                color="text-[#004ac6]"
              />
              <Stat
                value={String(leaveDays)}
                label="Leave"
                color="text-[#10B981]"
              />
              <Stat
                value={String(lopDays)}
                label="LOP / CLWP"
                color="text-[#0b1c30]"
              />
            </div>
          </section>

          <div className="flex items-center justify-between text-xs text-[#64748B]">
            <span className="capitalize">{summary.status}</span>
            <span>
              Issued{" "}
              {summary.issued_at ? formatDateTime(summary.issued_at) : "—"}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Link
              href="/payslips/history"
              className={`${ui.btnSecondary} text-center`}
            >
              History
            </Link>
            <Link
              href={`/payslips/${summary.id}`}
              className={`${ui.btn} text-center`}
            >
              Full payslip
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

function PayRow({
  label,
  amount,
  hidden,
  negative = false,
}: {
  label: string;
  amount: number;
  hidden: boolean;
  negative?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-1.5 text-sm">
      <span className="pr-3 text-[#434655]">{label}</span>
      <span
        className={`shrink-0 font-semibold tabular-nums ${
          negative ? "text-[#ba1a1a]" : "text-[#0b1c30]"
        }`}
      >
        {money(amount, hidden, negative ? "-₹" : "₹")}
      </span>
    </div>
  );
}

function Stat({
  value,
  label,
  color,
}: {
  value: string;
  label: string;
  color: string;
}) {
  return (
    <div className="px-2">
      <p className={`text-xl font-bold ${color}`}>{value}</p>
      <p className="text-[10px] text-[#434655]">{label}</p>
    </div>
  );
}
