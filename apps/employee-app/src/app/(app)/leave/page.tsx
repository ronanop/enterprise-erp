"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import {
  IconCalendar,
  IconChevronRight,
  IconClose,
  IconPlus,
  IconSparkle,
} from "@/components/icons";
import {
  AlertBox,
  EmptyState,
  ViewportFab,
  leaveStatusTone,
} from "@/components/ui";
import { ApiClientError } from "@/services/api-client";
import { essService } from "@/services/ess-service";
import type {
  EssLeaveBalance,
  EssLeaveRequest,
  EssLeaveType,
  EssMe,
} from "@/types/api";
import "@/app/leave.css";
import * as ui from "@/theme/classes";

const BALANCE_COLORS = [
  { stroke: "#2563eb", soft: "#dbe1ff", iconBg: "#dce9ff" },
  { stroke: "#ba1a1a", soft: "#ffdad6", iconBg: "#ffdad6" },
  { stroke: "#712ae2", soft: "#eaddff", iconBg: "#eaddff" },
];

export default function LeavePage() {
  const [me, setMe] = useState<EssMe | null>(null);
  const [types, setTypes] = useState<EssLeaveType[]>([]);
  const [balances, setBalances] = useState<EssLeaveBalance[]>([]);
  const [requests, setRequests] = useState<EssLeaveRequest[]>([]);
  const [leaveTypeId, setLeaveTypeId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [daysCount, setDaysCount] = useState("1");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showApply, setShowApply] = useState(false);
  const [portalReady, setPortalReady] = useState(false);
  const [step, setStep] = useState(1);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  useEffect(() => {
    if (!showApply) {
      document.body.removeAttribute("data-leave-sheet");
      return;
    }
    document.body.setAttribute("data-leave-sheet", "open");
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.removeAttribute("data-leave-sheet");
      document.body.style.overflow = prev;
    };
  }, [showApply]);

  const typeName = useMemo(() => {
    const map = new Map(types.map((t) => [t.id, t.leave_type_name]));
    return (id: string) => map.get(id) ?? "Leave";
  }, [types]);

  const balanceCards = useMemo(() => {
    return balances.slice(0, 2).map((row, i) => {
      const closing = Number(row.closing_balance) || 0;
      const used = Number(row.used) || 0;
      const lt = types.find((t) => t.id === row.leave_type_id);
      const total = Math.max(
        closing + used,
        Number(lt?.max_days_per_year) || closing + used,
        1,
      );
      return {
        id: row.id,
        leaveTypeId: row.leave_type_id,
        name: typeName(row.leave_type_id),
        closing,
        used,
        total,
        perMonth: Number(lt?.monthly_credit_days) || 0,
        pct: (closing / total) * 100,
        ...BALANCE_COLORS[i % BALANCE_COLORS.length],
      };
    });
  }, [balances, typeName, types]);

  const pending = requests.filter((r) =>
    ["draft", "submitted", "pending"].includes(r.status.toLowerCase()),
  );

  async function refresh() {
    const [t, b, r, meRes] = await Promise.all([
      essService.leaveTypes(),
      essService.leaveBalances(),
      essService.leaveRequests(),
      essService.me(),
    ]);
    setTypes(t.data ?? []);
    setBalances(b.data ?? []);
    setRequests(r.data ?? []);
    setMe(meRes.data);
    if (!leaveTypeId && (t.data?.length ?? 0) > 0) {
      setLeaveTypeId(t.data![0].id);
    }
  }

  useEffect(() => {
    refresh().catch((err) =>
      setError(
        err instanceof ApiClientError ? err.message : "Failed to load leave",
      ),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!startDate || !endDate) return;
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (
      Number.isNaN(start.getTime()) ||
      Number.isNaN(end.getTime()) ||
      end < start
    )
      return;
    const days =
      Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    setDaysCount(String(days));
  }, [startDate, endDate]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      await essService.createLeaveRequest({
        leave_type_id: leaveTypeId,
        start_date: startDate,
        end_date: endDate,
        days_count: daysCount,
        reason: reason || undefined,
      });
      setMessage("Leave submitted");
      setReason("");
      setShowApply(false);
      setStep(1);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Submit failed");
    } finally {
      setLoading(false);
    }
  }

  function openApply(typeId?: string) {
    if (typeId) setLeaveTypeId(typeId);
    setStep(1);
    setShowApply(true);
  }

  const calendar = useMemo(() => buildMonthGrid(), []);

  return (
    <div className="relative space-y-6">
      <AppHeader title="Leave Management" name={me?.display_name} />

      {message ? <AlertBox tone="success">{message}</AlertBox> : null}
      {error && !showApply ? <AlertBox>{error}</AlertBox> : null}

      <section>
        <div className="mb-3 flex items-center justify-between px-0.5">
          <h2 className="text-lg font-semibold text-[#0b1c30]">Your Balances</h2>
          <Link href="/leave/history" className="text-sm font-medium text-[#004ac6]">
            Details
          </Link>
        </div>
        {balanceCards.length === 0 ? (
          <EmptyState title="No balances yet" icon={<IconCalendar size={20} />} />
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {balanceCards.map((row) => (
              <button
                key={row.id}
                type="button"
                onClick={() => openApply(row.leaveTypeId)}
                className={`${ui.card} space-y-3 p-4 text-left transition active:scale-[0.98]`}
                style={{ background: row.soft }}
              >
                <div className="flex items-start justify-between">
                  <span
                    className="flex h-10 w-10 items-center justify-center rounded-xl"
                    style={{ background: "rgba(255,255,255,0.7)", color: row.stroke }}
                  >
                    <IconCalendar size={18} />
                  </span>
                  <span className="text-sm font-bold text-[#0b1c30]">
                    {row.closing}/{row.total}
                  </span>
                </div>
                <p className="text-sm font-semibold text-[#0b1c30]">{row.name}</p>
                {row.perMonth > 0 ? (
                  <p className="text-[11px] text-[#5b6b7c]">{row.perMonth} day(s) / month</p>
                ) : null}
                <div className="h-1.5 overflow-hidden rounded-full bg-white/70">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.min(100, row.pct)}%`,
                      background: row.stroke,
                    }}
                  />
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-[#0b1c30]">
          Active Applications
        </h2>
        {pending.length === 0 ? (
          <EmptyState title="No active applications" />
        ) : (
          <ul className="space-y-2">
            {pending.slice(0, 3).map((row) => (
              <li key={row.id}>
                <Link
                  href={`/leave/${row.id}`}
                  className={`${ui.card} flex items-start gap-3 p-4 transition active:scale-[0.99]`}
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#eaddff] text-[#712ae2]">
                    <IconCalendar size={20} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="truncate font-semibold text-[#0b1c30]">
                        {typeName(row.leave_type_id)}
                      </p>
                      <span className="shrink-0 rounded-full bg-[#dbe1ff] px-2.5 py-0.5 text-[10px] font-bold text-[#004ac6]">
                        • {row.status}
                      </span>
                    </div>
                    <p className="mt-0.5 text-sm text-[#434655]">
                      {row.start_date}
                      {row.end_date !== row.start_date ? ` – ${row.end_date}` : ""}{" "}
                      ({row.days_count} Days)
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={`${ui.card} p-5`}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold text-[#0b1c30]">Holidays Calendar</h2>
          <Link href="/leave/holidays" className="text-sm font-medium text-[#004ac6]">
            Open
          </Link>
        </div>
        <div className="mb-2 grid grid-cols-7 gap-1 text-center text-[10px] font-bold uppercase text-[#434655]">
          {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((d) => (
            <span key={d}>{d}</span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {calendar.cells.map((cell, i) => {
            const highlight = cell.day === 14 || cell.day === 18 || cell.day === 25;
            return (
              <div
                key={i}
                className={`flex h-9 items-center justify-center rounded-full text-sm ${
                  cell.day === 18
                    ? "bg-[#004ac6] font-bold text-white"
                    : cell.day === 14
                      ? "bg-emerald-100 font-semibold text-emerald-800"
                      : cell.day === 25
                        ? "bg-[#eaddff] font-semibold text-[#712ae2]"
                        : cell.day
                          ? "text-[#0b1c30]"
                          : ""
                }`}
              >
                {cell.day || ""}
                {highlight && cell.day === 22 ? (
                  <span className="absolute h-1 w-1 rounded-full bg-[#ba1a1a]" />
                ) : null}
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[#0b1c30]">
            Upcoming Holidays
          </h2>
          <Link href="/leave/holidays" className="text-sm font-medium text-[#004ac6]">
            View All
          </Link>
        </div>
        <ul className="space-y-2">
          {[
            { name: "Diwali — Festival of Lights", date: "Oct 31, Thursday", tag: "Mandatory", color: "#f59e0b" },
            { name: "Christmas Day", date: "Dec 25, Wednesday", tag: "Restricted", color: "#10B981" },
            { name: "New Year's Eve", date: "Dec 31, Tuesday", tag: "Mandatory", color: "#2563eb" },
          ].map((h) => (
            <li key={h.name}>
              <Link
                href="/leave/holidays"
                className="flex items-center gap-3 rounded-2xl border border-[#c3c6d7]/20 bg-[#eff4ff] p-4"
              >
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-lg"
                  style={{ color: h.color }}
                >
                  •
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-[#0b1c30]">{h.name}</p>
                  <p className="text-xs text-[#434655]">{h.date}</p>
                </div>
                <span className="rounded-full bg-[#dbe1ff] px-2.5 py-0.5 text-[10px] font-bold text-[#004ac6]">
                  {h.tag}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[#0b1c30]">History</h2>
          <div className="flex gap-3">
            <Link href="/leave/team" className="text-sm font-medium text-[#004ac6]">
              Team
            </Link>
            <Link href="/leave/history" className="text-sm font-medium text-[#004ac6]">
              See all
            </Link>
          </div>
        </div>
        {requests.length === 0 ? (
          <EmptyState title="No leave history yet" />
        ) : (
          <ul className="space-y-2">
            {requests.slice(0, 4).map((row) => {
              const tone = leaveStatusTone(row.status);
              const color =
                tone === "success"
                  ? "#10B981"
                  : tone === "warn"
                    ? "#d97706"
                    : tone === "danger"
                      ? "#ba1a1a"
                      : "#004ac6";
              return (
                <li key={row.id}>
                  <Link
                    href={`/leave/${row.id}`}
                    className={`${ui.card} flex items-center justify-between gap-3 p-4 transition active:scale-[0.99]`}
                  >
                    <div>
                      <p className="font-semibold text-[#0b1c30]">
                        {typeName(row.leave_type_id)}
                      </p>
                      <p className="text-xs text-[#434655]">
                        {row.start_date}
                        {row.end_date !== row.start_date ? ` → ${row.end_date}` : ""}
                      </p>
                    </div>
                    <span
                      className="inline-flex items-center gap-1 text-[10px] font-bold uppercase"
                      style={{ color }}
                    >
                      {row.status}
                      <IconChevronRight size={14} className="text-[#c3c6d7]" />
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {!showApply ? (
        <ViewportFab
          aria-label="Apply leave"
          className="bg-[#2563eb]"
          onClick={() => openApply()}
        >
          <IconPlus size={28} />
        </ViewportFab>
      ) : null}

      {portalReady && showApply
        ? createPortal(
            <div
              className="leave-sheet"
              role="dialog"
              aria-modal="true"
              aria-labelledby="leave-apply-title"
              onClick={(e) => {
                if (e.target === e.currentTarget) setShowApply(false);
              }}
            >
              <form onSubmit={onSubmit} className="leave-sheet-panel space-y-4">
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-[#eff4ff] text-[#004ac6]"
                    onClick={() => setShowApply(false)}
                  >
                    <IconClose size={18} />
                  </button>
                  <h2
                    id="leave-apply-title"
                    className="text-lg font-bold text-[#004ac6]"
                  >
                    Apply Leave
                  </h2>
                  <div className="h-10 w-10" />
                </div>

                <div className="flex items-center justify-between px-2">
                  {[
                    { n: 1, label: "Type" },
                    { n: 2, label: "Dates" },
                    { n: 3, label: "Reason" },
                  ].map((s, i) => (
                    <div key={s.n} className="flex flex-1 items-center">
                      <button
                        type="button"
                        onClick={() => setStep(s.n)}
                        className="flex flex-col items-center gap-1"
                      >
                        <span
                          className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                            step >= s.n
                              ? "bg-[#004ac6] text-white"
                              : "bg-[#e5eeff] text-[#434655]"
                          }`}
                        >
                          {s.n}
                        </span>
                        <span
                          className={`text-xs font-medium ${
                            step >= s.n ? "text-[#004ac6]" : "text-[#434655]"
                          }`}
                        >
                          {s.label}
                        </span>
                      </button>
                      {i < 2 ? (
                        <div className="mx-2 mb-4 h-px flex-1 bg-[#c3c6d7]/50" />
                      ) : null}
                    </div>
                  ))}
                </div>

                <div className="flex items-start gap-3 rounded-2xl bg-[#eff4ff] p-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#712ae2] to-[#2563eb] text-white">
                    <IconSparkle size={18} />
                  </span>
                  <div className="rounded-2xl rounded-tl-sm bg-white px-3 py-2 text-sm text-[#434655] shadow-sm">
                    Need leave soon? Pick a type and dates — I&apos;ll help you
                    submit.
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[#434655]">
                    Leave Type
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {types.map((t) => {
                      const active = leaveTypeId === t.id;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => {
                            setLeaveTypeId(t.id);
                            setStep(2);
                          }}
                          className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                            active
                              ? "bg-[#004ac6] text-white"
                              : "border border-[#c3c6d7]/50 bg-white text-[#434655]"
                          }`}
                        >
                          {t.leave_type_name.replace(/ Leave$/i, "")}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className={`${ui.card} space-y-3 p-4 !shadow-sm`}>
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-[#004ac6]">Select Dates</h3>
                    <span className="text-xs text-[#434655]">{daysCount} day(s)</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="block space-y-1 text-[11px] font-semibold text-[#434655]">
                      Start Date
                      <input
                        className={ui.input}
                        type="date"
                        required
                        value={startDate}
                        onChange={(e) => {
                          setStartDate(e.target.value);
                          setStep(2);
                        }}
                      />
                    </label>
                    <label className="block space-y-1 text-[11px] font-semibold text-[#434655]">
                      End Date
                      <input
                        className={ui.input}
                        type="date"
                        required
                        value={endDate}
                        onChange={(e) => {
                          setEndDate(e.target.value);
                          setStep(3);
                        }}
                      />
                    </label>
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-sm text-[#434655]">Any specific reason?</p>
                  <textarea
                    className={`${ui.input} min-h-[88px] resize-none`}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Reason for leave (Optional)"
                  />
                </div>

                <p className="flex items-center gap-2 text-sm font-medium text-[#10B981]">
                  <span className="h-2 w-2 rounded-full bg-[#10B981]" />
                  Probability of approval: High (94%)
                </p>

                {error ? <AlertBox>{error}</AlertBox> : null}

                <button
                  className={`${ui.btn} w-full`}
                  disabled={loading || !leaveTypeId || !startDate || !endDate}
                >
                  {loading ? "Submitting…" : "Submit leave"}
                  <IconChevronRight />
                </button>
              </form>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

function buildMonthGrid() {
  const base = new Date();
  const year = base.getFullYear();
  const month = base.getMonth();
  const label = base.toLocaleString(undefined, {
    month: "long",
    year: "numeric",
  });
  const first = new Date(year, month, 1);
  const startPad = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: { day: number | null }[] = [];
  for (let i = 0; i < startPad; i++) cells.push({ day: null });
  for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d });
  while (cells.length % 7 !== 0) cells.push({ day: null });
  return { label, cells };
}
