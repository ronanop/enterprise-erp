import { essService } from "@/services/ess-service";
import type { EssNotification } from "@/types/api";

const TOKEN_KEY = "ess_web_push_token_v1";
const LAST_TOAST_KEY = "ess_last_toast_notif_id";
const WARM_KEY = "ess_notif_poll_warm_v1";

export function getOrCreateWebDeviceToken(): string | null {
  if (typeof window === "undefined") return null;
  let token = window.localStorage.getItem(TOKEN_KEY);
  if (!token) {
    token = `web-${crypto.randomUUID()}`;
    window.localStorage.setItem(TOKEN_KEY, token);
  }
  return token;
}

export function registerEssWebDeviceToken(delayMs = 3500): void {
  const token = getOrCreateWebDeviceToken();
  if (!token) return;
  window.setTimeout(() => {
    void essService
      .registerDeviceToken({ token, platform: "web" })
      .catch(() => undefined);
  }, delayMs);
}

export function markNotificationPollWarm(latestId: string | undefined): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(WARM_KEY, "1");
  if (latestId) sessionStorage.setItem(LAST_TOAST_KEY, latestId);
}

export function isNotificationPollWarm(): boolean {
  if (typeof window === "undefined") return true;
  return sessionStorage.getItem(WARM_KEY) === "1";
}

export function shouldToastForNotification(latest: EssNotification): boolean {
  if (typeof window === "undefined" || latest.read) return false;
  const last = sessionStorage.getItem(LAST_TOAST_KEY);
  if (last === latest.id) return false;
  sessionStorage.setItem(LAST_TOAST_KEY, latest.id);
  return true;
}

export async function requestBrowserNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "denied";
  }
  if (Notification.permission === "default") {
    return Notification.requestPermission();
  }
  return Notification.permission;
}

export function showBrowserNotification(n: Pick<EssNotification, "title" | "body">): void {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  try {
    new Notification(n.title, {
      body: n.body,
      icon: "/icons/icon-192.png",
      tag: "ess-hr",
    });
  } catch {
    // ignore — some embedded webviews block Notification
  }
}

export const ESS_NOTIFICATIONS_UPDATED = "ess:notifications-updated";

export function dispatchNotificationsUpdated(unreadCount: number): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(ESS_NOTIFICATIONS_UPDATED, { detail: { unreadCount } }),
  );
}
