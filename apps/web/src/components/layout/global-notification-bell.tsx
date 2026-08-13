"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";

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

export function GlobalNotificationBell({ variant = "topbar", className }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const rootRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (!open) return;
    void load();
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, load]);

  const unread = useMemo(() => items.filter((n) => n.unread).length, [items]);

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <Button
        type="button"
        variant={variant === "topbar" ? "ghost" : "outline"}
        size={variant === "topbar" ? "icon-sm" : "sm"}
        aria-label="Notifications"
        aria-expanded={open}
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

      {open ? (
        <div className="absolute right-0 z-[60] mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-border/80 bg-card p-2 shadow-lg">
          <div className="flex items-center justify-between px-2 py-1.5">
            <p className="text-xs font-semibold">Notifications</p>
            {loading ? (
              <span className="text-[10px] text-muted-foreground">Updating…</span>
            ) : null}
          </div>
          {items.length === 0 ? (
            <p className="px-2 py-6 text-center text-xs text-muted-foreground">
              No notifications right now.
            </p>
          ) : (
            <ul className="erp-scroll max-h-72 space-y-1 overflow-y-auto">
              {items.map((n) => (
                <li key={n.id}>
                  <Link
                    href={hrNotificationHref(n)}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "block cursor-pointer rounded-lg px-2 py-2 text-xs transition-colors duration-150 hover:bg-muted/60",
                      n.unread && "bg-muted/80",
                    )}
                  >
                    <p className="font-medium">{n.title}</p>
                    <p className="mt-0.5 text-muted-foreground">{n.body}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-1 border-t border-border/60 px-2 pt-2">
            <Link
              href="/hr/ess-inbox"
              onClick={() => setOpen(false)}
              className="block cursor-pointer rounded-lg px-2 py-1.5 text-center text-[11px] font-medium text-primary hover:bg-muted/50"
            >
              Open ESS inbox
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
