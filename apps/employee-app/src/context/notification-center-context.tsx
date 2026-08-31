"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { NotificationToast } from "@/components/notification-toast";
import {
  dispatchNotificationsUpdated,
  isNotificationPollWarm,
  markNotificationPollWarm,
  registerEssWebDeviceToken,
  shouldToastForNotification,
  showBrowserNotification,
} from "@/lib/ess-web-push";
import { essService } from "@/services/ess-service";
import type { EssNotification } from "@/types/api";

const POLL_MS = 30_000;
const TOAST_MS = 6_000;

type NotificationCenterValue = {
  unreadCount: number;
  refreshUnreadCount: () => Promise<void>;
  requestAlertsPermission: () => Promise<NotificationPermission>;
  browserPermission: NotificationPermission | "unsupported";
};

const NotificationCenterContext = createContext<NotificationCenterValue | null>(null);

export function NotificationCenterProvider({ children }: { children: React.ReactNode }) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [toast, setToast] = useState<EssNotification | null>(null);
  const [browserPermission, setBrowserPermission] = useState<
    NotificationPermission | "unsupported"
  >("default");
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismissToast = useCallback(() => {
    setToast(null);
    if (toastTimer.current) {
      clearTimeout(toastTimer.current);
      toastTimer.current = null;
    }
  }, []);

  const showToast = useCallback(
    (n: EssNotification) => {
      dismissToast();
      setToast(n);
      showBrowserNotification(n);
      toastTimer.current = setTimeout(() => setToast(null), TOAST_MS);
    },
    [dismissToast],
  );

  const poll = useCallback(async () => {
    try {
      const res = await essService.notificationPoll();
      const data = res.data;
      if (!data) return;
      const count = data.unread_count ?? 0;
      setUnreadCount(count);
      dispatchNotificationsUpdated(count);

      const latest = data.latest;
      if (!latest) {
        if (!isNotificationPollWarm()) markNotificationPollWarm(undefined);
        return;
      }
      if (!isNotificationPollWarm()) {
        markNotificationPollWarm(latest.id);
        return;
      }
      if (shouldToastForNotification(latest)) {
        showToast(latest);
      }
    } catch {
      // silent — offline or auth blip
    }
  }, [showToast]);

  const refreshUnreadCount = useCallback(async () => {
    try {
      const res = await essService.notificationUnreadCount();
      const count = res.data?.unread_count ?? 0;
      setUnreadCount(count);
      dispatchNotificationsUpdated(count);
    } catch {
      setUnreadCount(0);
    }
  }, []);

  const requestAlertsPermission = useCallback(async () => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setBrowserPermission("unsupported");
      return "denied" as NotificationPermission;
    }
    const perm =
      Notification.permission === "default"
        ? await Notification.requestPermission()
        : Notification.permission;
    setBrowserPermission(perm);
    return perm;
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("Notification" in window)) {
      setBrowserPermission("unsupported");
    } else {
      setBrowserPermission(Notification.permission);
    }
    registerEssWebDeviceToken();
    const startDelay = window.setTimeout(() => {
      void poll();
    }, 4500);
    const id = window.setInterval(() => void poll(), POLL_MS);
    return () => {
      window.clearTimeout(startDelay);
      window.clearInterval(id);
      dismissToast();
    };
  }, [poll, dismissToast]);

  const value = useMemo(
    () => ({
      unreadCount,
      refreshUnreadCount,
      requestAlertsPermission,
      browserPermission,
    }),
    [unreadCount, refreshUnreadCount, requestAlertsPermission, browserPermission],
  );

  return (
    <NotificationCenterContext.Provider value={value}>
      {children}
      {toast ? <NotificationToast notification={toast} onDismiss={dismissToast} /> : null}
    </NotificationCenterContext.Provider>
  );
}

export function useNotificationCenter(): NotificationCenterValue {
  const ctx = useContext(NotificationCenterContext);
  if (!ctx) {
    throw new Error("useNotificationCenter must be used within NotificationCenterProvider");
  }
  return ctx;
}
