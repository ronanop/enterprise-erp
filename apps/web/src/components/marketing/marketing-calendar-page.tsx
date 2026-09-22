"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Plus,
  RefreshCw,
} from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { MarketingSignedInProfile } from "@/components/marketing/marketing-signed-in-profile";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatApiError } from "@/services/api-client";
import {
  createMarketingCalendarEntry,
  listCampaignDeliverables,
  listGeneratedContent,
  listMarketingCalendar,
  listMarketingCampaigns,
  updateMarketingCalendarEntry,
  type MarketingGeneratedContent,
  type MarketingCalendarEntry,
  type MarketingCampaign,
  type MarketingCampaignDeliverable,
} from "@/services/marketing-service";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

const STATUS_OPTIONS = [
  { value: "planned", label: "Planned" },
  { value: "scheduled", label: "Scheduled" },
  { value: "published", label: "Published" },
  { value: "cancelled", label: "Cancelled" },
] as const;

type ActivityKind = "publish" | "campaign_start" | "campaign_end" | "deliverable";

type CalendarActivity = {
  id: string;
  kind: ActivityKind;
  dateKey: string;
  title: string;
  subtitle?: string;
  status?: string;
  sortAt: string;
  /** Present when kind === "publish" */
  entry?: MarketingCalendarEntry;
};

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Prefer YYYY-MM-DD slice so date-only API values stay timezone-stable. */
function toActivityDateKey(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10);
  const d = new Date(trimmed);
  if (Number.isNaN(d.getTime())) return null;
  return toDateKey(d);
}

function formatMonthLabel(d: Date): string {
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function kindChipClass(kind: ActivityKind, status?: string): string {
  if (kind === "campaign_start" || kind === "campaign_end") {
    return "border-indigo-200 bg-indigo-50 text-indigo-900";
  }
  if (kind === "deliverable") {
    return "border-teal-200 bg-teal-50 text-teal-900";
  }
  switch (status) {
    case "published":
      return "border-emerald-200 bg-emerald-50 text-emerald-800";
    case "scheduled":
      return "border-sky-200 bg-sky-50 text-sky-800";
    case "cancelled":
      return "border-border bg-muted text-muted-foreground line-through";
    default:
      return "border-amber-200 bg-amber-50 text-amber-900";
  }
}

function kindLabel(kind: ActivityKind): string {
  switch (kind) {
    case "campaign_start":
      return "Campaign start";
    case "campaign_end":
      return "Campaign end";
    case "deliverable":
      return "Deliverable";
    default:
      return "Publish";
  }
}

type MonthCell = {
  date: Date;
  key: string;
  inMonth: boolean;
  isToday: boolean;
};

function buildMonthGrid(anchor: Date): MonthCell[] {
  const first = startOfMonth(anchor);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  const todayKey = toDateKey(new Date());
  const cells: MonthCell[] = [];
  for (let i = 0; i < 42; i++) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    const key = toDateKey(date);
    cells.push({
      date,
      key,
      inMonth: date.getMonth() === anchor.getMonth(),
      isToday: key === todayKey,
    });
  }
  return cells;
}

