import type { RecentActivityItem } from "@/components/assets/dashboard.mapper";

export type ActivityDayGroup = "today" | "yesterday" | "earlier";

export type GroupedRecentActivity = {
  group: ActivityDayGroup;
  label: string;
  items: RecentActivityItem[];
};

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function parseActivityDate(value: string): Date | null {
  if (!value || value === "—" || value === "Date unknown") return null;
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) return parsed;
  return null;
}

export function classifyActivityDay(dateValue: string, now = new Date()): ActivityDayGroup {
  const parsed = parseActivityDate(dateValue);
  if (!parsed) return "earlier";
  const today = startOfDay(now);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const day = startOfDay(parsed);
  if (day.getTime() === today.getTime()) return "today";
  if (day.getTime() === yesterday.getTime()) return "yesterday";
  return "earlier";
}

const GROUP_LABELS: Record<ActivityDayGroup, string> = {
  today: "Today",
  yesterday: "Yesterday",
  earlier: "Earlier",
};

/** Groups recent activity into Today / Yesterday / Earlier (presentation only). */
export function groupRecentActivityByDay(
  items: RecentActivityItem[],
  now = new Date(),
): GroupedRecentActivity[] {
  const buckets: Record<ActivityDayGroup, RecentActivityItem[]> = {
    today: [],
    yesterday: [],
    earlier: [],
  };
  for (const item of items) {
    buckets[classifyActivityDay(item.date, now)].push(item);
  }
  return (["today", "yesterday", "earlier"] as ActivityDayGroup[])
    .filter((g) => buckets[g].length > 0)
    .map((g) => ({ group: g, label: GROUP_LABELS[g], items: buckets[g] }));
}
