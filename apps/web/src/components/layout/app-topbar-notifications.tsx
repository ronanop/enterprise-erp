"use client";

import { GlobalNotificationBell } from "@/components/layout/global-notification-bell";

/**
 * Standalone HRMS topbar notifications — platform inbox only.
 * CRM / Projects approval bells were removed with those modules.
 */
export function AppTopbarNotifications() {
  return <GlobalNotificationBell />;
}
