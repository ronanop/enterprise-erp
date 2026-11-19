"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import {
  IconChevronRight,
  IconDownload,
  IconWallet,
} from "@/components/icons";
import { AiFab, AlertBox } from "@/components/ui";
import { ApiClientError } from "@/services/api-client";
import { essService } from "@/services/ess-service";
import type { EssMe, EssPayslip } from "@/types/api";
import * as ui from "@/theme/classes";

export default function TaxBenefitsPage() {
  const [me, setMe] = useState<EssMe | null>(null);
  const [latest, setLatest] = useState<EssPayslip | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([essService.payslips(), essService.me()])
      .then(([pay, meRes]) => {
        setLatest((pay.data ?? [])[0] ?? null);
        setMe(meRes.data);
      })
      .catch((err) =>
        setError(
          err instanceof ApiClientError ? err.message : "Failed to load tax info",
        ),
      );
  }, []);

  const net = Number(latest?.net_salary) || 62500;
  const gross = Number(latest?.gross_salary) || 75000;
  const pct = Math.min(100, Math.round((net / Math.max(gross, 1)) * 100));

  return (
    <div className="space-y-5">
      <AppHeader title="Tax & Benefits" name={me?.display_name} />
      <p className="-mt-3 px-1 text-sm text-[#434655]">FY 2025-26</p>

      {error ? <AlertBox>{error}</AlertBox> : null}

      <section className={`${ui.card} space-y-3 p-5`}>
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-[#434655]">
              Projected Net Take-Home
            </p>
            <p className="mt-1 text-3xl font-bold text-[#004ac6]">
              ₹{net.toLocaleString("en-IN")}
              <span className="text-base font-medium text-[#434655]">/mo</span>
            </p>
          </div>
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#dbe1ff] text-[#004ac6]">
            <IconWallet size={18} />
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-[#d3e4fe]">
          <div
            className="h-full rounded-full bg-[#004ac6]"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-sm text-[#434655]">
          {pct}% of gross salary after taxes & deductions
        </p>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-[#0b1c30]">
          Your Portfolio
        </h2>
        <ul className="space-y-2">
          <Portfolio
            title="Income Tax"
            subtitle="Estimated annual tax: ₹1,42,000"
            badge="Verified"
            badgeTone="green"
          />
          <Portfolio
            title="Provident Fund"
            subtitle="Current Balance: ₹2,84,500"
            badge="Active"
            badgeTone="blue"
          />
          <Portfolio
            title="Insurance"
            subtitle="Premium coverage for family"
            badge="3 Plans"
            badgeTone="blue"
          />
          <Portfolio
            title="Retirement Benefits"
            subtitle="Vesting starts in 14 months"
            badge="View details"
            badgeTone="plain"
          />
        </ul>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-[#0b1c30]">Documents</h2>
        <div className="space-y-3 rounded-2xl border border-dashed border-[#c3c6d7] bg-[#eff4ff] p-5 text-center">
          <p className="font-semibold text-[#004ac6]">Download Tax Certificate</p>
          <p className="text-sm text-[#434655]">
            Your Form 16 and Tax summary for Q3 are now ready for download
          </p>
          <Link href="/documents" className={`${ui.btn} w-full`}>
            <IconDownload size={16} /> Download PDF (2.4 MB)
          </Link>
        </div>
      </section>

      <AiFab href="/payslips" />
    </div>
  );
}

function Portfolio({
  title,
  subtitle,
  badge,
  badgeTone,
}: {
  title: string;
  subtitle: string;
  badge: string;
  badgeTone: "green" | "blue" | "plain";
}) {
  return (
    <li>
      <button
        type="button"
        className={`${ui.card} flex w-full items-center gap-3 p-4 text-left`}
      >
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#dbe1ff] text-[#004ac6]">
          <IconWallet size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-[#0b1c30]">{title}</p>
          <p className="text-xs text-[#434655]">{subtitle}</p>
        </div>
        {badgeTone === "plain" ? (
          <span className="text-xs font-semibold text-[#004ac6]">{badge}</span>
        ) : (
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
              badgeTone === "green"
                ? "bg-emerald-100 text-emerald-800"
                : "bg-[#dbe1ff] text-[#004ac6]"
            }`}
          >
            {badge}
          </span>
        )}
        <IconChevronRight className="text-[#c3c6d7]" />
      </button>
    </li>
  );
}
