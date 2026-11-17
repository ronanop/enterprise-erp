"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type SVGProps,
} from "react";
import Link from "next/link";
import {
  IconBack,
  IconBell,
  IconCalendar,
  IconClose,
  IconDocument,
  IconFilter,
  IconGear,
  IconLayers,
  IconMegaphone,
  IconMoreVertical,
  IconSparkle,
  IconUser,
  IconWallet,
} from "@/components/icons";
import { ApiClientError } from "@/services/api-client";
import { essService } from "@/services/ess-service";
import { useNotificationCenter } from "@/context/notification-center-context";
import { resolveEssNotificationHref } from "@/lib/notification-href";
import { registerEssWebDeviceToken } from "@/lib/ess-web-push";
import type { EssNotification } from "@/types/api";

type IconComp = ComponentType<SVGProps<SVGSVGElement> & { size?: number }>;

type FilterId = "all" | "alerts" | "updates" | "announcements";

type DaysFilter = 7 | 15 | 30 | 60 | 90;

const DAYS_FILTERS: { value: DaysFilter; label: string }[] = [
  { value: 7, label: "7 days" },
  { value: 15, label: "15 days" },
  { value: 30, label: "30 days" },
  { value: 60, label: "60 days" },
  { value: 90, label: "90 days" },
];

type CategoryMeta = {
  label: string;
  filter: FilterId;
  badgeClass: string;
  cardClass: string;
  iconWrap: string;
  iconColor: string;
  Icon: IconComp;
};

type UiNotification = EssNotification & {
  when: string;
  group: "today" | "yesterday" | "older";
  unread: boolean;
  category: CategoryMeta;
};

const BANNER_DISMISS_KEY = "ess-notif-enable-banner-dismissed";

const FILTERS: {
  id: FilterId;
  label: string;
  Icon?: IconComp;
  idleClass: string;
  activeClass: string;
}[] = [
  {
    id: "all",
    label: "All",
    idleClass: "border border-[#c7d2fe] bg-[#eef2ff] text-[#1e3a8a]",
    activeClass: "border border-[#004ac6] bg-[#004ac6] text-white",
  },
  {
    id: "alerts",
    label: "Alerts",
    Icon: IconBell,
    idleClass: "border border-[#fecaca] bg-[#fef2f2] text-[#b91c1c]",
    activeClass: "border border-[#dc2626] bg-[#dc2626] text-white",
  },
  {
    id: "updates",
    label: "Updates",
    Icon: IconLayers,
    idleClass: "border border-[#c7d2fe] bg-[#eef2ff] text-[#3730a3]",
    activeClass: "border border-[#4f46e5] bg-[#4f46e5] text-white",
  },
  {
    id: "announcements",
    label: "Announcements",
    Icon: IconMegaphone,
    idleClass: "border border-[#ddd6fe] bg-[#f5f3ff] text-[#6d28d9]",
    activeClass: "border border-[#7c3aed] bg-[#7c3aed] text-white",
  },
];

