import { getDeliveryChallan } from "@/utils/delivery-challan-storage";
import { listDeliveryStatuses } from "@/utils/delivery-status-storage";

const SENT_KEY = "erp.procurement.delivery-reminder-sent";

type SentMap = Record<string, string>;

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDays(isoDate: string, days: number): string {
  const base = new Date(`${isoDate}T12:00:00`);
  base.setDate(base.getDate() + days);
  return base.toISOString().slice(0, 10);
}

function readSentMap(): SentMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(SENT_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as SentMap;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeSentMap(map: SentMap) {
  window.localStorage.setItem(SENT_KEY, JSON.stringify(map));
}

export type DeliveryReminderNotice = {
  challanId: string;
  challanNumber: string;
  purchaseOrderNumber: string;
  email: string;
  expectedDeliveryDate: string;
};

/** Fire reminders when today is one day before expected delivery (client-side queue). */
export function runDeliveryReminderSweep(): DeliveryReminderNotice[] {
  if (typeof window === "undefined") return [];
  const today = todayIso();
  const sent = readSentMap();
  const notices: DeliveryReminderNotice[] = [];

  for (const status of listDeliveryStatuses()) {
    const email = status.reminderEmail.trim();
    const expected = status.expectedDeliveryDate.trim();
    if (!email || !expected) continue;

    const notifyOn = addDays(expected, -1);
    if (today !== notifyOn) continue;

    const dedupeKey = `${status.challanId}:${notifyOn}`;
    if (sent[dedupeKey]) continue;

    const challan = getDeliveryChallan(status.challanId);
    const notice: DeliveryReminderNotice = {
      challanId: status.challanId,
      challanNumber: challan?.challanNumber ?? status.challanId.slice(0, 8),
      purchaseOrderNumber: challan?.purchaseOrderNumber ?? "",
      email,
      expectedDeliveryDate: expected,
    };
    notices.push(notice);

    void queueDeliveryReminderEmail(notice, dedupeKey, sent);
  }

  return notices;
}

async function queueDeliveryReminderEmail(
  notice: DeliveryReminderNotice,
  dedupeKey: string,
  sent: SentMap,
): Promise<void> {
  try {
    const response = await fetch("/api/procurement/delivery-reminder", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        to: notice.email,
        challanNumber: notice.challanNumber,
        purchaseOrderNumber: notice.purchaseOrderNumber,
        expectedDeliveryDate: notice.expectedDeliveryDate,
      }),
    });
    const payload = (await response.json()) as { success?: boolean; message?: string };
    if (!response.ok || payload.success === false) {
      console.warn("Delivery reminder email failed:", payload.message ?? response.status);
      return;
    }

    sent[dedupeKey] = new Date().toISOString();
    writeSentMap(sent);
  } catch (err) {
    console.warn("Delivery reminder email request failed:", err);
    return;
  }

  if (typeof Notification !== "undefined") {
    if (Notification.permission === "default") {
      await Notification.requestPermission();
    }
    if (Notification.permission === "granted") {
      new Notification("Delivery reminder sent", {
        body: `${notice.challanNumber} — email sent to ${notice.email}`,
      });
    }
  }
}
