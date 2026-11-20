"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { CacheBrandLogo } from "@/components/cache-brand-logo";
import {
  IconBack,
  IconCheck,
  IconChevronRight,
  IconClock,
  IconClose,
  IconPlus,
} from "@/components/icons";
import { NotificationBellLink } from "@/components/notification-bell-link";
import {
  formatDayNum,
  formatMonthShort,
  matchesStatusTab,
  statusBadge,
  type StatusTab,
} from "@/lib/attendance-request-ui";

export function ModuleHeader({
  title,
  backHref,
}: {
  title: string;
  backHref: string;
}) {
  return (
    <header className="sticky top-0 z-40 -mx-5 mb-1 flex h-14 items-center justify-between gap-2 border-b border-[#c3c6d7]/30 bg-[#f8f9ff]/90 px-3 backdrop-blur-xl">
      <div className="flex min-w-0 items-center gap-1.5">
        <Link
          href={backHref}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[#0b1c30] transition active:scale-95"
          aria-label="Back"
        >
          <IconBack size={20} />
        </Link>
        <CacheBrandLogo href="/home" height={26} />
      </div>
      <h1 className="pointer-events-none absolute inset-x-0 mx-auto max-w-[52%] truncate text-center text-[17px] font-bold tracking-tight text-[#0b1c30]">
        {title}
      </h1>
      <div className="relative z-10 shrink-0 pr-1">
        <NotificationBellLink />
      </div>
    </header>
  );
}

export function StatusTabs({
  value,
  onChange,
  counts,
}: {
  value: StatusTab;
  onChange: (v: StatusTab) => void;
  counts: Record<StatusTab, number>;
}) {
  const tabs: { key: StatusTab; label: string }[] = [
    { key: "all", label: "All" },
    { key: "pending", label: "Pending" },
    { key: "approved", label: "Approved" },
    { key: "rejected", label: "Rejected" },
  ];
  return (
    <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
      {tabs.map((t) => {
        const active = value === t.key;
        return (
          <button
            key={t.key}
            type="button"
            onClick={() => onChange(t.key)}
            className={`shrink-0 rounded-full px-3.5 py-2 text-[13px] font-semibold transition ${
              active
                ? "bg-[#2563eb] text-white shadow-[0_6px_16px_rgba(37,99,235,0.35)]"
                : "bg-[#E8EEF8] text-[#5B6475] active:bg-[#dce6f5]"
            }`}
          >
            {t.label}
            <span className={`ml-1 tabular-nums ${active ? "text-white/90" : "text-[#737686]"}`}>
              ({counts[t.key]})
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function RequestListCard({
  dateYmd,
  title,
  subtitle,
  meta,
  status,
}: {
  dateYmd: string;
  title: string;
  subtitle?: string;
  meta?: string;
  status: string;
}) {
  const badge = statusBadge(status);
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-[#E2E8F0] bg-white p-3.5 shadow-[0_4px_16px_rgba(15,23,42,0.05)]">
      <div className="flex h-[58px] w-[58px] shrink-0 flex-col items-center justify-center rounded-xl bg-[#EFF4FF] text-[#004AC6]">
        <span className="text-[10px] font-bold tracking-wide">
          {formatMonthShort(dateYmd)}
        </span>
        <span className="text-[20px] font-bold leading-none tabular-nums">
          {formatDayNum(dateYmd)}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="truncate text-[15px] font-bold text-[#0b1c30]">{title}</p>
          <span
            className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${badge.className}`}
          >
            {badge.tone === "pending" ? <IconClock size={11} /> : null}
            {badge.tone === "approved" ? <IconCheck size={11} /> : null}
            {badge.tone === "rejected" ? <IconClose size={11} /> : null}
            {badge.label}
          </span>
        </div>
        {subtitle ? (
          <p className="mt-0.5 truncate text-[12px] font-medium text-[#5B6475]">
            {subtitle}
          </p>
        ) : null}
        {meta ? (
          <p className="mt-1 truncate text-[12px] text-[#737686]">{meta}</p>
        ) : null}
      </div>
      <IconChevronRight size={18} className="shrink-0 text-[#C3C6D7]" />
    </div>
  );
}

export function ApplyCta({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex w-full items-center justify-center gap-1.5 rounded-2xl bg-[#2563eb] px-4 py-3.5 text-[15px] font-semibold text-white shadow-[0_10px_24px_rgba(37,99,235,0.28)] transition active:scale-[0.98]"
    >
      <IconPlus size={18} />
      {label}
    </Link>
  );
}

export function FieldLabel({
  children,
  required,
}: {
  children: ReactNode;
  required?: boolean;
}) {
  return (
    <span className="mb-1.5 block text-[13px] font-semibold text-[#434655]">
      {children}
      {required ? <span className="ml-0.5 text-[#BA1A1A]">*</span> : null}
    </span>
  );
}

export function AttachBox({
  fileName,
  onPick,
}: {
  fileName: string | null;
  onPick: (file: File | null) => void;
}) {
  return (
    <label className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-[#C3C6D7] bg-[#F8FAFC] px-4 py-6 text-center transition active:bg-[#EFF4FF]">
      <input
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/*"
        className="hidden"
        onChange={(e) => onPick(e.target.files?.[0] ?? null)}
      />
      <span className="text-[13px] font-semibold text-[#434655]">
        {fileName ? fileName : "Attach file (PDF, JPG, PNG)"}
      </span>
      <span className="text-[11px] text-[#737686]">
        Optional · stored with your request notes
      </span>
    </label>
  );
}

export function countByStatusTab<T extends { status: string }>(
  rows: T[],
): Record<StatusTab, number> {
  return {
    all: rows.length,
    pending: rows.filter((r) => matchesStatusTab(r.status, "pending")).length,
    approved: rows.filter((r) => matchesStatusTab(r.status, "approved")).length,
    rejected: rows.filter((r) => matchesStatusTab(r.status, "rejected")).length,
  };
}
