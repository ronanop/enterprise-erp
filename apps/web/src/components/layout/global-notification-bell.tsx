"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import {
  Bell,
  Cake,
  CalendarDays,
  ClipboardList,
  FileWarning,
  UserCheck,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { hrNotificationHref } from "@/lib/hr-notification-href";
import { cn } from "@/lib/utils";
import {
  getDashboardRole,
  loadHrExecutiveDashboard,
} from "@/services/hr-executive-dashboard-service";
import type { NotificationItem } from "@/types/hr-executive-dashboard";

type Props = {
  /** Match topbar ghost icon vs dashboard outline button */
  variant?: "topbar" | "default";
  className?: string;
};

const READ_KEY = "erp_hr_notif_read_v1";

function loadReadIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(READ_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as string[];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function saveReadIds(ids: Set<string>) {
  if (typeof window === "undefined") return;
  localStorage.setItem(READ_KEY, JSON.stringify([...ids].slice(-200)));
}

function kindIcon(kind: NotificationItem["kind"]) {
  switch (kind) {
    case "leave":
      return CalendarDays;
    case "birthday":
      return Cake;
    case "probation":
      return UserCheck;
    case "document":
      return FileWarning;
    case "interview":
    case "offer":
      return ClipboardList;
    default:
      return Bell;
  }
}

function formatRelative(iso: string): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "";
  const diff = Date.now() - t;
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export function GlobalNotificationBell({ variant = "topbar", className }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(() => new Set());
  const [panelStyle, setPanelStyle] = useState<CSSProperties>({});
  const rootRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setReadIds(loadReadIds());
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const dash = await loadHrExecutiveDashboard(getDashboardRole());
      setItems(dash.notifications ?? []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 60_000);
    return () => window.clearInterval(id);
  }, [load]);

  const placePanel = useCallback(() => {
    const btn = anchorRef.current;
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    const width = Math.min(360, window.innerWidth - 16);
    let left = r.right - width;
    if (left < 8) left = 8;
    if (left + width > window.innerWidth - 8) left = window.innerWidth - width - 8;
    const top = Math.min(r.bottom + 8, window.innerHeight - 120);
    setPanelStyle({
      position: "fixed",
      top,
      left,
      width,
      zIndex: 80,
    });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    placePanel();
    void load();
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (rootRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    function onReposition() {
      placePanel();
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [open, load, placePanel]);

  const displayItems = useMemo(
    () =>
      items.map((n) => ({
        ...n,
        unread: n.unread && !readIds.has(n.id),
      })),
    [items, readIds],
  );

  const unread = useMemo(() => displayItems.filter((n) => n.unread).length, [displayItems]);

  function markRead(id: string) {
    setReadIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      saveReadIds(next);
      return next;
    });
  }

  function markAllRead() {
    setReadIds((prev) => {
      const next = new Set(prev);
      for (const n of items) next.add(n.id);
      saveReadIds(next);
      return next;
    });
  }

  const panel =
    open && typeof document !== "undefined"
      ? createPortal(
          <>
            <button
              type="button"
              aria-label="Close notifications"
              className="fixed inset-0 z-[70] cursor-default bg-black/10"
              onClick={() => setOpen(false)}
            />
            <div
              ref={panelRef}
              role="dialog"
              aria-label="Notifications"
              style={panelStyle}
              className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-xl"
            >
              <div className="flex items-center justify-between gap-2 border-b border-border/70 px-3 py-2.5">
                <div>
                  <p className="text-sm font-semibold text-foreground">Notifications</p>
                  <p className="text-[10px] text-muted-foreground">
                    {unread > 0 ? `${unread} unread` : "You're all caught up"}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  {unread > 0 ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 cursor-pointer px-2 text-[11px]"
                      onClick={markAllRead}
                    >
                      Mark all read
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="cursor-pointer text-muted-foreground"
                    aria-label="Close"
                    onClick={() => setOpen(false)}
                  >
                    <X className="size-3.5" />
                  </Button>
                </div>
              </div>

              {loading && displayItems.length === 0 ? (
                <p className="px-3 py-8 text-center text-xs text-muted-foreground">Loading…</p>
              ) : displayItems.length === 0 ? (
                <p className="px-3 py-8 text-center text-xs text-muted-foreground">
                  No notifications right now.
                </p>
              ) : (
                <ul className="erp-scroll max-h-[min(22rem,calc(100vh-8rem))] divide-y divide-border/50 overflow-y-auto">
                  {displayItems.map((n) => {
                    const Icon = kindIcon(n.kind);
                    const href = hrNotificationHref(n);
                    return (
                      <li key={n.id}>
                        <Link
                          href={href}
                          onClick={() => {
                            markRead(n.id);
                            setOpen(false);
                          }}
                          className={cn(
                            "flex cursor-pointer gap-2.5 px-3 py-2.5 text-xs transition-colors duration-150 hover:bg-muted/50",
                            n.unread && "bg-primary/5",
                          )}
                        >
                          <span
                            className={cn(
                              "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border border-border/60",
                              n.unread
                                ? "border-primary/30 bg-primary/10 text-primary"
                                : "bg-muted/40 text-muted-foreground",
                            )}
                          >
                            <Icon className="size-3.5" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-start justify-between gap-2">
                              <span className="font-medium text-foreground">{n.title}</span>
                              {n.unread ? (
                                <span className="mt-1 size-1.5 shrink-0 rounded-full bg-primary" />
                              ) : null}
                            </span>
                            <span className="mt-0.5 block text-muted-foreground">{n.body}</span>
                            <span className="mt-1 block text-[10px] text-muted-foreground/80">
                              {formatRelative(n.at)}
                            </span>
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}

              <div className="border-t border-border/70 px-3 py-2">
                <Link
                  href="/hr/ess-inbox"
                  onClick={() => setOpen(false)}
                  className="block cursor-pointer rounded-lg px-2 py-1.5 text-center text-[11px] font-medium text-primary transition-colors duration-150 hover:bg-muted/50"
                >
                  Open ESS inbox
                </Link>
              </div>
            </div>
          </>,
          document.body,
        )
      : null;

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <div ref={anchorRef} className="inline-flex">
        <Button
          type="button"
          variant={variant === "topbar" ? "ghost" : "outline"}
          size={variant === "topbar" ? "icon-sm" : "sm"}
          aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
          aria-expanded={open}
          aria-haspopup="dialog"
          className={cn(
            "relative cursor-pointer",
            variant === "topbar" && "text-muted-foreground",
          )}
          onClick={() => setOpen((v) => !v)}
        >
          <Bell className="size-4" />
          {unread > 0 ? (
            <span
              className={cn(
                "rounded-full bg-destructive text-[10px] font-medium text-white",
                variant === "topbar"
                  ? "absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center"
                  : "ml-1 px-1.5",
              )}
            >
              {unread > 9 ? "9+" : unread}
            </span>
          ) : null}
        </Button>
      </div>
      {panel}
    </div>
  );
}
