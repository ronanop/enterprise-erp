"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, LogIn } from "lucide-react";

import { ProcurementNavSearch } from "@/components/procurement/procurement-nav-search";
import { Button } from "@/components/ui/button";
import { useClientAuth } from "@/hooks/use-client-auth";
import { cn } from "@/lib/utils";
import {
  loadProcurementOverview,
  peekProcurementOverviewFromCache,
} from "@/services/procurement-service";
import { getUnseenScmOvfIds } from "@/utils/scm-queue-seen";

const topbarIconBtn =
  "size-8 cursor-pointer rounded-lg border-border bg-background text-foreground shadow-none transition-colors duration-200 hover:bg-muted";

function unreadFromOverview(): number {
  const overview = peekProcurementOverviewFromCache();
  const ids = (overview?.scmQueue ?? [])
    .map((row) => String(row.ovf_id ?? ""))
    .filter(Boolean);
  return getUnseenScmOvfIds(ids).length;
}

export function AppTopbar() {
  const signedIn = useClientAuth();
  const pathname = usePathname();
  const router = useRouter();
  const showProcurementSearch =
    pathname === "/procurement" || pathname.startsWith("/procurement/");
  const [unreadCount, setUnreadCount] = useState(0);

  const refreshUnread = useCallback(() => {
    if (!showProcurementSearch) {
      setUnreadCount(0);
      return;
    }
    setUnreadCount(unreadFromOverview());
  }, [showProcurementSearch]);

  useEffect(() => {
    refreshUnread();
    if (!showProcurementSearch || !signedIn) return;

    let cancelled = false;
    void loadProcurementOverview()
      .then(() => {
        if (!cancelled) refreshUnread();
      })
      .catch(() => undefined);

    const id = window.setInterval(() => {
      void loadProcurementOverview()
        .then(() => {
          if (!cancelled) refreshUnread();
        })
        .catch(() => undefined);
    }, 45_000);

    const onFocus = () => refreshUnread();
    window.addEventListener("focus", onFocus);
    return () => {
      cancelled = true;
      window.clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, [showProcurementSearch, signedIn, refreshUnread, pathname]);

  const badgeLabel =
    unreadCount > 99 ? "99+" : unreadCount > 0 ? String(unreadCount) : null;

  return (
    <header className="sticky top-0 z-10 flex h-14 items-center justify-between gap-4 border-b border-border/80 bg-card/80 px-4 backdrop-blur-md supports-backdrop-filter:bg-card/70 sm:px-6">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold tracking-tight">Workspace</p>
        <p className="truncate text-xs font-medium text-muted-foreground">
          {signedIn ? "Signed in · secure session" : "Guest · sign in for protected APIs"}
        </p>
      </div>

      <div className="flex items-center gap-2.5">
        {showProcurementSearch ? (
          <ProcurementNavSearch iconOnly iconButtonClassName={topbarIconBtn} />
        ) : null}
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          aria-label={
            badgeLabel
              ? `Notifications, ${unreadCount} new`
              : "Notifications"
          }
          className={cn(topbarIconBtn, "relative")}
          onClick={() => {
            if (showProcurementSearch) router.push("/procurement/scm");
          }}
        >
          <Bell className="size-4" strokeWidth={2.5} aria-hidden />
          {badgeLabel ? (
            <span className="absolute -right-1.5 -top-1.5 inline-flex min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 py-0.5 text-[10px] font-bold leading-none text-slate-900 tabular-nums shadow-sm">
              {badgeLabel}
            </span>
          ) : null}
        </Button>
        {!signedIn ? (
          <Link
            href="/login"
            className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground shadow-sm transition-opacity duration-200 hover:opacity-90"
          >
            <LogIn className="size-3.5" strokeWidth={2.5} />
            Sign in
          </Link>
        ) : null}
      </div>
    </header>
  );
}
