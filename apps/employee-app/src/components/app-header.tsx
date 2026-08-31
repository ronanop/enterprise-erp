"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { IconBack } from "@/components/icons";
import { NotificationBellLink } from "@/components/notification-bell-link";
import { Avatar } from "@/components/ui";

export function AppHeader({
  title = "Employee Portal",
  name,
}: {
  title?: string;
  name?: string;
}) {
  return (
    <header className="sticky top-0 z-40 -mx-5 mb-1 flex h-14 items-center justify-between gap-3 border-b border-[#c3c6d7]/30 bg-[#f8f9ff]/80 px-5 backdrop-blur-xl">
      <div className="flex min-w-0 items-center gap-3">
        <Link href="/profile" className="shrink-0">
          <Avatar name={name ?? ""} size="sm" ring />
        </Link>
        <span className="truncate text-lg font-bold tracking-tight text-[#004ac6]">
          {title}
        </span>
      </div>
      <NotificationBellLink />
    </header>
  );
}

export function SubHeader({
  title,
  backHref = "/home",
  right,
  name,
}: {
  title: string;
  backHref?: string;
  right?: ReactNode;
  name?: string;
}) {
  return (
    <header className="sticky top-0 z-40 -mx-5 mb-3 flex h-14 items-center justify-between gap-3 border-b border-[#c3c6d7]/30 bg-[#f8f9ff]/80 px-5 backdrop-blur-xl">
      <div className="flex min-w-0 items-center gap-2">
        <Link
          href={backHref}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[#0b1c30] transition active:scale-95"
          aria-label="Back"
        >
          <IconBack size={20} />
        </Link>
        <h1 className="truncate text-lg font-bold tracking-tight text-[#0b1c30]">
          {title}
        </h1>
      </div>
      {right ??
        (name ? (
          <Link href="/profile" className="shrink-0">
            <Avatar name={name} size="sm" ring />
          </Link>
        ) : (
          <NotificationBellLink />
        ))}
    </header>
  );
}

export function FilterChips({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
      {options.map((opt) => {
        const active = value === opt;
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition ${
              active
                ? "bg-[#004ac6] text-white"
                : "bg-[#eff4ff] text-[#434655]"
            }`}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

export function SearchField({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <label className="flex items-center gap-2 rounded-full border border-[#c3c6d7]/50 bg-white px-4 py-2.5 shadow-sm">
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#737686"
        strokeWidth="2"
        aria-hidden
      >
        <circle cx="11" cy="11" r="7" />
        <path d="M20 20l-3.5-3.5" />
      </svg>
      <input
        className="w-full bg-transparent text-sm text-[#0b1c30] outline-none placeholder:text-[#434655]/70"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </label>
  );
}