function categoryFor(kind: string, title = ""): CategoryMeta {
  const k = `${kind || ""} ${title || ""}`.toLowerCase();
  if (
    k.includes("holiday") ||
    k.includes("diwali") ||
    k.includes("deepavali") ||
    k.includes("closed") ||
    k.includes("event") ||
    k.includes("birthday") ||
    k.includes("celebration") ||
    k.includes("policy") ||
    k.includes("announce") ||
    k.includes("news")
  ) {
    return {
      label: "Announcement",
      filter: "announcements",
      badgeClass: "bg-[#ede9fe] text-[#7c3aed]",
      cardClass: "bg-[#f5f3ff] border-[#ddd6fe]/70",
      iconWrap: "bg-[#ede9fe]",
      iconColor: "text-[#7c3aed]",
      Icon: k.includes("policy")
        ? IconDocument
        : k.includes("event") || k.includes("birthday")
          ? IconCalendar
          : IconMegaphone,
    };
  }
  if (
    k.includes("salary") ||
    k.includes("payslip") ||
    k === "payroll" ||
    k.includes("profile") ||
    k.includes("wfh") ||
    k.includes("approved") ||
    k.includes("update")
  ) {
    return {
      label: "Update",
      filter: "updates",
      badgeClass: "bg-[#e0e7ff] text-[#4f46e5]",
      cardClass: "bg-[#eef2ff] border-[#c7d2fe]/70",
      iconWrap: "bg-[#e0e7ff]",
      iconColor: "text-[#4f46e5]",
      Icon: k.includes("payslip") || k.includes("salary")
        ? IconWallet
        : k.includes("profile")
          ? IconUser
          : IconLayers,
    };
  }
  if (k.includes("leave") || k === "compoff" || k === "on_duty") {
    return {
      label: "Leave",
      filter: "alerts",
      badgeClass: "bg-[#d1fae5] text-[#059669]",
      cardClass: "bg-[#f0fdf4] border-[#bbf7d0]/60",
      iconWrap: "bg-[#d1fae5]",
      iconColor: "text-[#059669]",
      Icon: IconCalendar,
    };
  }
  if (k.includes("train") || k === "task") {
    return {
      label: "Training",
      filter: "updates",
      badgeClass: "bg-[#dbeafe] text-[#2563eb]",
      cardClass: "bg-[#eff6ff] border-[#bfdbfe]/70",
      iconWrap: "bg-[#dbeafe]",
      iconColor: "text-[#2563eb]",
      Icon: IconSparkle,
    };
  }
  if (k.includes("system") || k.includes("compliance") || k.includes("security")) {
    return {
      label: "System",
      filter: "alerts",
      badgeClass: "bg-[#f1f5f9] text-[#64748b]",
      cardClass: "bg-[#f8fafc] border-[#e2e8f0]",
      iconWrap: "bg-[#f1f5f9]",
      iconColor: "text-[#64748b]",
      Icon: IconGear,
    };
  }
  return {
    label: "Alert",
    filter: "alerts",
    badgeClass: "bg-[#fee2e2] text-[#dc2626]",
    cardClass: "bg-[#fef2f2] border-[#fecaca]/70",
    iconWrap: "bg-[#fee2e2]",
    iconColor: "text-[#dc2626]",
    Icon: IconBell,
  };
}

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

