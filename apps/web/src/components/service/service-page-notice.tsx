"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { AlertTriangle, Info, X } from "lucide-react";

import { cn } from "@/lib/utils";

export type ServicePageNoticeTone = "info" | "warning" | "neutral" | "danger";

const AUTO_DISMISS_MS = 10_000;

type NoticeItem = {
  id: string;
  message: ReactNode;
  tone?: ServicePageNoticeTone;
};

const TONE_ICON: Record<ServicePageNoticeTone, typeof Info> = {
  info: Info,
  warning: AlertTriangle,
  neutral: Info,
  danger: AlertTriangle,
};

function ServicePageNotice({
  noticeId,
  message,
  tone = "warning",
  onDismiss,
}: {
  noticeId: string;
  message: ReactNode;
  tone?: ServicePageNoticeTone;
  onDismiss: (id: string) => void;
}) {
  useEffect(() => {
    const timer = window.setTimeout(() => onDismiss(noticeId), AUTO_DISMISS_MS);
    return () => window.clearTimeout(timer);
  }, [noticeId, onDismiss]);

  const Icon = TONE_ICON[tone];

  return (
    <div
      role="status"
      className={cn(
        "pointer-events-auto flex items-start gap-2 rounded-xl border bg-card px-3 py-2.5 text-sm shadow-lg motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-top-2 motion-safe:slide-in-from-right-4 motion-safe:duration-200",
        tone === "info"
          ? "border-sky-200"
          : tone === "danger"
            ? "border-destructive/40"
            : tone === "warning"
              ? "border-amber-200"
              : "border-border",
      )}
    >
      <Icon
        className={cn(
          "mt-0.5 size-4 shrink-0",
          tone === "info"
            ? "text-sky-600"
            : tone === "danger"
              ? "text-destructive"
              : tone === "warning"
                ? "text-amber-600"
                : "text-muted-foreground",
        )}
      />
      <div className="min-w-0 flex-1 text-xs leading-relaxed text-foreground">{message}</div>
      <button
        type="button"
        aria-label="Dismiss notice"
        className="shrink-0 cursor-pointer text-muted-foreground hover:text-foreground"
        onClick={() => onDismiss(noticeId)}
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}

export function ServicePageNoticeHost({ notices }: { notices: NoticeItem[] }) {
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set());

  const dismiss = useCallback((id: string) => {
    setDismissed((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  const visible = notices.filter((notice) => !dismissed.has(notice.id));
  if (!visible.length) return null;

  return (
    <div
      className="pointer-events-none fixed top-16 right-4 z-[70] flex w-full max-w-sm flex-col gap-2"
      aria-live="polite"
    >
      {visible.map((notice) => (
        <ServicePageNotice
          key={notice.id}
          noticeId={notice.id}
          tone={notice.tone}
          message={notice.message}
          onDismiss={dismiss}
        />
      ))}
    </div>
  );
}
