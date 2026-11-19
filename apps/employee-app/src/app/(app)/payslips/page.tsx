"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import {
  IconDownload,
  IconEye,
  IconEyeOff,
  IconWallet,
} from "@/components/icons";
import { AiFab, AlertBox, EmptyState } from "@/components/ui";
import { ApiClientError } from "@/services/api-client";
import { essService } from "@/services/ess-service";
import type { EssMe, EssPayslip } from "@/types/api";
import * as ui from "@/theme/classes";

export default function PayslipsPage() {
  const [me, setMe] = useState<EssMe | null>(null);
  const [rows, setRows] = useState<EssPayslip[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    Promise.all([essService.payslips(), essService.me()])
      .then(([pay, meRes]) => {
        setRows(pay.data ?? []);
        setMe(meRes.data);
      })
      .catch((err) =>
        setError(
          err instanceof ApiClientError ? err.message : "Failed to load payslips",
        ),
      );
  }, []);

  const latest = rows[0];
  const trend = useMemo(() => {
    const slice = [...rows].slice(0, 6).reverse();
    const max = Math.max(...slice.map((r) => Number(r.net_salary) || 0), 1);
    return slice.map((r) => ({
      id: r.id,
      label: monthLabel(r.document_number, r.issued_at),
      value: Number(r.net_salary) || 0,
      pct: ((Number(r.net_salary) || 0) / max) * 100,
      current: r.id === latest?.id,
    }));
  }, [rows, latest?.id]);

  const ytd = rows.reduce((s, r) => s + (Number(r.net_salary) || 0), 0);
  const taxEst = rows.reduce(
    (s, r) => s + (Number(r.total_deductions) || 0),
    0,
  );

  return (
    <div className="space-y-6">
      <AppHeader title="Salary" name={me?.display_name} />

      {error ? <AlertBox>{error}</AlertBox> : null}

      {latest ? (
        <section className={`${ui.cardPeach} p-5`}>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-white/70">
                {monthLabel(latest.document_number, latest.issued_at)}
              </p>
              <p className="mt-1 text-lg font-bold text-white">Net Pay</p>
            </div>
            <button
              type="button"
              onClick={() => setHidden((v) => !v)}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white"
              aria-label={hidden ? "Show amounts" : "Hide amounts"}
            >
              {hidden ? <IconEyeOff size={18} /> : <IconEye size={18} />}
            </button>
          </div>
          <p className="mt-3 text-4xl font-bold tracking-tight text-white">
            {hidden ? "••••••" : `₹${latest.net_salary}`}
          </p>
          <div className="mt-5 grid grid-cols-3 divide-x divide-white/20">
            <Mini
              label="Gross"
              value={hidden ? "••••" : `₹${shortMoney(latest.gross_salary)}`}
            />
            <Mini
              label="Tax / Ded"
              value={
                hidden ? "••••" : `₹${shortMoney(latest.total_deductions)}`
              }
            />
            <Mini
              label="Status"
              value={latest.payment_status?.slice(0, 8) ?? "—"}
            />
          </div>
        </section>
      ) : null}

      {trend.length > 0 ? (
        <section>
          <div className="mb-3 flex items-end justify-between px-0.5">
            <h2 className="text-lg font-semibold text-[#0b1c30]">
              {Math.min(6, trend.length)}-Month Trend
            </h2>
            <span className="text-xs font-medium text-[#004ac6]">
              Latest slips
            </span>
          </div>
          <div className={`${ui.card} flex h-48 items-end justify-between gap-2 p-5`}>
            {trend.map((bar) => (
              <div
                key={bar.id}
                className="flex h-full flex-1 flex-col items-center justify-end gap-2"
              >
                <div
                  className={`w-full max-w-[36px] rounded-t-lg transition-all ${
                    bar.current ? "bg-[#2563eb]" : "bg-[#dbe1ff]"
                  }`}
                  style={{ height: `${Math.max(8, bar.pct)}%` }}
                />
                <span className="text-[10px] font-semibold uppercase text-[#434655]">
                  {bar.label}
                </span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <div className="grid grid-cols-2 gap-3">
        <div className={`${ui.card} border-l-4 border-l-[#2563eb] p-4`}>
          <p className="text-[10px] font-bold uppercase tracking-wide text-[#434655]">
            YTD Earnings
          </p>
          <p className="mt-1 text-xl font-bold text-[#0b1c30]">
            {hidden ? "••••" : `₹${ytd.toLocaleString("en-IN")}`}
          </p>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#d3e4fe]">
            <div className="h-full w-3/4 rounded-full bg-[#2563eb]" />
          </div>
        </div>
        <div className={`${ui.card} border-l-4 border-l-[#712ae2] p-4`}>
          <p className="text-[10px] font-bold uppercase tracking-wide text-[#434655]">
            Total Deducted
          </p>
          <p className="mt-1 text-xl font-bold text-[#0b1c30]">
            {hidden ? "••••" : `₹${taxEst.toLocaleString("en-IN")}`}
          </p>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#eaddff]">
            <div className="h-full w-1/2 rounded-full bg-[#712ae2]" />
          </div>
        </div>
      </div>

      <section>
        <div className="mb-3 flex items-center justify-between px-0.5">
          <h2 className="text-lg font-semibold text-[#0b1c30]">Recent Payslips</h2>
          <Link href="/payslips/history" className="text-sm font-medium text-[#004ac6]">
            See All
          </Link>
        </div>
        <div className="mb-3 grid grid-cols-3 gap-2">
          <Link
            href="/payslips/breakdown"
            className="rounded-xl bg-[#eff4ff] px-2 py-3 text-center text-xs font-semibold text-[#004ac6]"
          >
            Breakdown
          </Link>
          <Link
            href="/payslips/history"
            className="rounded-xl bg-[#eff4ff] px-2 py-3 text-center text-xs font-semibold text-[#004ac6]"
          >
            History
          </Link>
          <Link
            href="/payslips/tax"
            className="rounded-xl bg-[#eff4ff] px-2 py-3 text-center text-xs font-semibold text-[#004ac6]"
          >
            Tax
          </Link>
        </div>
        {rows.length === 0 && !error ? (
          <EmptyState
            title="No payslips yet"
            description="When payroll issues a slip, it will appear here."
            icon={<IconWallet size={20} />}
          />
        ) : (
          <ul className="space-y-2">
            {rows.map((row) => (
              <li key={row.id}>
                <Link
                  href={`/payslips/${row.id}`}
                  className={`${ui.card} flex items-center justify-between gap-3 p-4 transition active:scale-[0.99]`}
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#dbe1ff] text-[#004ac6]">
                      <IconWallet size={20} />
                    </span>
                    <div>
                      <p className="font-semibold text-[#0b1c30]">
                        {row.document_number}
                      </p>
                      <p className="text-xs text-[#434655]">
                        {row.payment_status} · {row.status}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-[#0b1c30]">
                      {hidden ? "••••" : `₹${row.net_salary}`}
                    </p>
                    <span className="flex h-9 w-9 items-center justify-center rounded-full border border-[#2563eb]/30 text-[#004ac6]">
                      <IconDownload size={16} />
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <AiFab href="/payslips/breakdown" />
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-2 text-center first:pl-0 last:pr-0">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-white/65">
        {label}
      </p>
      <p className="mt-0.5 truncate text-sm font-bold text-white">{value}</p>
    </div>
  );
}

function shortMoney(value: string | number) {
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function monthLabel(doc: string, issuedAt?: string | null) {
  if (issuedAt) {
    return new Date(issuedAt).toLocaleString(undefined, {
      month: "short",
      year: "2-digit",
    });
  }
  const m = doc.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i);
  return m?.[1]?.slice(0, 3) ?? doc.slice(0, 6);
}
