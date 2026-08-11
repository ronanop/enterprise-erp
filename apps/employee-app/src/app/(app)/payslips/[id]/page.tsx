"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { SubHeader } from "@/components/app-header";
import {
  IconDownload,
  IconEye,
  IconEyeOff,
  IconWallet,
} from "@/components/icons";
import {
  AlertBox,
  StatusBadge,
  leaveStatusTone,
} from "@/components/ui";
import { ApiClientError } from "@/services/api-client";
import { essService } from "@/services/ess-service";
import type { EssPayslip } from "@/types/api";
import * as ui from "@/theme/classes";
import { formatDateTime } from "@/utils/datetime";

export default function PayslipViewerPage() {
  const params = useParams<{ id: string }>();
  const [row, setRow] = useState<EssPayslip | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (!params.id) return;
    essService
      .payslip(params.id)
      .then((res) => setRow(res.data))
      .catch((err) =>
        setError(
          err instanceof ApiClientError ? err.message : "Failed to load payslip",
        ),
      );
  }, [params.id]);

  const net = Number(row?.net_salary) || 0;
  const gross = Number(row?.gross_salary) || 0;
  const ded = Number(row?.total_deductions) || 0;

  const pj = row?.payslip_json as Record<string, unknown> | undefined;
  const att =
    row?.attendance_summary ??
    (pj?.attendance as Record<string, unknown> | undefined) ??
    {};
  const earningRows =
    row?.earnings ??
    (Array.isArray(pj?.earnings) ? (pj?.earnings as { label?: string; amount?: number }[]) : null);
  const deductionRows =
    row?.deductions ??
    (Array.isArray(pj?.deductions)
      ? (pj?.deductions as { code?: string; label?: string; amount?: number }[])
      : null);

  const basic =
    earningRows?.find((e) => e.label?.toLowerCase().includes("basic"))?.amount ??
    Math.round(gross * 0.6);
  const hra =
    earningRows?.find((e) => e.label?.toLowerCase().includes("hra"))?.amount ??
    Math.round(gross * 0.3);
  const special =
    earningRows?.find((e) => e.label?.toLowerCase().includes("special"))?.amount ??
    Math.max(0, gross - basic - hra);
  const pfEmp =
    deductionRows?.find((d) => d.code === "pf_employee")?.amount ??
    Math.round(ded * 0.48);
  const pfEr =
    deductionRows?.find((d) => d.code === "pf_employer")?.amount ?? pfEmp;
  const pf = pfEmp + pfEr;
  const tax = Math.max(0, ded - pfEmp);

  const periodDays = Number(att.period_days ?? 0);
  const lopDays = Number(att.lop_days ?? 0);
  const leaveDays = Number(att.leave_days ?? 0);
  const paidLeave = Number(att.paid_leave ?? 0);

  return (
    <div className="space-y-5">
      <SubHeader title="Payslip" backHref="/payslips" />

      {error ? <AlertBox>{error}</AlertBox> : null}

      {row ? (
        <>
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-[#0b1c30]">Payslip</h1>
            <span className="inline-flex items-center gap-1 rounded-full bg-[#eff4ff] px-3 py-1.5 text-sm font-semibold text-[#004ac6]">
              {row.period_name ?? row.document_number.slice(-8)}
            </span>
          </div>

          <section className={`${ui.cardPeach} p-5`}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-white/75">Net Take Home</p>
                <p className="mt-1 text-3xl font-bold text-white">
                  {hidden ? "••••••" : `₹${net.toLocaleString("en-IN")}`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setHidden((v) => !v)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white"
              >
                {hidden ? <IconEyeOff size={16} /> : <IconEye size={16} />}
              </button>
            </div>
            <div className="mt-5 grid grid-cols-2 divide-x divide-white/20">
              <div className="pr-3">
                <p className="text-xs text-white/70">Earnings</p>
                <p className="font-bold text-white">
                  {hidden ? "••••" : `₹${gross.toLocaleString("en-IN")}`}
                </p>
              </div>
              <div className="pl-3">
                <p className="text-xs text-white/70">Deductions</p>
                <p className="font-bold text-white">
                  {hidden ? "••••" : `-₹${ded.toLocaleString("en-IN")}`}
                </p>
              </div>
            </div>
          </section>

          <div className="grid grid-cols-3 gap-2">
            {["Download", "Share", "Email"].map((a) => (
              <button
                key={a}
                type="button"
                className={`${ui.card} flex flex-col items-center gap-2 py-4 text-sm font-semibold text-[#004ac6]`}
              >
                <IconDownload size={18} />
                {a}
              </button>
            ))}
          </div>

          <section className={`${ui.card} space-y-3 p-4`}>
            <h2 className="flex items-center gap-2 font-semibold text-[#0b1c30]">
              <span className="text-emerald-600">
                <IconWallet size={16} />
              </span>
              Earnings Breakdown
            </h2>
            <PayRow label="Basic Salary" value={basic} hidden={hidden} />
            <PayRow label="HRA Allowance" value={hra} hidden={hidden} />
            <PayRow label="Special Allowance" value={special} hidden={hidden} />
          </section>

          <section className="rounded-2xl bg-[#eff4ff] p-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="font-semibold text-[#004ac6]">PF Contrib.</p>
              <p className="font-bold text-[#004ac6]">
                {hidden ? "••••" : `₹${pf.toLocaleString("en-IN")}`}
              </p>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-[#d3e4fe]">
              <div className="h-full w-1/2 rounded-full bg-[#2563eb]" />
            </div>
            <p className="mt-2 text-xs text-[#434655]">
              Employee: ₹{Math.round(pfEmp)} | Employer: ₹{Math.round(pfEr)}
            </p>
          </section>

          <section className="rounded-2xl bg-[#eff4ff] p-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="font-semibold text-[#ba1a1a]">Tax & TDS</p>
              <p className="font-bold text-[#ba1a1a]">
                {hidden ? "••••" : `₹${tax.toLocaleString("en-IN")}`}
              </p>
            </div>
            <PayRow label="Federal / Income Tax" value={Math.round(tax * 0.86)} hidden={hidden} />
            <PayRow label="State / Other" value={Math.round(tax * 0.14)} hidden={hidden} />
          </section>

          <section className={`${ui.card} p-4`}>
            <h2 className="mb-3 font-semibold text-[#0b1c30]">
              Attendance Period
            </h2>
            <div className="grid grid-cols-3 divide-x divide-[#c3c6d7]/40 text-center">
              <Stat
                value={periodDays ? String(periodDays) : "—"}
                label="Scheduled (N)"
                color="text-[#004ac6]"
              />
              <Stat
                value={leaveDays ? String(leaveDays) : paidLeave ? String(paidLeave) : "0"}
                label="Leave"
                color="text-[#10B981]"
              />
              <Stat
                value={String(lopDays)}
                label="CLWP Days"
                color="text-[#0b1c30]"
              />
            </div>
          </section>

          <div className="flex items-center justify-between">
            <StatusBadge
              status={row.status}
              tone={leaveStatusTone(row.status)}
            />
            <p className="text-xs text-[#434655]">
              Issued {row.issued_at ? formatDateTime(row.issued_at) : "—"}
            </p>
          </div>

          <Link
            href="/payslips/breakdown"
            className="block text-center text-sm font-semibold text-[#004ac6]"
          >
            View salary breakdown
          </Link>
        </>
      ) : null}
    </div>
  );
}

function PayRow({
  label,
  value,
  hidden,
}: {
  label: string;
  value: number;
  hidden: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-1 text-sm">
      <span className="text-[#434655]">{label}</span>
      <span className="font-semibold text-[#0b1c30]">
        {hidden ? "••••" : `₹${value.toLocaleString("en-IN")}`}
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