function defaultDatetimeLocal(dayKey?: string | null): string {
  const base = dayKey ? new Date(`${dayKey}T10:00:00`) : new Date();
  if (!dayKey) {
    base.setMinutes(0, 0, 0);
    base.setHours(base.getHours() + 1);
  }
  const y = base.getFullYear();
  const m = String(base.getMonth() + 1).padStart(2, "0");
  const d = String(base.getDate()).padStart(2, "0");
  const h = String(base.getHours()).padStart(2, "0");
  const min = String(base.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${d}T${h}:${min}`;
}

function buildActivities(
  entries: MarketingCalendarEntry[],
  campaigns: MarketingCampaign[],
  deliverables: MarketingCampaignDeliverable[],
): CalendarActivity[] {
  const campaignName = new Map(campaigns.map((c) => [c.id, c.campaign_name]));
  const activities: CalendarActivity[] = [];

  for (const entry of entries) {
    if (entry.status === "cancelled") continue;
    const dateKey = toActivityDateKey(entry.scheduled_at);
    if (!dateKey) continue;
    activities.push({
      id: `publish:${entry.id}`,
      kind: "publish",
      dateKey,
      title: entry.title,
      subtitle: formatTime(entry.scheduled_at) || undefined,
      status: entry.status,
      sortAt: entry.scheduled_at,
      entry,
    });
  }

  for (const campaign of campaigns) {
    if (campaign.status === "cancelled" || campaign.status === "archived") continue;
    const startKey = toActivityDateKey(campaign.start_date);
    if (startKey) {
      activities.push({
        id: `campaign-start:${campaign.id}`,
        kind: "campaign_start",
        dateKey: startKey,
        title: campaign.campaign_name,
        subtitle: campaign.campaign_code,
        status: campaign.status,
        sortAt: `${startKey}T00:00:00`,
      });
    }
    const endKey = toActivityDateKey(campaign.end_date);
    if (endKey) {
      activities.push({
        id: `campaign-end:${campaign.id}`,
        kind: "campaign_end",
        dateKey: endKey,
        title: campaign.campaign_name,
        subtitle: campaign.campaign_code,
        status: campaign.status,
        sortAt: `${endKey}T23:59:59`,
      });
    }
  }

  for (const row of deliverables) {
    if (row.status === "cancelled") continue;
    const dateKey = toActivityDateKey(row.due_date);
    if (!dateKey) continue;
    const campaignLabel = row.campaign_id ? campaignName.get(row.campaign_id) : undefined;
    activities.push({
      id: `deliverable:${row.id}`,
      kind: "deliverable",
      dateKey,
      title: row.title,
      subtitle: [campaignLabel, row.deliverable_type.replaceAll("_", " ")]
        .filter(Boolean)
        .join(" · "),
      status: row.status,
      sortAt: `${dateKey}T12:00:00`,
    });
  }

  activities.sort((a, b) => a.sortAt.localeCompare(b.sortAt) || a.title.localeCompare(b.title));
  return activities;
}

export function MarketingCalendarPage() {
  const search = useSearchParams();
  const campaignFilter = search.get("campaign");
  const [anchor, setAnchor] = useState(() => startOfMonth(new Date()));
  const [approved, setApproved] = useState<MarketingGeneratedContent[]>([]);
  const [formContentId, setFormContentId] = useState("");
  const [entries, setEntries] = useState<MarketingCalendarEntry[]>([]);
  const [campaigns, setCampaigns] = useState<MarketingCampaign[]>([]);
  const [deliverables, setDeliverables] = useState<MarketingCampaignDeliverable[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(() => toDateKey(new Date()));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formTitle, setFormTitle] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formStatus, setFormStatus] = useState<string>("planned");
  const [formWhen, setFormWhen] = useState(() => defaultDatetimeLocal());
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [calendarRows, campaignRows, contentRows] = await Promise.all([
        listMarketingCalendar(),
        listMarketingCampaigns(),
        listGeneratedContent().catch(() => []),
      ]);
      setApproved(contentRows.filter((row) => row.status === "approved"));
      const deliverableLists = await Promise.all(
        campaignRows.map((c) => listCampaignDeliverables(c.id).catch(() => [])),
      );
      setEntries(calendarRows);
      setCampaigns(campaignRows);
      setDeliverables(deliverableLists.flat());
    } catch (err) {
      setEntries([]);
      setCampaigns([]);
      setDeliverables([]);
      setError(formatApiError(err, "Failed to load calendar"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const visibleEntries = useMemo(
    () => (campaignFilter ? entries.filter((row) => row.campaign_id === campaignFilter) : entries),
    [entries, campaignFilter],
  );
  const visibleCampaigns = useMemo(
    () => (campaignFilter ? campaigns.filter((row) => row.id === campaignFilter) : campaigns),
    [campaigns, campaignFilter],
  );

  const activities = useMemo(
    () => buildActivities(visibleEntries, visibleCampaigns, deliverables),
    [visibleEntries, visibleCampaigns, deliverables],
  );

  const cells = useMemo(() => buildMonthGrid(anchor), [anchor]);

  const byDay = useMemo(() => {
    const map = new Map<string, CalendarActivity[]>();
    for (const item of activities) {
      const list = map.get(item.dateKey) ?? [];
      list.push(item);
      map.set(item.dateKey, list);
    }
    return map;
  }, [activities]);

  const dayActivities = useMemo(() => {
    if (!selectedDay) return [];
    return byDay.get(selectedDay) ?? [];
  }, [byDay, selectedDay]);

  const selectedActivity = useMemo(
    () => activities.find((a) => a.id === selectedId) ?? null,
    [activities, selectedId],
  );

  const selectedEntry = selectedActivity?.kind === "publish" ? selectedActivity.entry ?? null : null;

  const monthCount = useMemo(() => {
    const prefix = `${anchor.getFullYear()}-${String(anchor.getMonth() + 1).padStart(2, "0")}`;
    return activities.filter((a) => a.dateKey.startsWith(prefix)).length;
  }, [anchor, activities]);

  function openSchedule(dayKey?: string | null) {
    const key = dayKey || selectedDay || toDateKey(new Date());
    setSelectedDay(key);
    setSelectedId(null);
    setFormTitle("");
    setFormNotes("");
    setFormStatus("planned");
    setFormWhen(defaultDatetimeLocal(key));
    setFormError(null);
    setShowForm(true);
  }

  function shiftMonth(delta: number) {
    setAnchor((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  }

  async function onCreate() {
    if (!formTitle.trim()) {
      setFormError("Title is required.");
      return;
    }
    if (!formWhen) {
      setFormError("Schedule date/time is required.");
      return;
    }
    setBusy(true);
    setFormError(null);
    setError(null);
    try {
      if (!formContentId) {
        setFormError("Choose an approved caption. Unapproved work cannot reach the calendar.");
        setBusy(false);
        return;
      }
      const created = await createMarketingCalendarEntry({
        title: formTitle.trim(),
        notes: formNotes.trim() || undefined,
        status: "scheduled",
        scheduled_at: new Date(formWhen).toISOString(),
        content_id: formContentId,
        campaign_id: campaignFilter ?? undefined,
      });
      setShowForm(false);
      const dateKey = toActivityDateKey(created.scheduled_at);
      setSelectedId(`publish:${created.id}`);
      if (dateKey) setSelectedDay(dateKey);
      await load();
    } catch (err) {
      setFormError(formatApiError(err, "Could not schedule entry"));
    } finally {
      setBusy(false);
    }
  }

  async function onMarkStatus(status: string) {
    if (!selectedEntry) return;
    setBusy(true);
    setError(null);
    try {
      await updateMarketingCalendarEntry(selectedEntry.id, {
        status,
        version: selectedEntry.version,
      });
      await load();
    } catch (err) {
      setError(formatApiError(err, "Could not update status"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Calendar"
        description="Month view of publishes, campaign dates, and deliverable due dates."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <MarketingSignedInProfile />
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-9 cursor-pointer gap-1.5 transition-colors duration-200"
              disabled={loading || busy}
              onClick={() => void load()}
            >
              {loading ? (
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
              ) : (
                <RefreshCw className="size-3.5" aria-hidden />
              )}
              Refresh
            </Button>
            <Button
              type="button"
              size="sm"
              className="h-9 cursor-pointer gap-1.5 transition-colors duration-200"
              disabled={busy}
              onClick={() => openSchedule(selectedDay)}
            >
              <Plus className="size-3.5" aria-hidden />
              Schedule
            </Button>
          </div>
        }
      />

      {error ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm border border-amber-200 bg-amber-50" aria-hidden />
          Publish
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm border border-indigo-200 bg-indigo-50" aria-hidden />
          Campaign
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm border border-teal-200 bg-teal-50" aria-hidden />
          Deliverable
        </span>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1 overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 px-4 py-3 sm:px-5">
            <div className="flex items-center gap-2">
              <CalendarDays className="size-4 text-muted-foreground" aria-hidden />
              <h2 className="text-sm font-semibold text-foreground">{formatMonthLabel(anchor)}</h2>
              <Badge variant="secondary" className="text-[10px] tabular-nums">
                {monthCount} this month
              </Badge>
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 w-8 cursor-pointer p-0 transition-colors duration-200"
                aria-label="Previous month"
                onClick={() => shiftMonth(-1)}
              >
                <ChevronLeft className="size-4" aria-hidden />
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 cursor-pointer px-2.5 text-xs transition-colors duration-200"
                onClick={() => {
                  const now = new Date();
                  setAnchor(startOfMonth(now));
                  setSelectedDay(toDateKey(now));
                }}
              >
                Today
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 w-8 cursor-pointer p-0 transition-colors duration-200"
                aria-label="Next month"
                onClick={() => shiftMonth(1)}
              >
                <ChevronRight className="size-4" aria-hidden />
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-7 border-b border-border/60 bg-muted/40">
            {WEEKDAYS.map((d) => (
              <div
                key={d}
                className="px-1 py-2 text-center text-[10px] font-medium uppercase tracking-wide text-muted-foreground sm:text-[11px]"
              >
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7">
            {cells.map((cell) => {
              const dayItems = byDay.get(cell.key) ?? [];
              const hasActivity = dayItems.length > 0;
              const visible = dayItems.slice(0, 3);
              const extra = dayItems.length - visible.length;
              const selected = selectedDay === cell.key;
              return (
                <button
                  key={cell.key}
                  type="button"
                  onDragOver={(e) => {
                    e.preventDefault();
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const entryId = e.dataTransfer.getData("text/calendar-entry");
                    if (!entryId) return;
                    const entry = entries.find((row) => row.id === entryId);
                    if (!entry) return;
                    const previous = new Date(entry.scheduled_at);
                    const next = new Date(`${cell.key}T${String(previous.getHours()).padStart(2, "0")}:${String(previous.getMinutes()).padStart(2, "0")}:00`);
                    void updateMarketingCalendarEntry(entryId, {
                      scheduled_at: next.toISOString(),
                      version: entry.version,
                    })
                      .then(() => load())
                      .catch((err) => setError(formatApiError(err, "That hour is already taken")));
                  }}
                  onClick={() => {
                    setSelectedDay(cell.key);
                    setSelectedId(null);
                    setShowForm(false);
                  }}
                  onDoubleClick={() => openSchedule(cell.key)}
                  className={cn(
                    "flex min-h-[88px] cursor-pointer flex-col gap-1 border-b border-r border-border/50 p-1.5 text-left transition-colors duration-200 sm:min-h-[108px] sm:p-2",
                    "hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                    !cell.inMonth && "bg-muted/20 text-muted-foreground",
                    hasActivity && cell.inMonth && !selected && "bg-primary/[0.06]",
                    selected && "bg-primary/5 ring-1 ring-inset ring-primary/30",
                    cell.isToday && !selected && !hasActivity && "bg-sky-50/60",
                  )}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span
                      className={cn(
                        "inline-flex size-6 items-center justify-center rounded-full text-[11px] font-medium tabular-nums",
                        cell.isToday && "bg-primary text-primary-foreground",
                        hasActivity &&
                          !cell.isToday &&
                          "bg-primary/15 font-semibold text-primary",
                      )}
                    >
                      {cell.date.getDate()}
                    </span>
                    {hasActivity ? (
                      <span
                        className="size-1.5 shrink-0 rounded-full bg-primary"
                        aria-hidden
                        title={`${dayItems.length} activities`}
                      />
                    ) : null}
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    {visible.map((item) => (
                      <span
                        key={item.id}
                        role="presentation"
                        draggable={item.kind === "publish"}
                        onDragStart={(e) => {
                          if (!item.entry) return;
                          e.dataTransfer.setData("text/calendar-entry", item.entry.id);
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedDay(cell.key);
                          setSelectedId(item.id);
                          setShowForm(false);
                        }}
                        className={cn(
                          "truncate rounded border px-1 py-0.5 text-[10px] leading-tight transition-colors duration-150",
                          kindChipClass(item.kind, item.status),
                        )}
                        title={`${kindLabel(item.kind)}: ${item.title}`}
                      >
                        {item.kind === "campaign_start"
                          ? "Start · "
                          : item.kind === "campaign_end"
                            ? "End · "
                            : item.kind === "deliverable"
                              ? "Due · "
                              : item.subtitle
                                ? `${item.subtitle} `
                                : ""}
                        {item.title}
                      </span>
                    ))}
                    {extra > 0 ? (
                      <span className="text-[10px] text-muted-foreground">+{extra} more</span>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <aside className="w-full shrink-0 space-y-3 lg:w-[320px]">
          <div className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm">
            <div className="flex items-center justify-between gap-2 border-b border-border/70 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {selectedDay
                    ? new Date(`${selectedDay}T12:00:00`).toLocaleDateString(undefined, {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      })
                    : "Select a day"}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {dayActivities.length} activit{dayActivities.length === 1 ? "y" : "ies"}
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 cursor-pointer gap-1 transition-colors duration-200"
                onClick={() => openSchedule(selectedDay)}
              >
                <Plus className="size-3.5" aria-hidden />
                Add
              </Button>
            </div>

            <div className="max-h-[320px] space-y-2 overflow-y-auto p-3">
              {loading ? (
                <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Loading…
                </p>
              ) : dayActivities.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No campaign, deliverable, or publish activity on this day.
                </p>
              ) : (
                dayActivities.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setSelectedId(item.id);
                      setShowForm(false);
                    }}
                    className={cn(
                      "w-full cursor-pointer rounded-lg border px-3 py-2 text-left transition-colors duration-200",
                      selectedId === item.id
                        ? "border-primary/40 bg-primary/5"
                        : "border-border/70 hover:bg-accent/40",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-foreground">{item.title}</p>
                      <Badge variant="secondary" className="shrink-0 text-[10px] uppercase">
                        {kindLabel(item.kind)}
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-[12px] text-muted-foreground">
                      {[item.subtitle, item.status].filter(Boolean).join(" · ")}
                    </p>
                  </button>
                ))
              )}
            </div>
          </div>

          {selectedActivity && selectedActivity.kind !== "publish" && !showForm ? (
            <div className="space-y-2 rounded-xl border border-border/80 bg-card p-4 shadow-sm">
              <Badge variant="secondary" className="text-[10px] uppercase">
                {kindLabel(selectedActivity.kind)}
              </Badge>
              <p className="text-sm font-semibold text-foreground">{selectedActivity.title}</p>
              {selectedActivity.subtitle ? (
                <p className="text-[12px] text-muted-foreground">{selectedActivity.subtitle}</p>
              ) : null}
              {selectedActivity.status ? (
                <p className="text-[12px] text-muted-foreground">Status: {selectedActivity.status}</p>
              ) : null}
            </div>
          ) : null}

          {selectedEntry && !showForm ? (
            <div className="space-y-3 rounded-xl border border-border/80 bg-card p-4 shadow-sm">
              <div>
                <Badge variant="secondary" className="mb-2 text-[10px] uppercase">
                  Publish
                </Badge>
                <p className="text-sm font-semibold text-foreground">{selectedEntry.title}</p>
                <p className="mt-1 text-[12px] text-muted-foreground">
                  {new Date(selectedEntry.scheduled_at).toLocaleString()}
                </p>
                {selectedEntry.notes ? (
                  <p className="mt-2 text-sm text-foreground/90">{selectedEntry.notes}</p>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                {selectedEntry.status !== "scheduled" && selectedEntry.status !== "published" ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 cursor-pointer transition-colors duration-200"
                    disabled={busy}
                    onClick={() => void onMarkStatus("scheduled")}
                  >
                    Mark scheduled
                  </Button>
                ) : null}
                {selectedEntry.status === "published" ? null : (
                  <p className="text-[12px] text-muted-foreground">
                    Drag the chip to reschedule. A green published state appears only after a live post ID is stored.
                  </p>
                )}
                {selectedEntry.status !== "cancelled" ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-8 cursor-pointer text-destructive transition-colors duration-200"
                    disabled={busy}
                    onClick={() => void onMarkStatus("cancelled")}
                  >
                    Cancel
                  </Button>
                ) : null}
              </div>
            </div>
          ) : null}

          {showForm ? (
            <div className="space-y-3 rounded-xl border border-border/80 bg-card p-4 shadow-sm">
              <p className="text-sm font-semibold text-foreground">Schedule an approved caption</p>
              <select
                value={formContentId}
                onChange={(e) => setFormContentId(e.target.value)}
                disabled={busy}
                className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
                aria-label="Approved caption"
              >
                <option value="">Approved caption</option>
                {approved.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.pipeline_result?.variant ? `${row.pipeline_result.variant} · ` : ""}
                    {row.headline || "Untitled"}
                  </option>
                ))}
              </select>
              <Input
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="Title (e.g. LinkedIn product post)"
                className="h-9"
                disabled={busy}
                aria-label="Entry title"
              />
              <Input
                type="datetime-local"
                value={formWhen}
                onChange={(e) => setFormWhen(e.target.value)}
                className="h-9"
                disabled={busy}
                aria-label="Scheduled at"
              />
              <select
                value={formStatus}
                onChange={(e) => setFormStatus(e.target.value)}
                disabled={busy}
                aria-label="Status"
                className="flex h-9 w-full cursor-pointer rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <Input
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                placeholder="Notes (optional)"
                className="h-9"
                disabled={busy}
                aria-label="Notes"
              />
              {formError ? <p className="text-[12px] text-destructive">{formError}</p> : null}
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  className="h-9 cursor-pointer gap-1.5 transition-colors duration-200"
                  disabled={busy}
                  onClick={() => void onCreate()}
                >
                  {busy ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null}
                  Save
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-9 cursor-pointer transition-colors duration-200"
                  disabled={busy}
                  onClick={() => setShowForm(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
