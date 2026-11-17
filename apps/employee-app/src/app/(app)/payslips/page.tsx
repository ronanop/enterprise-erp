"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import {
  IconBank,
  IconCalendar,
  IconCheck,
  IconChevronRight,
  IconDocument,
  IconDownload,
  IconEye,
  IconEyeOff,
  IconInfo,
  IconWallet,
} from "@/components/icons";
import { AlertBox, EmptyState } from "@/components/ui";
import {
  formatInr,
  parsePayslipLines,
  periodLabel,
  type MoneyLine,
} from "@/lib/payslip-display";
import { ApiClientError } from "@/services/api-client";
import { essService } from "@/services/ess-service";
import type { EssMe, EssPayslip } from "@/types/api";

function formatInrParts(value: number | string, hidden: boolean) {
  if (hidden) return { main: "₹ ••••••••", frac: "" };
  const n = Number(value) || 0;
  const [whole, frac = "00"] = n
    .toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
    .split(".");
  return { main: `₹ ${whole}`, frac: `.${frac}` };
}

function shortInrLakhs(value: number) {
  if (value >= 100000) return `${(value / 100000).toFixed(2).replace(/\.?0+$/, "")}L`;
  if (value >= 1000) return `${Math.round(value / 1000)}K`;
  return String(Math.round(value));
}

function monthShort(slip: EssPayslip) {
  const raw = slip.period_start || slip.issued_at;
  if (!raw) return "—";
  return new Date(raw).toLocaleDateString("en-IN", { month: "short" }).toUpperCase();
}

function disbursedLabel(slip: EssPayslip) {
  if (!slip.issued_at) return slip.payment_status || "Pending";
  const d = new Date(slip.issued_at);
  return `Disbursed ${d.toLocaleDateString("en-IN", { month: "short", day: "numeric" })}`;
}

function fiscalYearLabel(slip: EssPayslip | undefined) {
  const raw = slip?.period_start || slip?.issued_at;
  const d = raw ? new Date(raw) : new Date();
  const y = d.getFullYear();
  const m = d.getMonth(); // 0-based; FY Apr–Mar in India
  const start = m >= 3 ? y : y - 1;
  const end = String(start + 1).slice(-2);
  return `FY ${start}-${end}`;
}

function isBonusLine(line: MoneyLine) {
  return /bonus|incentive|variable/i.test(line.label);
}

function hasAdjustment(slip: EssPayslip) {
  const pj = (slip.payslip_json ?? {}) as Record<string, unknown>;
  if (pj.adjustment || pj.has_adjustment) return true;
  const earnings = slip.earnings ?? (pj.earnings as unknown);
  if (Array.isArray(earnings)) {
    return earnings.some((row) => {
      const label = String((row as { label?: string; code?: string }).label || (row as { code?: string }).code || "");
      return /adj|bonus|arrear/i.test(label);
    });
  }
  return false;
}

async function downloadPayslip(slip: EssPayslip) {
  const { downloadEssPayslip } = await import("@/lib/download-ess-payslip");
  await downloadEssPayslip(slip);
}

