"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { SubHeader } from "@/components/app-header";
import {
  IconCalendar,
  IconClock,
  IconSparkle,
  IconWallet,
} from "@/components/icons";
import { AiFab, EmptyState } from "@/components/ui";
import { ApiClientError } from "@/services/api-client";
import { essService } from "@/services/ess-service";
import { useNotificationCenter } from "@/context/notification-center-context";
import { resolveEssNotificationHref } from "@/lib/notification-href";
import { registerEssWebDeviceToken } from "@/lib/ess-web-push";
import type { EssNotification } from "@/types/api";
import * as ui from "@/theme/classes";

type UiNotification = EssNotification & {
  when: string;
  group: "today" | "yesterday" | "older";
  unread: boolean;
  tone: "blue" | "purple" | "green" | "red" | "amber";
};

function groupFor(createdAt: string): UiNotification["group"] {
  const created = new Date(createdAt);
  if (Number.isNaN(created.getTime())) return "older";
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startYesterday = new Date(startToday);
  startYesterday.setDate(startYesterday.getDate() - 1);
  if (created >= startToday) return "today";
  if (created >= startYesterday) return "yesterday";
  return "older";
}

function formatWhen(createdAt: string): string {
  const d = new Date(createdAt);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function toneFor(kind: string): UiNotification["tone"] {
  if (kind === "leave" || kind === "event") return "purple";
  if (kind === "salary") return "green";
  if (kind === "task" || kind === "birthday") return "amber";
  return "blue";
}

function toUi(rows: EssNotification[]): UiNotification[] {
  return rows.map((n) => ({
    ...n,
    when: formatWhen(n.created_at),
    group: groupFor(n.created_at),
    unread: !n.read,
    tone: toneFor(n.kind),
  }));
}

export default function NotificationsPage() {
  const [items, setItems] = useState<UiNotification[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { refreshUnreadCount, requestAlertsPermission, browserPermission } =
    useNotificationCenter();

  useEffect(() => {
    essService
      .notifications()
      .then((res) => setItems(toUi(res.data ?? [])))
      .catch((err) =>
        setError(
          err instanceof ApiClientError
            ? err.message
            : "Failed to load notifications",
        ),
      )
      .finally(() => setLoading(false));

    registerEssWebDeviceToken();
  }, []);

  const groups = useMemo(() => {
    const order: Array<UiNotification["group"]> = [
      "today",
      "yesterday",
      "older",
    ];
    return order
      .map((g) => ({
        key: g,
        label: g.toUpperCase(),
        rows: items.filter((n) => n.group === g),
      }))
      .filter((g) => g.rows.length > 0);
  }, [items]);

  function markOneRead(id: string) {
    setItems((prev) =>
      prev.map((n) =>
        n.id === id ? { ...n, unread: false, read: true } : n,
      ),
    );
    void essService.markNotificationRead(id).then(() => refreshUnreadCount());
  }

  function markAllRead() {
    void essService
      .markAllNotificationsRead()
      .then(() => {
        setItems((prev) =>
          prev.map((n) => ({ ...n, unread: false, read: true })),
        );
        void refreshUnreadCount();
      })
      .catch(() => {
        setItems((prev) =>
          prev.map((n) => ({ ...n, unread: false, read: true })),
        );
      });
  }

  return (
    <div className="space-y-5">
      <SubHeader
        title="Notifications"
        backHref="/home"
        right={
          <button
            type="button"
            onClick={markAllRead}
            className="shrink-0 text-sm font-semibold text-[#004ac6]"
          >
            Mark all as read
          </button>
        }
      />

      {browserPermission === "default" ? (
        <div className={`${ui.card} flex flex-col gap-2 p-4`}>
          <p className="text-sm font-medium text-[#0b1c30]">Alerts on this device</p>
          <p className="text-xs text-[#434655]">
            Allow browser notifications to get popups when leave or HR updates arrive
            (in-app toasts still work while the portal is open).
          </p>
          <button
            type="button"
            className="self-start rounded-full bg-[#004ac6] px-4 py-2 text-xs font-semibold text-white"
            onClick={() => void requestAlertsPermission()}
          >
            Enable alerts
          </button>
        </div>
      ) : null}

      {error ? (
        <p className="rounded-xl bg-[#ffdad6] px-3 py-2 text-sm text-[#ba1a1a]">{error}</p>
      ) : null}

      {loading ? (
        <EmptyState title="Loading notifications…" />
      ) : groups.length === 0 ? (
        <EmptyState title="No notifications" />
      ) : (
        groups.map((g) => (
          <section key={g.key}>
            <p className="mb-2 px-0.5 text-xs font-bold uppercase tracking-wide text-[#434655]">
              {g.label}
            </p>
            <ul className="space-y-2">
              {g.rows.map((n) => {
                const href = resolveEssNotificationHref(n);
                return (
                  <li key={n.id}>
                    <Link
                      href={href}
                      onClick={() => {
                        if (n.unread) markOneRead(n.id);
                      }}
                      className={`${ui.card} relative flex gap-3 border border-[#d8dce2] bg-[#eceef2] p-4 transition-colors active:bg-[#e2e5ea] ${
                        n.unread ? "ring-1 ring-[#004ac6]/20" : "opacity-95"
                      }`}
                    >
                      <span
                        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${toneBg(n.tone)}`}
                      >
                        {iconFor(n)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-semibold text-[#0b1c30]">{n.title}</p>
                          <span className="shrink-0 text-xs text-[#5c5f66]">
                            {n.when}
                          </span>
                        </div>
                        <p className="mt-0.5 text-sm text-[#434655]">{n.body}</p>
                      </div>
                      {n.unread ? (
                        <span className="absolute right-3 top-3 h-2 w-2 rounded-full bg-[#2563eb]" />
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}

      <Link
        href="/announcements"
        className="block text-center text-sm font-semibold text-[#004ac6]"
      >
        View company announcements
      </Link>

      <AiFab href="/leave" />
    </div>
  );
}

function toneBg(tone: UiNotification["tone"]) {
  if (tone === "purple") return "bg-[#eaddff] text-[#712ae2]";
  if (tone === "green") return "bg-emerald-100 text-emerald-700";
  if (tone === "red" || tone === "amber") return "bg-[#ffdad6] text-[#ba1a1a]";
  return "bg-[#dbe1ff] text-[#004ac6]";
}

function iconFor(n: UiNotification) {
  if (n.kind === "leave" || n.kind === "event")
    return <IconCalendar size={18} />;
  if (n.kind === "salary") return <IconWallet size={18} />;
  if (n.kind === "task" || n.kind === "birthday")
    return <IconSparkle size={18} />;
  return <IconClock size={18} />;
}
