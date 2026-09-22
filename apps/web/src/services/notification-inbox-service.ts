import { apiClient } from "@/services/api-client";
import type { InboxNotification } from "@/lib/notification-inbox";

export async function listNotificationInbox(): Promise<InboxNotification[]> {
  const res = await apiClient<InboxNotification[]>("/notifications/inbox");
  return Array.isArray(res.data) ? res.data : [];
}

export async function getNotificationUnreadCount(): Promise<number> {
  const res = await apiClient<{ unread_count: number }>("/notifications/unread-count");
  return Number(res.data?.unread_count ?? 0);
}

export async function markNotificationRead(id: string): Promise<InboxNotification | null> {
  const res = await apiClient<InboxNotification>(`/notifications/${id}/read`, {
    method: "POST",
  });
  return res.data ?? null;
}

export async function markAllNotificationsRead(): Promise<number> {
  const res = await apiClient<{ marked: number }>("/notifications/read-all", {
    method: "POST",
  });
  return Number(res.data?.marked ?? 0);
}
