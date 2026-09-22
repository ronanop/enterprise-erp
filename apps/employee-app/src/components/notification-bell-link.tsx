"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { IconBell } from "@/components/icons";
import { useNotificationCenter } from "@/context/notification-center-context";
import { ESS_NOTIFICATIONS_UPDATED } from "@/lib/ess-web-push";
import * as ui from "@/theme/classes";

/** Align with first notification poll (~4.5s) so initial badge load does not ring. */
const RING_ARM_DELAY_MS = 5000;
const RING_DURATION_MS = 720;

export function NotificationBellLink({ className = "" }: { className?: string }) {
  const { unreadCount, refreshUnreadCount } = useNotificationCenter();
  const [count, setCount] = useState(unreadCount);
  const [ringing, setRinging] = useState(false);
  const [badgePop, setBadgePop] = useState(false);
  const prevCount = useRef<number | null>(null);
  const canRingRef = useRef(false);
  const ringTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const popTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const arm = window.setTimeout(() => {
      canRingRef.current = true;
    }, RING_ARM_DELAY_MS);
    return () => window.clearTimeout(arm);
  }, []);

  useEffect(() => {
    setCount(unreadCount);
  }, [unreadCount]);

  useEffect(() => {
    function onUpdated(e: Event) {
      const detail = (e as CustomEvent<{ unreadCount: number }>).detail;
      if (detail && typeof detail.unreadCount === "number") {
        setCount(detail.unreadCount);
      } else {
        void refreshUnreadCount();
      }
    }
    window.addEventListener(ESS_NOTIFICATIONS_UPDATED, onUpdated);
    return () => window.removeEventListener(ESS_NOTIFICATIONS_UPDATED, onUpdated);
  }, [refreshUnreadCount]);

  useEffect(() => {
    const prev = prevCount.current;
    if (prev !== null && count > prev && canRingRef.current) {
      setRinging(true);
      setBadgePop(true);
      if (ringTimer.current) clearTimeout(ringTimer.current);
      if (popTimer.current) clearTimeout(popTimer.current);
      ringTimer.current = setTimeout(() => setRinging(false), RING_DURATION_MS);
      popTimer.current = setTimeout(() => setBadgePop(false), 480);
    }
    prevCount.current = count;
  }, [count]);

  useEffect(() => {
    return () => {
      if (ringTimer.current) clearTimeout(ringTimer.current);
      if (popTimer.current) clearTimeout(popTimer.current);
    };
  }, []);

  const label =
    count > 0
      ? `${count} unread notification${count === 1 ? "" : "s"}`
      : "Notifications";

  return (
    <Link
      href="/notifications"
      className={`${ui.notificationBellButton} ${className}`}
      aria-label={label}
    >
      <span className={ringing ? "inline-flex animate-bell-ring" : "inline-flex"}>
        <IconBell size={26} />
      </span>
      {count > 0 ? (
        <span
          className={`${ui.notificationBellBadge}${badgePop ? " animate-badge-pop" : ""}`}
        >
          {count > 99 ? "99+" : count}
        </span>
      ) : null}
    </Link>
  );
}
