"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import * as ui from "@/theme/classes";

export function StatusBadge({
  status,
  tone = "neutral",
  onLight = false,
}: {
  status: string;
  tone?: "neutral" | "success" | "warn" | "danger" | "info";
  onLight?: boolean;
}) {
  const darkTones = {
    neutral: "bg-[#eff4ff] text-[#434655]",
    success: "bg-emerald-100 text-emerald-800",
    warn: "bg-amber-100 text-amber-800",
    danger: "bg-[#ffdad6] text-[#ba1a1a]",
    info: "bg-[#dbe1ff] text-[#004ac6]",
  } as const;

  const lightTones = {
    neutral: "bg-white/70 text-[#0b1c30]",
    success: "bg-emerald-600 text-white",
    warn: "bg-amber-500 text-white",
    danger: "bg-[#ba1a1a] text-white",
    info: "bg-[#2563eb] text-white",
  } as const;

  const tones = onLight ? lightTones : darkTones;

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${tones[tone]}`}
    >
      {status.replaceAll("_", " ")}
    </span>
  );
}

export function leaveStatusTone(
  status: string,
): "neutral" | "success" | "warn" | "danger" | "info" {
  const s = status.toLowerCase();
  if (["approved", "paid", "issued", "active", "present", "complete"].includes(s))
    return "success";
  if (["submitted", "draft", "pending"].includes(s)) return "warn";
  if (["rejected", "cancelled", "locked", "absent"].includes(s)) return "danger";
  return "info";
}

export function PageHeader({
  title,
  subtitle,
  action,
  light,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  light?: boolean;
}) {
  void light;
  return (
    <header className="flex items-start justify-between gap-3">
      <div>
        <h1 className="text-[1.65rem] font-bold tracking-tight text-[#0b1c30]">
          {title}
        </h1>
        {subtitle ? (
          <p className={`mt-1 text-sm ${ui.muted}`}>{subtitle}</p>
        ) : null}
      </div>
      {action}
    </header>
  );
}

export function SectionLabel({
  title,
  href,
  linkLabel = "See all",
  light,
}: {
  title: string;
  href?: string;
  linkLabel?: string;
  light?: boolean;
}) {
  void light;
  return (
    <div className="mb-2.5 flex items-center justify-between gap-2 px-0.5">
      <h2 className="text-lg font-semibold text-[#0b1c30]">{title}</h2>
      {href ? (
        <Link
          href={href}
          className="text-sm font-medium text-[#004ac6] hover:opacity-80"
        >
          {linkLabel}
        </Link>
      ) : null}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  icon,
}: {
  title: string;
  description?: string;
  icon?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-[#c3c6d7]/60 bg-white/60 px-4 py-9 text-center">
      {icon ? (
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#dce9ff] text-[#004ac6] shadow-sm">
          {icon}
        </div>
      ) : null}
      <p className="font-semibold text-[#0b1c30]">{title}</p>
      {description ? (
        <p className={`mx-auto mt-1 max-w-[16rem] text-sm ${ui.muted}`}>
          {description}
        </p>
      ) : null}
    </div>
  );
}

export function Avatar({
  name,
  size = "md",
  ring = false,
}: {
  name: string;
  size?: "sm" | "md" | "lg" | "xl";
  ring?: boolean;
}) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");

  const sizes = {
    sm: "h-10 w-10 text-sm",
    md: "h-12 w-12 text-base",
    lg: "h-16 w-16 text-xl",
    xl: "h-24 w-24 text-3xl",
  };

  return (
    <div
      className={`flex items-center justify-center rounded-full bg-gradient-to-br from-[#2563eb] to-[#712ae2] font-bold text-white shadow-md shadow-[#2563eb]/20 ${sizes[size]} ${
        ring ? "ring-2 ring-[#2563eb]/30" : ""
      }`}
    >
      {initials || "?"}
    </div>
  );
}

export function StatTile({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon?: ReactNode;
}) {
  return (
    <div className={`${ui.card} p-4`}>
      <div className="flex items-start justify-between gap-2">
        <p className={`text-[11px] font-bold uppercase tracking-wide ${ui.muted}`}>
          {label}
        </p>
        {icon ? <span className={ui.iconTile}>{icon}</span> : null}
      </div>
      <p className="mt-2 truncate text-2xl font-bold tracking-tight text-[#0b1c30]">
        {value}
      </p>
      {hint ? <p className={`mt-0.5 text-xs ${ui.muted}`}>{hint}</p> : null}
    </div>
  );
}

export function AlertBox({
  tone = "danger",
  children,
  onLight = false,
}: {
  tone?: "danger" | "success" | "warn";
  children: ReactNode;
  onLight?: boolean;
}) {
  const tones = {
    danger: "bg-red-50 text-red-800 border-red-200",
    success: "bg-emerald-50 text-emerald-900 border-emerald-200",
    warn: "bg-amber-50 text-amber-900 border-amber-200",
  };
  void onLight;
  return (
    <div
      className={`rounded-xl border px-3 py-2.5 text-sm font-medium ${tones[tone]}`}
    >
      {children}
    </div>
  );
}

export function FieldRow({ label, value }: { label: string; value: string }) {
  return (
    <div className={`${ui.listRow} justify-between text-sm`}>
      <span className={ui.muted}>{label}</span>
      <span className="max-w-[62%] truncate text-right font-semibold capitalize text-[#0b1c30]">
        {value || "—"}
      </span>
    </div>
  );
}

/** Renders viewport-fixed FABs via portal (avoids transform ancestors breaking `fixed`). */
export function ViewportFab({
  children,
  className,
  onClick,
  href,
  "aria-label": ariaLabel,
}: {
  children: ReactNode;
  className: string;
  onClick?: () => void;
  href?: string;
  "aria-label": string;
}) {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  if (!ready) return null;

  const cls = `fixed bottom-24 right-5 z-[45] flex h-14 w-14 items-center justify-center rounded-full text-white shadow-xl transition hover:scale-105 active:scale-95 ${className}`;

  const node = href ? (
    <Link href={href} aria-label={ariaLabel} data-viewport-fab className={cls}>
      {children}
    </Link>
  ) : (
    <button
      type="button"
      aria-label={ariaLabel}
      data-viewport-fab
      className={cls}
      onClick={onClick}
    >
      {children}
    </button>
  );

  return createPortal(node, document.body);
}

export function AiFab({ href = "/leave" }: { href?: string }) {
  return (
    <ViewportFab
      href={href}
      aria-label="AI assistant"
      className="bg-gradient-to-tr from-[#712ae2] to-[#2563eb]"
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M12 3l1.2 4.8L18 9l-4.8 1.2L12 15l-1.2-4.8L6 9l4.8-1.2L12 3z"
          fill="currentColor"
        />
        <path
          d="M18.5 14.5l.6 2.4 2.4.6-2.4.6-.6 2.4-.6-2.4-2.4-.6 2.4-.6.6-2.4z"
          fill="currentColor"
        />
      </svg>
    </ViewportFab>
  );
}
