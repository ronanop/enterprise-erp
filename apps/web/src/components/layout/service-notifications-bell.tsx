"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";

import { Button } from "@/components/ui/button";
import { isAuthenticated } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { authService } from "@/services/api-client";
import {
  listServiceHeadNotifications,
  type ServiceNotification,
} from "@/services/service-request-ticket-service";

const NOTIFICATION_READ = "service.notification:read";

export function ServiceNotificationsBell({ className }: { className?: string }) {
  const [allowed, setAllowed] = useState(false);
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<ServiceNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!isAuthenticated()) {
        if (!cancelled) {
          setAllowed(false);
          setReady(true);
        }
        return;
      }
      try {
        const me = await authService.me();
        const perms = (me.data as { permissions?: string[] } | null)?.permissions ?? [];
        if (!cancelled) setAllowed(perms.includes(NOTIFICATION_READ) || perms.includes("*"));
      } catch {
        if (!cancelled) setAllowed(false);
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const load = useCallback(async () => {
    if (!isAuthenticated() || !allowed) {
      setItems([]);
      return;
    }
    setLoading(true);
    try {
      const rows = await listServiceHeadNotifications(8);
      setItems(rows);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [allowed]);

  useEffect(() => {
    if (!ready || !allowed) return;
    void load();
  }, [ready, allowed, load]);

  useEffect(() => {
    if (!open || !allowed) return;
    void load();

    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (rootRef.current?.contains(t)) return;
      setOpen(false);
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
  }, [open, allowed, load]);

  if (!ready || !allowed) return null;

  const count = items.length;

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Service alerts"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="relative text-muted-foreground"
      >
        <Bell className="size-4" />
        {count > 0 ? (
          <span className="absolute top-0.5 right-0.5 flex size-3.5 items-center justify-center rounded-full bg-amber-500 text-[9px] font-semibold text-white">
            {count > 9 ? "9+" : count}
          </span>
        ) : null}
      </Button>

      {open ? (
        <div className="absolute right-0 z-30 mt-1.5 w-72 max-w-[calc(100vw-2rem)] overflow-hidden rounded-lg border border-border/80 bg-card shadow-md">
          <div className="flex items-center justify-between border-b border-border/70 px-3 py-2">
            <p className="text-xs font-medium tracking-tight">Alerts</p>
            <Link
              href="/service/service-slas"
              onClick={() => setOpen(false)}
              className="text-[11px] font-medium text-primary hover:opacity-80"
            >
              SLAs
            </Link>
          </div>
          <ul className="max-h-64 overflow-y-auto py-1">
            {loading && items.length === 0 ? (
              <li className="px-3 py-4 text-center text-xs text-muted-foreground">Loading…</li>
            ) : items.length === 0 ? (
              <li className="px-3 py-4 text-center text-xs text-muted-foreground">No alerts</li>
            ) : (
              items.map((n) => (
                <li key={n.id} className="border-b border-border/40 last:border-0">
                  {n.request_id ? (
                    <Link
                      href={`/service/service-request-tickets/${n.request_id}`}
                      onClick={() => setOpen(false)}
                      className="block px-3 py-2 transition-colors hover:bg-muted/50"
                    >
                      <p className="text-[11px] font-medium capitalize text-foreground">
                        {n.notification_type.replace(/_/g, " ")}
                      </p>
                      <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">
                        {n.payload_json?.message ?? n.payload_json?.document_number ?? "View ticket"}
                      </p>
                      {n.sent_at ? (
                        <p className="mt-0.5 text-[10px] text-muted-foreground/80">
                          {n.sent_at.slice(0, 16).replace("T", " ")}
                        </p>
                      ) : null}
                    </Link>
                  ) : (
                    <div className="px-3 py-2">
                      <p className="text-[11px] font-medium capitalize">
                        {n.notification_type.replace(/_/g, " ")}
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {n.payload_json?.message ?? n.notification_type}
                      </p>
                    </div>
                  )}
                </li>
              ))
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
