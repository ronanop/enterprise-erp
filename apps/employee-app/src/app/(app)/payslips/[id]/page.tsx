"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { SubHeader } from "@/components/app-header";
import { IconDownload } from "@/components/icons";
import { AlertBox } from "@/components/ui";
import {
  formatInr,
  parsePayslipLines,
  periodLabel,
} from "@/lib/payslip-display";
import { ApiClientError } from "@/services/api-client";
import { essService } from "@/services/ess-service";
import type { EssPayslip } from "@/types/api";
import * as ui from "@/theme/classes";

export default function PayslipViewerPage() {
  const params = useParams<{ id: string }>();
  const [row, setRow] = useState<EssPayslip | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!params.id) return;
    let cancelled = false;
    setLoading(true);
    essService
      .payslip(params.id)
      .then((res) => {
        if (!cancelled) setRow(res.data);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(
            err instanceof ApiClientError
              ? err.message
              : "Failed to load payslip",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [params.id]);

  const parsed = useMemo(
    () => (row ? parsePayslipLines(row) : null),
    [row],
  );

  async function onDownload() {
    if (!row) return;
    setDownloading(true);
    setError(null);
    try {
      const { downloadEssPayslip } = await import("@/lib/download-ess-payslip");
      await downloadEssPayslip(row);
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
    <div className="space-y-5 pb-4">
      <SubHeader title="Payslip" backHref="/payslips" />

      {error ? <AlertBox>{error}</AlertBox> : null}

      {loading ? (
        <p className="py-12 text-center text-sm text-[#737686]">
          Loading payslip…
        </p>
      ) : null}

      {row && parsed ? (
        <>
          <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-[#EEF2FF] via-[#E8F0FF] to-[#F3E8FF] p-5 shadow-[0_8px_24px_rgba(37,99,235,0.08)]">
            <p className="text-sm font-medium text-[#64748B]">
              {periodLabel(row)}
            </p>
            <p className="mt-2 text-[2rem] font-bold leading-none tracking-tight text-[#0b1c30]">
              {formatInr(parsed.net)}
            </p>
            <p className="mt-2 text-sm font-semibold text-[#64748B]">
              Net Salary
            </p>
          </section>

          <section className={`${ui.card} space-y-1 p-4`}>
            <h2 className="mb-2 text-[15px] font-bold text-[#0b1c30]">
              Earnings
            </h2>
            {parsed.earnings.map((line) => (
              <PayRow
                key={`e-${line.label}`}
                label={line.label}
                amount={line.amount}
              />
            ))}
            <div className="mt-2 flex items-center justify-between border-t border-[#E8EEF6] pt-3 text-[15px] font-bold text-[#0b1c30]">
              <span>Gross Salary</span>
              <span className="tabular-nums">{formatInr(parsed.gross)}</span>
            </div>
          </section>

          <section className={`${ui.card} space-y-1 p-4`}>
            <h2 className="mb-2 text-[15px] font-bold text-[#0b1c30]">
              Deductions
            </h2>
            {parsed.deductions.length === 0 ? (
              <p className="py-2 text-sm text-[#737686]">No deductions</p>
            ) : (
              parsed.deductions.map((line) => (
                <PayRow
                  key={`d-${line.label}`}
                  label={line.label}
                  amount={line.amount}
                />
              ))
            )}
            <div className="mt-2 flex items-center justify-between border-t border-[#E8EEF6] pt-3 text-[15px] font-bold text-[#0b1c30]">
              <span>Total Deduction</span>
              <span className="tabular-nums">
                {formatInr(parsed.deductionsTotal)}
              </span>
            </div>
          </section>

          <div className="flex items-center justify-between rounded-2xl bg-[#ECFDF5] px-4 py-3.5">
            <span className="text-[15px] font-bold text-[#059669]">
              Net Salary
            </span>
            <span className="text-[15px] font-bold tabular-nums text-[#059669]">
              {formatInr(parsed.net)}
            </span>
          </div>

          <button
            type="button"
            onClick={() => void onDownload()}
            disabled={downloading}
            className={`${ui.btn} flex w-full items-center justify-center gap-2 !py-3.5`}
          >
            <IconDownload size={18} />
            {downloading ? "Preparing…" : "Download Payslip"}
          </button>
        </>
      ) : null}
    </div>
  );
}

function PayRow({ label, amount }: { label: string; amount: number }) {
  return (
    <div className="flex items-center justify-between py-2 text-[14px]">
      <span className="pr-3 text-[#64748B]">{label}</span>
      <span className="shrink-0 font-semibold tabular-nums text-[#0b1c30]">
        {formatInr(amount)}
      </span>
    </div>
  );
}
