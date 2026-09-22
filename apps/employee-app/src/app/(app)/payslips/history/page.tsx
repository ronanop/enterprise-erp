"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AppHeader,
  FilterChips,
  SearchField,
} from "@/components/app-header";
import { IconEye, IconEyeOff, IconWallet } from "@/components/icons";
import { AiFab, AlertBox, EmptyState } from "@/components/ui";
import { ApiClientError } from "@/services/api-client";
import { essService } from "@/services/ess-service";
import type { EssMe, EssPayslip } from "@/types/api";
import * as ui from "@/theme/classes";

export default function SalaryHistoryPage() {
  const [me, setMe] = useState<EssMe | null>(null);
  const [rows, setRows] = useState<EssPayslip[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [hidden, setHidden] = useState(true);
  const [query, setQuery] = useState("");
  const year = String(new Date().getFullYear());
  const [filter, setFilter] = useState(year);

  useEffect(() => {
    Promise.all([essService.payslips(), essService.me()])
      .then(([pay, meRes]) => {
        setRows(pay.data ?? []);
        setMe(meRes.data);
      })
      .catch((err) =>
        setError(
          err instanceof ApiClientError ? err.message : "Failed to load history",
        ),
      );
  }, []);

  const years = useMemo(() => {
    const set = new Set(
      rows.map((r) =>
        r.issued_at
          ? String(new Date(r.issued_at).getFullYear())
          : year,
      ),
    );
    set.add(year);
    set.add(String(Number(year) - 1));
    set.add(String(Number(year) - 2));
    return [...set].sort((a, b) => Number(b) - Number(a));
  }, [rows, year]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      const y = r.issued_at
        ? String(new Date(r.issued_at).getFullYear())
        : year;
      if (y !== filter) return false;
      if (q && !r.document_number.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, filter, query, year]);

  const annual = filtered.reduce((s, r) => s + (Number(r.net_salary) || 0), 0);
  const avg =
    filtered.length > 0 ? Math.round(annual / filtered.length) : 0;

  return (
    <div className="space-y-5">
      <AppHeader
        title="Salary History"
        name={me?.display_name}
      />

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setHidden((v) => !v)}
          className="flex h-10 w-10 items-center justify-center text-[#004ac6]"
          aria-label="Toggle privacy"
        >
          {hidden ? <IconEyeOff size={20} /> : <IconEye size={20} />}
        </button>
      </div>

      {error ? <AlertBox>{error}</AlertBox> : null}

      <div className={`${ui.card} p-4`}>
        <p className="text-[10px] font-bold uppercase tracking-wide text-[#434655]">
          Annual Earnings {filter}
        </p>
        <p className="mt-1 text-3xl font-bold text-[#0b1c30]">
          {hidden ? "••••••••" : `₹${annual.toLocaleString("en-IN")}`}
        </p>
        <p className="mt-1 text-sm font-medium text-[#10B981]">
          8.4% vs last year
        </p>
      </div>

      <div className={`${ui.card} p-4`}>
        <p className="text-[10px] font-bold uppercase tracking-wide text-[#434655]">
          Net Monthly Avg
        </p>
        <p className="mt-1 text-2xl font-bold text-[#0b1c30]">
          {hidden ? "••••••" : `₹${avg.toLocaleString("en-IN")}`}
        </p>
        <div className="mt-3 flex justify-between border-t border-[#c3c6d7]/30 pt-3 text-sm font-semibold text-[#004ac6]">
          <span>Next Payout</span>
          <span>28th</span>
        </div>
      </div>

      <SearchField
        value={query}
        onChange={setQuery}
        placeholder="Search statements..."
      />
      <FilterChips options={years} value={filter} onChange={setFilter} />

      {filtered.length === 0 ? (
        <EmptyState title="No statements" icon={<IconWallet size={20} />} />
      ) : (
        <ul className="space-y-2">
          {filtered.map((r) => (
            <li key={r.id}>
              <Link
                href={`/payslips/${r.id}`}
                className={`${ui.card} flex items-center gap-3 p-4`}
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#dbe1ff] text-[#004ac6]">
                  <IconWallet size={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-[#0b1c30]">
                    {r.document_number}
                  </p>
                  <p className="text-xs text-[#434655]">
                    {r.payment_status} • Regular Salary
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-[#0b1c30]">
                    {hidden ? "••••" : `₹${r.net_salary}`}
                  </p>
                  <span className="rounded bg-emerald-500 px-1.5 py-0.5 text-[9px] font-bold uppercase text-white">
                    Deposited
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <AiFab href="/payslips/breakdown" />
    </div>
  );
}
