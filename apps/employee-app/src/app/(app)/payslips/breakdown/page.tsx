"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { IconEye, IconEyeOff, IconWallet } from "@/components/icons";
import { AiFab, AlertBox } from "@/components/ui";
import { ApiClientError } from "@/services/api-client";
import { essService } from "@/services/ess-service";
import type { EssMe, EssPayslip } from "@/types/api";
import * as ui from "@/theme/classes";

export default function SalaryBreakdownPage() {
  const [me, setMe] = useState<EssMe | null>(null);
  const [latest, setLatest] = useState<EssPayslip | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    Promise.all([essService.payslips(), essService.me()])
      .then(([pay, meRes]) => {
        setLatest((pay.data ?? [])[0] ?? null);
        setMe(meRes.data);
      })
      .catch((err) =>
        setError(
          err instanceof ApiClientError ? err.message : "Failed to load salary",
        ),
      );
  }, []);

  const net = Number(latest?.net_salary) || 8450;
  const gross = Number(latest?.gross_salary) || 10200;
  const ded = Number(latest?.total_deductions) || 1750;
  const basic = Math.round(gross * 0.55);
  const hra = Math.round(gross * 0.2);
  const allow = Math.max(0, gross - basic - hra);

  return (
    <div className="space-y-5">
      <AppHeader title="Salary Breakdown" name={me?.display_name} />

      {error ? <AlertBox>{error}</AlertBox> : null}

      <div className={`${ui.cardSoft} flex items-center justify-between px-4 py-3`}>
        <button type="button" className="text-[#004ac6]">‹</button>
        <span className="font-semibold text-[#0b1c30]">Current Period</span>
        <button type="button" className="text-[#004ac6]">›</button>
      </div>

      <section className={`${ui.cardPeach} p-5`}>
        <div className="flex items-start justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-white/70">
            Net Monthly Salary
          </p>
          <button
            type="button"
            onClick={() => setHidden((v) => !v)}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white"
          >
            {hidden ? <IconEyeOff size={16} /> : <IconEye size={16} />}
          </button>
        </div>
        <p className="mt-2 text-4xl font-bold text-white">
          {hidden ? "••••••" : `₹${net.toLocaleString("en-IN")}`}
        </p>
        <p className="mt-3 text-sm text-white/90">+4.2% increase from last month</p>
      </section>

      <section className={`${ui.card} space-y-4 p-5`}>
        <h2 className="font-semibold text-[#0b1c30]">Salary Composition</h2>
        <div className="mx-auto flex h-36 w-36 items-center justify-center rounded-full border-[14px] border-[#2563eb] border-r-[#712ae2] border-b-[#10B981] border-l-[#ba1a1a]">
          <div className="text-center">
            <p className="text-xs text-[#434655]">Earnings</p>
            <p className="text-xl font-bold text-[#0b1c30]">85%</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <Legend color="#2563eb" label="Basic Pay" />
          <Legend color="#60a5fa" label="HRA" />
          <Legend color="#712ae2" label="Allowances" />
          <Legend color="#ba1a1a" label="Deductions" />
        </div>
      </section>

      <ul className="space-y-2">
        <Line
          title="Basic Salary"
          subtitle="Base compensation"
          value={hidden ? "••••" : `₹${basic.toLocaleString("en-IN")}`}
          tone="blue"
        />
        <Line
          title="HRA"
          subtitle="Housing allowance"
          value={hidden ? "••••" : `₹${hra.toLocaleString("en-IN")}`}
          tone="blue"
        />
        <Line
          title="Allowances"
          subtitle="Conveyance & Medical"
          value={hidden ? "••••" : `₹${allow.toLocaleString("en-IN")}`}
          tone="purple"
        />
        <Line
          title="Tax & PF"
          subtitle="Mandatory deductions"
          value={hidden ? "••••" : `-₹${ded.toLocaleString("en-IN")}`}
          tone="red"
        />
      </ul>

      <div className="grid grid-cols-2 gap-3">
        <Link href="/payslips/history" className={`${ui.btnSecondary} text-center`}>
          History
        </Link>
        <Link href="/payslips/tax" className={`${ui.btn} text-center`}>
          Tax & Benefits
        </Link>
      </div>

      <AiFab href="/payslips" />
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-[#434655]">
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}

function Line({
  title,
  subtitle,
  value,
  tone,
}: {
  title: string;
  subtitle: string;
  value: string;
  tone: "blue" | "purple" | "red";
}) {
  const bg =
    tone === "purple"
      ? "bg-[#eaddff] text-[#712ae2]"
      : tone === "red"
        ? "bg-[#ffdad6] text-[#ba1a1a]"
        : "bg-[#dbe1ff] text-[#004ac6]";
  return (
    <li className={`${ui.card} flex items-center gap-3 p-4`}>
      <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${bg}`}>
        <IconWallet size={18} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-[#0b1c30]">{title}</p>
        <p className="text-xs text-[#434655]">{subtitle}</p>
      </div>
      <p
        className={`font-bold ${
          tone === "red" ? "text-[#ba1a1a]" : "text-[#0b1c30]"
        }`}
      >
        {value}
      </p>
    </li>
  );
}