export default function PayslipsPage() {
  const [me, setMe] = useState<EssMe | null>(null);
  const [rows, setRows] = useState<EssPayslip[]>([]);
  const [detail, setDetail] = useState<EssPayslip | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [masked, setMasked] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const breakdownRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([essService.payslips(), essService.me()])
      .then(async ([pay, meRes]) => {
        if (cancelled) return;
        const list = pay.data ?? [];
        setRows(list);
        setMe(meRes.data);
        if (list[0]?.id) {
          try {
            const full = await essService.payslip(list[0].id);
            if (!cancelled) setDetail(full.data);
          } catch {
            if (!cancelled) setDetail(list[0]);
          }
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(
            err instanceof ApiClientError
              ? err.message
              : "Failed to load payslips",
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

  const latest = detail ?? rows[0] ?? null;
  const recent = rows.slice(0, 3);
  const trend = useMemo(() => {
    const slice = [...rows].slice(0, 6).reverse();
    const amounts = slice.map((r) => Number(r.net_salary) || 0);
    const max = Math.max(...amounts, 1);
    const avg =
      amounts.length > 0
        ? amounts.reduce((s, n) => s + n, 0) / amounts.length
        : 0;
    let ytdPct: number | null = null;
    if (amounts.length >= 2) {
      const first = amounts[0];
      const last = amounts[amounts.length - 1];
      if (first > 0) ytdPct = ((last - first) / first) * 100;
    }
    return {
      bars: slice.map((r, i) => ({
        id: r.id,
        label: monthShort(r),
        amount: amounts[i],
        height: Math.max(18, Math.round((amounts[i] / max) * 84)),
        active: i === slice.length - 1,
      })),
      avg,
      ytdPct,
    };
  }, [rows]);

  const parsed = useMemo(
    () => (latest ? parsePayslipLines(latest) : null),
    [latest],
  );

  const netParts = formatInrParts(parsed?.net ?? latest?.net_salary ?? 0, masked);
  const fy = fiscalYearLabel(latest ?? undefined);
  const periodShort = latest
    ? new Date(
        latest.period_start || latest.issued_at || Date.now(),
      ).toLocaleDateString("en-IN", { month: "short" })
    : "";

  async function onDownloadLatest() {
    if (!latest) return;
    setDownloading(true);
    setError(null);
    try {
      await downloadPayslip(latest);
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Download failed",
      );
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="space-y-4 pb-2">
      <AppHeader title="Salary" name={me?.display_name} />

      {error ? <AlertBox>{error}</AlertBox> : null}

      {loading ? (
        <p className="py-12 text-center text-sm text-[#737686]">
          Loading salary…
        </p>
      ) : !latest || !parsed ? (
        <EmptyState
          title="No payslips yet"
          description="When payroll issues a slip, it will appear here."
          icon={<IconDocument size={20} />}
        />
      ) : (
        <>
          {/* Filters */}
          <div className="flex items-center justify-between gap-2 pt-0.5">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-[#0b1c30] shadow-sm">
                INR (₹)
              </span>
              <span className="rounded-full bg-[#dde9ff] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[#434654]">
                {fy}
              </span>
            </div>
            <Link
              href="/payslips/history"
              className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-[#004ac6] shadow-sm transition active:scale-95"
            >
              <IconDocument size={14} />
              Statement
            </Link>
          </div>

          {/* Net payout hero */}
          <section className="relative min-h-[220px] overflow-hidden rounded-2xl bg-[#213146] p-5 text-[#ebf1ff] shadow-xl">
            <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-[#004ac6]/30 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-12 -left-12 h-40 w-40 rounded-full bg-[#712ae2]/20 blur-2xl" />

            <div className="relative z-10 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-[#52e1a6]" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#d3e3ff]">
                    {periodLabel(latest)} Net Payout
                  </span>
                </div>
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold text-[#d3e3ff]">
                  {disbursedLabel(latest)}
                </span>
              </div>

              <div className="flex items-baseline justify-between gap-2 pt-1">
                <div className="flex items-baseline gap-1">
                  <span className="text-[36px] font-bold leading-[44px] tracking-tight text-white">
                    {netParts.main}
                  </span>
                  {netParts.frac ? (
                    <span className="text-xs text-[#d3e3ff]">{netParts.frac}</span>
                  ) : null}
                </div>
                <button
                  type="button"
                  aria-label={masked ? "Show amount" : "Hide amount"}
                  onClick={() => setMasked((v) => !v)}
                  className="rounded-full p-2 text-[#d3e3ff] transition hover:bg-white/10 hover:text-white active:scale-90"
                >
                  {masked ? <IconEyeOff size={22} /> : <IconEye size={22} />}
                </button>
              </div>

              <div className="flex items-center justify-between rounded-xl bg-white/5 p-3 text-sm backdrop-blur-md">
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold uppercase tracking-wide text-[#d3e3ff]">
                    Gross Earnings
                  </span>
                  <span className="text-base font-semibold text-white">
                    {masked ? "₹ ••••••" : formatInr(parsed.gross).replace("₹", "₹ ")}
                  </span>
                </div>
                <div className="mx-3 h-6 w-px bg-white/10" />
                <div className="flex flex-col items-end">
                  <span className="text-[10px] font-bold uppercase tracking-wide text-[#d3e3ff]">
                    Total Deductions
                  </span>
                  <span className="text-base font-semibold text-[#ffdad6]">
                    {masked
                      ? "-₹ ••••••"
                      : `-${formatInr(parsed.deductionsTotal).replace("₹", "₹ ")}`}
                  </span>
                </div>
              </div>
            </div>

            <div className="relative z-10 mt-4 grid grid-cols-2 gap-2.5">
              <button
                type="button"
                disabled={downloading}
                onClick={() => void onDownloadLatest()}
                className="flex items-center justify-center gap-2 rounded-xl bg-[#004ac6] px-3 py-2.5 text-xs font-semibold text-white shadow-md transition active:scale-[0.98] disabled:opacity-60"
              >
                <IconDownload size={16} />
                <span className="truncate">
                  {downloading
                    ? "Preparing…"
                    : `${periodShort || "Latest"} Payslip`}
                </span>
              </button>
              <button
                type="button"
                onClick={() =>
                  breakdownRef.current?.scrollIntoView({
                    behavior: "smooth",
                    block: "start",
                  })
                }
                className="flex items-center justify-center gap-1.5 rounded-xl bg-white/10 px-3 py-2.5 text-xs font-semibold text-white backdrop-blur-md transition active:scale-[0.98]"
              >
                <IconWallet size={16} />
                Breakdown
              </button>
            </div>
          </section>

          {/* 6-month trend */}
          {trend.bars.length > 0 ? (
            <section className="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-base font-semibold tracking-tight text-[#0b1c30]">
                    Salary Trend (Last {trend.bars.length} Mos)
                  </p>
                  <p className="text-xs text-[#434654]">
                    Average {formatInr(Math.round(trend.avg)).replace("₹", "₹")}{" "}
                    / month
                  </p>
                </div>
                {trend.ytdPct != null ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#6ffbbe]/30 px-2 py-1 text-[10px] font-bold text-[#005236]">
                    {trend.ytdPct >= 0 ? "+" : ""}
                    {trend.ytdPct.toFixed(1)}% YTD
                  </span>
                ) : null}
              </div>
              <div className="flex h-28 w-full items-end justify-between gap-2 px-1 pb-1 pt-4">
                {trend.bars.map((bar) => (
                  <Link
                    key={bar.id}
                    href={`/payslips/${bar.id}`}
                    className="group flex flex-1 flex-col items-center gap-1.5"
                  >
                    <span
                      className={`text-[10px] font-bold ${
                        bar.active
                          ? "text-[#004ac6]"
                          : "text-[#434654] opacity-0 transition group-hover:opacity-100"
                      }`}
                    >
                      {shortInrLakhs(bar.amount)}
                    </span>
                    <span
                      className={`w-full rounded-t-lg transition ${
                        bar.active
                          ? "bg-[#004ac6] shadow-sm"
                          : "bg-[#e6eeff] group-hover:bg-[#dbe1ff]"
                      }`}
                      style={{ height: bar.height }}
                    />
                    <span
                      className={`text-[10px] font-bold ${
                        bar.active ? "text-[#004ac6]" : "text-[#434654]"
                      }`}
                    >
                      {bar.label}
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          {/* Recent payslips */}
          <section className="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between pb-1">
              <p className="text-base font-semibold tracking-tight text-[#0b1c30]">
                Recent Payslips
              </p>
              <Link
                href="/payslips/history"
                className="text-xs font-semibold text-[#004ac6] hover:underline"
              >
                View All ({rows.length})
              </Link>
            </div>
            <ul className="space-y-2">
              {recent.map((row, idx) => {
                const adj = hasAdjustment(row);
                return (
                  <li key={row.id}>
                    <div className="flex items-center justify-between rounded-xl bg-[#eff4ff] p-3 transition hover:bg-[#e6eeff]">
                      <Link
                        href={`/payslips/${row.id}`}
                        className="flex min-w-0 flex-1 items-center gap-3"
                      >
                        <span
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                            idx === 0
                              ? "bg-[#dbe1ff] text-[#004ac6]"
                              : "bg-[#e6eeff] text-[#434654]"
                          }`}
                        >
                          <IconCalendar size={18} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5">
                            <span className="truncate text-sm font-semibold text-[#0b1c30]">
                              {periodLabel(row)}
                            </span>
                            {adj ? (
                              <span className="rounded bg-[#eaddff] px-1.5 py-0.5 text-[10px] font-bold text-[#25005a]">
                                Adj.
                              </span>
                            ) : null}
                          </span>
                          <span className="block text-xs text-[#434654]">
                            {formatInr(row.net_salary).replace("₹", "₹ ")} •{" "}
                            {disbursedLabel(row)}
                          </span>
                        </span>
                      </Link>
                      <div className="flex shrink-0 items-center">
                        <button
                          type="button"
                          title="Download payslip"
                          className="rounded-full p-2 text-[#434654] transition hover:bg-[#d3e3ff] hover:text-[#004ac6]"
                          onClick={() => {
                            void downloadPayslip(row).catch((err) =>
                              setError(
                                err instanceof Error
                                  ? err.message
                                  : "Download failed",
                              ),
                            );
                          }}
                        >
                          <IconDownload size={18} />
                        </button>
                        <Link
                          href={`/payslips/${row.id}`}
                          className="rounded-full p-2 text-[#434654] transition hover:bg-[#d3e3ff] hover:text-[#0b1c30]"
                          aria-label={`Open ${periodLabel(row)}`}
                        >
                          <IconChevronRight size={18} />
                        </Link>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          {/* Earnings & deductions */}
          <section
            ref={breakdownRef}
            id="salary-breakdown"
            className="space-y-4 rounded-2xl bg-white p-4 shadow-sm scroll-mt-20"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#dbe1ff] text-[#004ac6]">
                  <IconWallet size={16} />
                </span>
                <p className="text-base font-semibold tracking-tight text-[#0b1c30]">
                  Earnings &amp; Deductions
                </p>
              </div>
              <span className="rounded-full bg-[#dde9ff] px-2 py-0.5 text-[10px] font-bold text-[#434654]">
                {periodLabel(latest)}
              </span>
            </div>

            <div className="space-y-2">
              <p className="pb-1 text-[10px] font-bold uppercase tracking-wider text-[#005236]">
                Earnings (Gross:{" "}
                {formatInr(parsed.gross).replace("₹", "₹ ")})
              </p>
              <div className="space-y-2.5 rounded-xl bg-[#eff4ff] p-3">
                {parsed.earnings.map((line) => {
                  const bonus = isBonusLine(line);
                  return (
                    <div
                      key={`e-${line.label}`}
                      className="flex items-center justify-between gap-3"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <span
                          className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                            bonus ? "bg-[#52e1a6]" : "bg-[#004ac6]"
                          }`}
                        />
                        <span className="truncate text-sm text-[#0b1c30]">
                          {line.label}
                        </span>
                      </div>
                      <span
                        className={`shrink-0 text-sm font-semibold ${
                          bonus ? "text-[#005236]" : "text-[#0b1c30]"
                        }`}
                      >
                        {formatInr(line.amount).replace("₹", "₹ ")}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <p className="pb-1 text-[10px] font-bold uppercase tracking-wider text-[#ba1a1a]">
                Deductions (Total:{" "}
                {formatInr(parsed.deductionsTotal).replace("₹", "₹ ")})
              </p>
              <div className="space-y-2.5 rounded-xl bg-[#eff4ff] p-3">
                {parsed.deductions.length ? (
                  parsed.deductions.map((line) => {
                    const tax = /tds|tax|income/i.test(line.label);
                    return (
                      <div
                        key={`d-${line.label}`}
                        className="flex items-center justify-between gap-3"
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#ba1a1a]" />
                          <span className="truncate text-sm text-[#0b1c30]">
                            {line.label}
                          </span>
                        </div>
                        <span
                          className={`shrink-0 text-sm font-semibold ${
                            tax ? "text-[#ba1a1a]" : "text-[#0b1c30]"
                          }`}
                        >
                          {formatInr(line.amount).replace("₹", "₹ ")}
                        </span>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-sm text-[#434654]">No deductions listed</p>
                )}
              </div>
            </div>
          </section>

          {/* Tax planning */}
          <section className="space-y-3.5 rounded-2xl bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#eaddff] text-[#712ae2]">
                  <IconCheck size={16} />
                </span>
                <p className="text-base font-semibold tracking-tight text-[#0b1c30]">
                  Tax Planning &amp; Form 16
                </p>
              </div>
              <span className="rounded-full bg-[#eaddff]/50 px-2 py-0.5 text-[10px] font-bold text-[#712ae2]">
                New Regime
              </span>
            </div>
            <div className="flex flex-col space-y-2.5 rounded-xl bg-[#eff4ff] p-3.5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-[#0b1c30]">
                    Tax Declarations ({fy.replace("FY ", "FY ")})
                  </p>
                  <p className="text-xs text-[#434654]">
                    Manage declarations and Form 16 from tax centre
                  </p>
                </div>
                <Link
                  href="/payslips/tax"
                  className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#6ffbbe]/30 px-2 py-0.5 text-[10px] font-bold text-[#005236]"
                >
                  <IconCheck size={12} />
                  Open
                </Link>
              </div>
              <div className="h-px w-full bg-[#e6eeff]" />
              <div className="flex items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-1.5 text-[#434654]">
                  <IconInfo size={14} className="text-[#004ac6]" />
                  <span>Proof submission &amp; Form 16 downloads</span>
                </div>
                <Link
                  href="/payslips/tax"
                  className="font-semibold text-[#004ac6] hover:underline"
                >
                  Manage
                </Link>
              </div>
            </div>
            <Link
              href="/profile/bank"
              className="flex items-center gap-2 text-xs font-semibold text-[#004ac6]"
            >
              <IconBank size={14} />
              Salary credit account
            </Link>
          </section>
        </>
      )}
    </div>
  );
}