function formatRelative(createdAt: string): string {
  const d = new Date(createdAt);
  if (Number.isNaN(d.getTime())) return "";
  const diffMs = Date.now() - d.getTime();
  const mins = Math.max(0, Math.floor(diffMs / 60_000));
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

function toUi(rows: EssNotification[]): UiNotification[] {
  return rows.map((n) => ({
    ...n,
    when: formatRelative(n.created_at),
    group: groupFor(n.created_at),
    unread: !n.read,
    category: categoryFor(n.kind, n.title),
  }));
}

function EmptyBellIllustration() {
  return (
    <div className="relative mx-auto flex h-[14rem] w-full max-w-[19rem] items-center justify-center">
      {/* eslint-disable-next-line @next/next/no-img-element -- static empty-state asset */}
      <img
        src="/illustrations/notifications-empty.png"
        alt=""
        width={439}
        height={265}
        className="h-full w-full object-contain object-center select-none"
        draggable={false}
        aria-hidden
      />
    </div>
  );
}

export default function NotificationsPage() {
  const [items, setItems] = useState<UiNotification[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterId>("all");
  const [daysFilter, setDaysFilter] = useState<DaysFilter | null>(null);
  const [daysMenuOpen, setDaysMenuOpen] = useState(false);
  const daysMenuRef = useRef<HTMLDivElement | null>(null);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [bannerReady, setBannerReady] = useState(false);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const { refreshUnreadCount, requestAlertsPermission, browserPermission } =
    useNotificationCenter();

  useEffect(() => {
    if (!daysMenuOpen) return;
    function onPointerDown(e: MouseEvent | TouchEvent) {
      const el = daysMenuRef.current;
      if (!el) return;
      if (e.target instanceof Node && !el.contains(e.target)) {
        setDaysMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
    };
  }, [daysMenuOpen]);

  useEffect(() => {
    try {
      setBannerDismissed(
        window.sessionStorage.getItem(BANNER_DISMISS_KEY) === "1",
      );
    } catch {
      setBannerDismissed(false);
    }
    setBannerReady(true);

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

  const showEnableBanner =
    bannerReady &&
    !bannerDismissed &&
    browserPermission === "default";

  const filtered = useMemo(() => {
    const inRange =
      daysFilter == null
        ? items
        : items.filter((n) => {
            const t = new Date(n.created_at).getTime();
            if (Number.isNaN(t)) return true;
            const cutoff = Date.now() - daysFilter * 86_400_000;
            return t >= cutoff;
          });
    if (filter === "all") return inRange;
    return inRange.filter((n) => n.category.filter === filter);
  }, [items, filter, daysFilter]);

  const groups = useMemo(() => {
    const order: Array<UiNotification["group"]> = [
      "today",
      "yesterday",
      "older",
    ];
    const labels: Record<UiNotification["group"], string> = {
      today: "Today",
      yesterday: "Yesterday",
      older: "Earlier",
    };
    return order
      .map((g) => ({
        key: g,
        label: labels[g],
        rows: filtered.filter((n) => n.group === g),
      }))
      .filter((g) => g.rows.length > 0);
  }, [filtered]);

  const isEmpty = !loading && !error && items.length === 0;

  function dismissBanner() {
    setBannerDismissed(true);
    try {
      window.sessionStorage.setItem(BANNER_DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
  }

  function markOneRead(id: string) {
    setItems((prev) =>
      prev.map((n) =>
        n.id === id ? { ...n, unread: false, read: true } : n,
      ),
    );
    setMenuOpenId(null);
    void essService.markNotificationRead(id).then(() => refreshUnreadCount());
  }

  return (
    <div className="space-y-4 pb-2">
      <header className="sticky top-0 z-40 -mx-5 mb-1 grid h-14 grid-cols-[7.25rem_1fr_7.25rem] items-center gap-1 border-b border-[#c3c6d7]/25 bg-[#f8f9ff]/90 px-3 backdrop-blur-xl sm:px-5">
        <Link
          href="/home"
          className="flex h-10 w-10 items-center justify-center justify-self-start rounded-full text-[#0b1c30] transition active:scale-95"
          aria-label="Back"
        >
          <IconBack size={20} />
        </Link>
        <h1 className="truncate text-center text-lg font-bold tracking-tight text-[#0b1c30]">
          Notifications
        </h1>
        <div className="relative flex justify-end" ref={daysMenuRef}>
          <button
            type="button"
            onClick={() => setDaysMenuOpen((o) => !o)}
            className="inline-flex h-9 max-w-full items-center gap-1.5 rounded-full border border-[#c7d2fe] bg-white px-3 text-xs font-semibold text-[#004ac6] shadow-sm transition active:scale-95"
            aria-haspopup="menu"
            aria-expanded={daysMenuOpen}
            aria-label="Filter notifications by days"
          >
            <IconFilter size={14} className="shrink-0" />
            Filter
            {daysFilter != null ? (
              <span className="rounded-full bg-[#eff4ff] px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-[#2563eb]">
                {daysFilter}d
              </span>
            ) : null}
          </button>
          {daysMenuOpen ? (
            <div
              role="menu"
              className="absolute right-0 top-[calc(100%+0.4rem)] z-50 w-[10.5rem] overflow-hidden rounded-2xl border border-[#e2e8f0] bg-white p-1.5 shadow-[0_12px_28px_rgba(15,23,42,0.12)]"
            >
              <p className="px-2.5 pb-1 pt-1.5 text-[10px] font-bold uppercase tracking-wide text-[#94a3b8]">
                Show last
              </p>
              {DAYS_FILTERS.map((d) => {
                const active = daysFilter === d.value;
                return (
                  <button
                    key={d.value}
                    type="button"
                    role="menuitemradio"
                    aria-checked={active}
                    onClick={() => {
                      setDaysFilter((prev) =>
                        prev === d.value ? null : d.value,
                      );
                      setDaysMenuOpen(false);
                    }}
                    className={
                      active
                        ? "flex w-full items-center justify-between rounded-xl bg-[#004ac6] px-3 py-2.5 text-left text-sm font-semibold text-white"
                        : "flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-[#0b1c30] transition hover:bg-[#f8f9ff]"
                    }
                  >
                    {d.label}
                    {active ? <span aria-hidden>✓</span> : null}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      </header>

      {showEnableBanner ? (
        <EnableBanner
          empty={isEmpty}
          onEnable={() => void requestAlertsPermission()}
          onDismiss={dismissBanner}
        />
      ) : null}

      {error ? (
        <p className="rounded-xl bg-[#ffdad6] px-3 py-2 text-sm text-[#ba1a1a]">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="py-16 text-center text-sm text-[#737686]">
          Loading notifications…
        </p>
      ) : (
        <>
          <div className="sticky top-14 z-30 -mx-5 border-b border-[#c3c6d7]/20 bg-[#f8f9ff]/95 px-5 py-2.5 backdrop-blur-xl">
            <div className="no-scrollbar -mx-0.5 flex items-center gap-2 overflow-x-auto px-0.5 pb-0.5">
              {FILTERS.map((f) => {
                const active = filter === f.id;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFilter(f.id)}
                    aria-pressed={active}
                    className={`inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-full px-3.5 text-[13px] font-bold leading-none tracking-tight transition active:scale-[0.98] ${
                      active ? f.activeClass : f.idleClass
                    }`}
                  >
                    {f.Icon ? (
                      <f.Icon
                        size={15}
                        className="shrink-0 stroke-[2.25]"
                        aria-hidden
                      />
                    ) : null}
                    <span className="whitespace-nowrap">{f.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {isEmpty ? (
            <EmptyNotificationsState />
          ) : groups.length === 0 ? (
            <p className="py-12 text-center text-sm text-[#737686]">
              No notifications in this filter.
            </p>
          ) : (
            groups.map((g) => (
              <section key={g.key} className="space-y-2.5">
                <p className="px-0.5 text-xs font-bold uppercase tracking-wide text-[#9aa0b4]">
                  {g.label}
                </p>
                <ul className="space-y-2.5">
                  {g.rows.map((n) => (
                    <NotificationCard
                      key={n.id}
                      n={n}
                      menuOpen={menuOpenId === n.id}
                      onToggleMenu={() =>
                        setMenuOpenId((cur) => (cur === n.id ? null : n.id))
                      }
                      onMarkRead={() => markOneRead(n.id)}
                      onOpen={() => {
                        if (n.unread) markOneRead(n.id);
                      }}
                    />
                  ))}
                </ul>
              </section>
            ))
          )}
        </>
      )}
    </div>
  );
}

function EnableBanner({
  empty,
  onEnable,
  onDismiss,
}: {
  empty: boolean;
  onEnable: () => void;
  onDismiss: () => void;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl p-4 ${
        empty
          ? "bg-[#efe9ff]"
          : "bg-gradient-to-br from-[#dbeafe] via-[#e0e7ff] to-[#eff6ff]"
      }`}
    >
      <button
        type="button"
        onClick={onDismiss}
        className="absolute right-2.5 top-2.5 flex h-7 w-7 items-center justify-center rounded-full text-[#9aa0b4] transition hover:bg-white/50"
        aria-label="Dismiss"
      >
        <IconClose size={16} />
      </button>

      <div className="flex gap-3 pr-6">
        <span
          className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
            empty ? "bg-white/80 text-[#7c3aed]" : "bg-white/80 text-[#2563eb]"
          }`}
        >
          <IconBell size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-bold text-[#0b1c30]">
            {empty ? "Stay Updated" : "Get Instant Updates"}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-[#5c6478]">
            {empty
              ? "Enable notifications to get leave updates, approvals and important alerts."
              : "Allow browser notifications to receive important alerts even when the app is closed."}
          </p>
          <button
            type="button"
            onClick={onEnable}
            className={`mt-3 w-full rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition active:scale-[0.99] ${
              empty ? "bg-[#7c3aed]" : "bg-[#2563eb]"
            }`}
          >
            Enable Notifications
          </button>
        </div>
      </div>
    </div>
  );
}

function EmptyNotificationsState() {
  return (
    <div className="flex flex-col items-center px-2 pt-8 text-center">
      <EmptyBellIllustration />
      <h2 className="mt-5 text-[1.35rem] font-bold tracking-tight text-[#0b1c30]">
        No notifications yet
      </h2>
      <p className="mt-2.5 max-w-[18.5rem] text-[0.9375rem] leading-relaxed text-[#8b92a8]">
        You&apos;re all caught up! We&apos;ll notify you here about leaves,
        announcements and more.
      </p>
    </div>
  );
}

function NotificationCard({
  n,
  menuOpen,
  onToggleMenu,
  onMarkRead,
  onOpen,
}: {
  n: UiNotification;
  menuOpen: boolean;
  onToggleMenu: () => void;
  onMarkRead: () => void;
  onOpen: () => void;
}) {
  const href = resolveEssNotificationHref(n);
  const { Icon } = n.category;

  return (
    <li className="relative">
      <div
        className={`flex gap-3 rounded-2xl border p-3.5 shadow-[0_2px_10px_rgba(15,23,42,0.03)] ${n.category.cardClass}`}
      >
        <Link
          href={href}
          onClick={onOpen}
          className="flex min-w-0 flex-1 gap-3"
        >
          <span
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${n.category.iconWrap} ${n.category.iconColor}`}
          >
            <Icon size={20} />
          </span>
          <span className="min-w-0 flex-1 text-left">
            <span className="flex items-start justify-between gap-2">
              <span
                className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${n.category.badgeClass}`}
              >
                {n.category.label}
              </span>
              <span className="flex shrink-0 items-center gap-1.5">
                <span className="text-[11px] font-medium text-[#9aa0b4]">
                  {n.when}
                </span>
                {n.unread ? (
                  <span className="h-2 w-2 rounded-full bg-[#2563eb]" />
                ) : null}
              </span>
            </span>
            <span className="mt-1.5 block text-[15px] font-semibold leading-snug text-[#0b1c30]">
              {n.title}
            </span>
            <span className="mt-0.5 line-clamp-2 block text-xs leading-relaxed text-[#6b7280]">
              {n.body}
            </span>
          </span>
        </Link>

        <div className="relative shrink-0 self-start">
          <button
            type="button"
            onClick={onToggleMenu}
            className="flex h-8 w-8 items-center justify-center rounded-full text-[#9aa0b4] transition hover:bg-black/5"
            aria-label="More actions"
          >
            <IconMoreVertical size={16} />
          </button>
          {menuOpen ? (
            <div className="absolute right-0 top-9 z-20 min-w-[9.5rem] overflow-hidden rounded-xl border border-[#e2e8f0] bg-white py-1 shadow-lg">
              {!n.read ? (
                <button
                  type="button"
                  className="block w-full px-3 py-2 text-left text-sm text-[#0b1c30] hover:bg-[#f8f9ff]"
                  onClick={onMarkRead}
                >
                  Mark as read
                </button>
              ) : null}
              <Link
                href={href}
                className="block px-3 py-2 text-sm text-[#0b1c30] hover:bg-[#f8f9ff]"
                onClick={onOpen}
              >
                Open
              </Link>
            </div>
          ) : null}
        </div>
      </div>
    </li>
  );
}
