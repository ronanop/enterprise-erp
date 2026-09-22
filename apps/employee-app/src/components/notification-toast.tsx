"use client";

import Link from "next/link";
import type { EssNotification } from "@/types/api";
import { resolveEssNotificationHref } from "@/lib/notification-href";

type Props = {
  notification: EssNotification;
  onDismiss: () => void;
};

export function NotificationToast({ notification, onDismiss }: Props) {
  const href = resolveEssNotificationHref(notification);

  return (
    <div
      className="pointer-events-auto fixed inset-x-4 bottom-24 z-50 mx-auto max-w-lg"
      role="status"
      aria-live="polite"
    >
      <div className="flex gap-3 rounded-2xl border border-[#d0d4da] bg-[#eceef2] p-4 shadow-lg shadow-black/10">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[#1a1c1e]">{notification.title}</p>
          {notification.body ? (
            <p className="mt-0.5 line-clamp-2 text-xs text-[#44474e]">{notification.body}</p>
          ) : null}
          <Link
            href={href}
            className="mt-2 inline-block text-xs font-semibold text-[#004ac6]"
            onClick={onDismiss}
          >
            Open
          </Link>
        </div>
        <button
          type="button"
          className="shrink-0 rounded-lg px-2 py-1 text-xs text-[#44474e] hover:bg-[#f0f4ff]"
          onClick={onDismiss}
          aria-label="Dismiss notification"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
