"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Bell, CheckCheck, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAuthUser } from "@/hooks/use-auth-user";
import { cn } from "@/lib/utils";
import {
  listProjectStageSaveAlerts,
  markProjectStageSaveAlertRead,
  type ProjectStageSaveAlert,
} from "@/services/projects-portal-service";

const SEEN_POPUP_KEY = "prj_stage_save_alert_popup_seen";
const POLL_MS = 20_000;
const PANEL_WIDTH = 352;
const PANEL_GAP = 8;
const VIEWPORT_PAD = 8;

function readSeenPopupIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = sessionStorage.getItem(SEEN_POPUP_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function writeSeenPopupIds(ids: Set<string>) {
  sessionStorage.setItem(SEEN_POPUP_KEY, JSON.stringify([...ids].slice(-200)));
}

function formatSavedAt(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function anchorBelowBell(trigger: HTMLElement | null): { top: number; left: number } | null {
  if (!trigger || typeof window === "undefined") return null;
  const rect = trigger.getBoundingClientRect();
  const width = Math.min(PANEL_WIDTH, window.innerWidth - VIEWPORT_PAD * 2);
  let left = rect.right - width;
  left = Math.min(
    Math.max(VIEWPORT_PAD, left),
    window.innerWidth - width - VIEWPORT_PAD,
  );
  const top = Math.min(
    rect.bottom + PANEL_GAP,
    window.innerHeight - VIEWPORT_PAD - 120,
  );
  return { top, left };
}

function AlertBody({ alert }: { alert: ProjectStageSaveAlert }) {
  return (
    <div className="min-w-0 space-y-1 text-left">
      <p className="text-sm font-medium text-foreground">
        {alert.stage_label} — {alert.progress_status_label}
      </p>
      <p className="text-xs text-muted-foreground">
        {alert.site_name || alert.document_number || "Site"} · {alert.project_name || "Project"}
      </p>
      <p className="text-xs text-muted-foreground">
        By {alert.actor_name} · {formatSavedAt(alert.saved_at)}
      </p>
      {alert.remarks ? (
        <p className="text-xs text-foreground/90">
          <span className="font-medium">Remarks:</span> {alert.remarks}
        </p>
      ) : null}
      {alert.no_answers.length > 0 ? (
        <p className="text-xs text-foreground/90">
          <span className="font-medium">Marked No:</span> {alert.no_answers.join(", ")}
        </p>
      ) : null}
    </div>
  );
}

export function AppTopbarNotifications() {
  const { signedIn, projectModuleAdmin, loading: authLoading } = useAuthUser();
  const [open, setOpen] = useState(false);
  const [alerts, setAlerts] = useState<ProjectStageSaveAlert[]>([]);
  const [popups, setPopups] = useState<ProjectStageSaveAlert[]>([]);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const [mounted, setMounted] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const inboxRef = useRef<HTMLDivElement>(null);
  const toastRef = useRef<HTMLDivElement>(null);

  const unreadCount = useMemo(
    () => alerts.filter((a) => a.unread).length,
    [alerts],
  );

  const updatePosition = useCallback(() => {
    setCoords(anchorBelowBell(triggerRef.current));
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  const poll = useCallback(async () => {
    if (!signedIn || !projectModuleAdmin) {
      setAlerts([]);
      setPopups([]);
      return;
    }
    try {
      const rows = await listProjectStageSaveAlerts(40);
      setAlerts(rows);
      const seen = readSeenPopupIds();
      const fresh = rows.filter((row) => row.unread && !seen.has(row.id));
      if (fresh.length > 0) {
        for (const row of fresh) seen.add(row.id);
        writeSeenPopupIds(seen);
        setPopups(fresh.slice(0, 3));
      }
    } catch {
      /* ignore polling errors for guests / permission */
    }
  }, [signedIn, projectModuleAdmin]);

  useEffect(() => {
    if (authLoading) return;
    void poll();
    if (!signedIn || !projectModuleAdmin) return;
    const timer = window.setInterval(() => void poll(), POLL_MS);
    return () => window.clearInterval(timer);
  }, [authLoading, signedIn, projectModuleAdmin, poll]);

  useLayoutEffect(() => {
    if (!open && popups.length === 0) {
      setCoords(null);
      return;
    }
    updatePosition();
    const id = requestAnimationFrame(() => updatePosition());
    return () => cancelAnimationFrame(id);
  }, [open, popups.length, updatePosition]);

  useEffect(() => {
    if (!open && popups.length === 0) return;
    const onScrollOrResize = () => updatePosition();
    window.addEventListener("resize", onScrollOrResize);
    window.addEventListener("scroll", onScrollOrResize, true);
    return () => {
      window.removeEventListener("resize", onScrollOrResize);
      window.removeEventListener("scroll", onScrollOrResize, true);
    };
  }, [open, popups.length, updatePosition]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        rootRef.current?.contains(target) ||
        inboxRef.current?.contains(target) ||
        toastRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const onMarkRead = useCallback(async (id: string) => {
    try {
      const updated = await markProjectStageSaveAlertRead(id);
      setAlerts((prev) => prev.map((row) => (row.id === id ? updated : row)));
      setPopups((prev) => prev.filter((row) => row.id !== id));
    } catch {
      /* ignore */
    }
  }, []);

  const onMarkAllRead = useCallback(async () => {
    const unread = alerts.filter((a) => a.unread);
    await Promise.all(unread.map((row) => onMarkRead(row.id)));
  }, [alerts, onMarkRead]);

  if (!signedIn || !projectModuleAdmin) {
    return (
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Notifications"
        disabled
        className="text-muted-foreground"
      >
        <Bell className="size-4" />
      </Button>
    );
  }

  const panelWidth = Math.min(
    PANEL_WIDTH,
    typeof window !== "undefined" ? window.innerWidth - VIEWPORT_PAD * 2 : PANEL_WIDTH,
  );

  const inbox =
    mounted && open && coords
      ? createPortal(
        <div
          ref={inboxRef}
          role="dialog"
          aria-label="Stage save notifications"
          className="fixed z-80 overflow-hidden rounded-xl border border-border/80 bg-card shadow-lg animate-in fade-in-0 zoom-in-95 duration-200"
          style={{
            top: coords.top,
            left: coords.left,
            width: panelWidth,
          }}
        >
          <div className="flex items-center justify-between gap-2 border-b border-border/70 px-3 py-2.5">
            <p className="text-sm font-semibold">Stage updates</p>
            {unreadCount > 0 ? (
              <button
                type="button"
                className="inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-primary transition-opacity duration-200 hover:opacity-80"
                onClick={() => void onMarkAllRead()}
              >
                <CheckCheck className="size-3.5" aria-hidden />
                Mark all read
              </button>
            ) : null}
          </div>
          <ul className="erp-scroll max-h-[min(70vh,24rem)] overflow-y-auto">
            {alerts.length === 0 ? (
              <li className="px-3 py-6 text-center text-xs text-muted-foreground">
                No stage save alerts yet.
              </li>
            ) : (
              alerts.map((alert) => (
                <li
                  key={alert.id}
                  className={cn(
                    "border-b border-border/50 px-3 py-2.5 last:border-b-0",
                    alert.unread && "bg-muted/40",
                  )}
                >
                  <AlertBody alert={alert} />
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Link
                      href={alert.form_path}
                      className="inline-flex h-7 cursor-pointer items-center rounded-lg border border-border/80 bg-background px-2.5 text-xs font-medium transition-colors duration-200 hover:bg-muted"
                      onClick={() => {
                        setOpen(false);
                        if (alert.unread) void onMarkRead(alert.id);
                      }}
                    >
                      Open stage
                    </Link>
                    {alert.unread ? (
                      <button
                        type="button"
                        className="inline-flex h-7 cursor-pointer items-center rounded-lg px-2 text-xs font-medium text-muted-foreground transition-colors duration-200 hover:bg-muted hover:text-foreground"
                        onClick={() => void onMarkRead(alert.id)}
                      >
                        Mark read
                      </button>
                    ) : null}
                  </div>
                </li>
              ))
            )}
          </ul>
        </div>,
        document.body,
      )
      : null;

  const toastStack =
    mounted && popups.length > 0 && coords && !open
      ? createPortal(
        <div
          ref={toastRef}
          className="fixed z-80 flex flex-col gap-2"
          style={{
            top: coords.top,
            left: coords.left,
            width: panelWidth,
          }}
        >
          {popups.map((alert) => (
            <div
              key={`popup-${alert.id}`}
              role="status"
              className="rounded-xl border border-border/80 bg-card p-3 shadow-lg animate-in fade-in-0 slide-in-from-top-2 duration-200"
            >
              <div className="flex items-start justify-between gap-2">
                <AlertBody alert={alert} />
                <button
                  type="button"
                  aria-label="Dismiss notification"
                  className="inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors duration-200 hover:bg-muted hover:text-foreground"
                  onClick={() => {
                    setPopups((prev) => prev.filter((row) => row.id !== alert.id));
                    if (alert.unread) void onMarkRead(alert.id);
                  }}
                >
                  <X className="size-3.5" />
                </button>
              </div>
              <div className="mt-2">
                <Link
                  href={alert.form_path}
                  className="inline-flex h-7 cursor-pointer items-center rounded-lg bg-primary px-2.5 text-xs font-medium text-primary-foreground transition-opacity duration-200 hover:opacity-90"
                  onClick={() => {
                    setPopups((prev) => prev.filter((row) => row.id !== alert.id));
                    if (alert.unread) void onMarkRead(alert.id);
                  }}
                >
                  Open stage
                </Link>
              </div>
            </div>
          ))}
        </div>,
        document.body,
      )
      : null;

  return (
    <div className="relative" ref={rootRef}>
      <div ref={triggerRef}>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={
            unreadCount > 0
              ? `Notifications, ${unreadCount} unread`
              : "Notifications"
          }
          aria-expanded={open}
          aria-haspopup="dialog"
          className="relative cursor-pointer text-muted-foreground transition-colors duration-200 hover:text-foreground"
          onClick={() => setOpen((v) => !v)}
        >
          <Bell className="size-4" />
          {unreadCount > 0 ? (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          ) : null}
        </Button>
      </div>
      {inbox}
      {toastStack}
    </div>
  );
}
