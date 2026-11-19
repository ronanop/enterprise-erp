"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SubHeader } from "@/components/app-header";
import { IconChevronRight, IconEye, IconEyeOff, IconWallet } from "@/components/icons";
import { AiFab, EmptyState } from "@/components/ui";
import { ApiClientError } from "@/services/api-client";
import { essService } from "@/services/ess-service";
import type { EssBank } from "@/types/api";
import * as ui from "@/theme/classes";

function maskAccount(value: string | null | undefined, show: boolean) {
  if (!value) return "—";
  if (show) return value.replace(/(\d{4})(?=\d)/g, "$1 ").trim();
  if (value.length <= 4) return "****";
  return `**** **** ${value.slice(-4)}`;
}

export default function BankDetailsPage() {
  const [show, setShow] = useState(false);
  const [bank, setBank] = useState<EssBank | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    essService
      .bank()
      .then((res) => setBank(res.data))
      .catch((err) =>
        setError(
          err instanceof ApiClientError ? err.message : "Failed to load bank details",
        ),
      )
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-5">
      <SubHeader
        title="Bank Details"
        backHref="/profile"
        right={
          <Link href="/notifications" className="text-sm font-semibold text-[#004ac6]">
            Help
          </Link>
        }
      />

      {error ? (
        <p className="rounded-xl bg-[#ffdad6] px-3 py-2 text-sm text-[#ba1a1a]">{error}</p>
      ) : null}

      {loading ? (
        <EmptyState title="Loading bank details…" />
      ) : !bank ? (
        <EmptyState title="No bank details on file" />
      ) : (
        <section className={`${ui.card} space-y-4 p-5`}>
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-[#434655]">
                Account Holder
              </p>
              <p className="mt-1 text-xl font-bold text-[#0b1c30]">
                {bank.bank_account_holder || "—"}
              </p>
            </div>
            <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800">
              On file
            </span>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[#434655]">Bank Name</p>
              <p className="font-semibold text-[#0b1c30]">{bank.bank_name || "—"}</p>
            </div>
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#dbe1ff] text-[#004ac6]">
              <IconWallet size={20} />
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-sm text-[#434655]">Account Number</p>
              <div className="mt-1 flex items-center gap-2 font-semibold text-[#0b1c30]">
                <span>{maskAccount(bank.bank_account_number, show)}</span>
                <button
                  type="button"
                  onClick={() => setShow((v) => !v)}
                  className="text-[#004ac6]"
                  aria-label="Toggle account visibility"
                >
                  {show ? <IconEyeOff size={16} /> : <IconEye size={16} />}
                </button>
              </div>
            </div>
            <div>
              <p className="text-sm text-[#434655]">IFSC Code</p>
              <p className="mt-1 font-semibold text-[#0b1c30]">{bank.bank_ifsc || "—"}</p>
            </div>
          </div>

          <div className="rounded-xl bg-[#eff4ff] px-3 py-3 text-sm text-[#004ac6]">
            Your salary will be credited to this account on the 1st of every month.
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-2 text-lg font-semibold text-[#0b1c30]">
          UPI Configuration
        </h2>
        <button
          type="button"
          className={`${ui.card} flex w-full items-center gap-3 p-4 text-left`}
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#eaddff] text-[#712ae2]">
            <IconWallet size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-[#0b1c30]">Connect UPI ID</p>
            <p className="text-sm text-[#434655]">
              Use UPI for expense reimbursements
            </p>
          </div>
          <IconChevronRight className="text-[#c3c6d7]" />
        </button>
      </section>

      <div className="rounded-2xl bg-[#eff4ff] p-4">
        <p className="font-semibold text-[#004ac6]">Bank Grade Security</p>
        <p className="mt-1 text-sm text-[#434655]">
          All financial data is encrypted using AES-256 standards. Our systems
          are regularly audited for compliance.
        </p>
      </div>

      <AiFab href="/payslips" />
    </div>
  );
}
