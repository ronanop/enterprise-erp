"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, LogIn } from "lucide-react";

import { ProcurementNavSearch } from "@/components/procurement/procurement-nav-search";
import { Button } from "@/components/ui/button";
import { useClientAuth } from "@/hooks/use-client-auth";
import { useProcurementRole } from "@/hooks/use-procurement-role";
import { useScmQueueUnreadCount } from "@/hooks/use-scm-queue-unread-count";
import {
  countUnreadPoApprovalDecisionNotifications,
  listUnreadPoApprovalDecisionNotifications,
  markAllPoApprovalDecisionNotificationsRead,
  markPoApprovalDecisionNotificationRead,
  PROCUREMENT_APPROVAL_NOTIFICATIONS_EVENT,
  type PoApprovalDecisionNotification,
} from "@/lib/procurement-approval-notifications";
import { cn } from "@/lib/utils";
import { loadProcurementOverview } from "@/services/procurement-service";

const topbarIconBtn =
  "size-8 cursor-pointer rounded-lg border-border bg-background text-foreground shadow-none transition-colors duration-200 hover:bg-muted";

export function AppTopbar() {
  const signedIn = useClientAuth();
  const pathname = usePathname();
  const router = useRouter();
  const { isAdmin } = useProcurementRole();
  const showProcurementSearch =
    pathname === "/procurement" || pathname.startsWith("/procurement/");
  const scmUnreadAll = useScmQueueUnreadCount();
  const scmUnread = showProcurementSearch ? scmUnreadAll : 0;
  const [approvalUnread, setApprovalUnread] = useState(0);
  const [panelOpen, setPanelOpen] = useState(false);
  const [approvalItems, setApprovalItems] = useState<PoApprovalDecisionNotification[]>([]);

  const refreshUnread = useCallback(() => {
    if (!showProcurementSearch) {
      setApprovalUnread(0);
      setApprovalItems([]);
      return;
    }
    if (isAdmin) {
      setApprovalUnread(0);
      setApprovalItems([]);
      return;
    }
    setApprovalUnread(countUnreadPoApprovalDecisionNotifications());
    setApprovalItems(listUnreadPoApprovalDecisionNotifications().slice(0, 8));
  }, [showProcurementSearch, isAdmin]);

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
    window.addEventListener(PROCUREMENT_APPROVAL_NOTIFICATIONS_EVENT, onFocus);
    window.addEventListener("storage", onFocus);
    window.addEventListener("erp:scm-queue-seen", onFocus);
    return () => {
      cancelled = true;
      window.clearInterval(id);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener(PROCUREMENT_APPROVAL_NOTIFICATIONS_EVENT, onFocus);
      window.removeEventListener("storage", onFocus);
      window.removeEventListener("erp:scm-queue-seen", onFocus);
    };
  }, [showProcurementSearch, signedIn, refreshUnread, pathname]);

  const unreadCount = scmUnread + approvalUnread;
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

      <div className="relative flex items-center gap-2.5">
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
          aria-expanded={panelOpen}
          className={cn(topbarIconBtn, "relative")}
          onClick={() => {
            if (!showProcurementSearch) return;
            if (!isAdmin && approvalUnread > 0) {
              setPanelOpen((open) => !open);
              refreshUnread();
              return;
            }
            router.push("/procurement/scm");
          }}
        >
          <Bell className="size-4" strokeWidth={2.5} aria-hidden />
          {badgeLabel ? (
            <span className="absolute -right-1.5 -top-1.5 inline-flex min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 py-0.5 text-[10px] font-bold leading-none text-slate-900 tabular-nums shadow-sm">
              {badgeLabel}
            </span>
          ) : null}
        </Button>
        {panelOpen && !isAdmin ? (
          <div className="absolute right-0 top-10 z-50 w-[min(22rem,calc(100vw-2rem))] rounded-lg border border-border bg-card p-2 shadow-lg">
            <div className="flex items-center justify-between gap-2 px-1.5 pb-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Approval updates
              </p>
              {approvalItems.length > 0 ? (
                <button
                  type="button"
                  className="cursor-pointer text-[11px] font-medium text-sky-800 transition-colors duration-200 hover:underline"
                  onClick={() => {
                    markAllPoApprovalDecisionNotificationsRead();
                    refreshUnread();
                    setPanelOpen(false);
                  }}
                >
                  Mark all read
                </button>
              ) : null}
            </div>
            {approvalItems.length === 0 ? (
              <p className="px-2 py-3 text-xs text-muted-foreground">
                No new accept/reject notifications.
              </p>
            ) : (
              <ul className="max-h-72 space-y-1 overflow-y-auto">
                {approvalItems.map((item) => (
                  <li key={item.id}>
                    <Link
                      href={`/procurement/orders/${item.orderId}`}
                      className={cn(
                        "block cursor-pointer rounded-md border px-2.5 py-2 transition-colors duration-200",
                        item.decision === "accepted"
                          ? "border-emerald-200/80 bg-emerald-50/80 hover:bg-emerald-50"
                          : "border-red-200/80 bg-red-50/80 hover:bg-red-50",
                      )}
                      onClick={() => {
                        markPoApprovalDecisionNotificationRead(item.id);
                        setPanelOpen(false);
                        refreshUnread();
                      }}
                    >
                      <p className="text-xs font-semibold text-foreground">
                        {item.decision === "accepted" ? "PO accepted" : "PO rejected"}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{item.message}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            {scmUnread > 0 ? (
              <button
                type="button"
                className="mt-2 w-full cursor-pointer rounded-md border border-border px-2.5 py-1.5 text-left text-xs font-medium text-foreground transition-colors duration-200 hover:bg-muted/50"
                onClick={() => {
                  setPanelOpen(false);
                  router.push("/procurement/scm");
                }}
              >
                {scmUnread} new OVF{scmUnread === 1 ? "" : "s"} in SCM queue
              </button>
            ) : null}
          </div>
        ) : null}
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
