"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ComponentType } from "react";
import {
  BadgeCheck,
  BarChart3,
  Boxes,
  Building2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FileBarChart,
  LayoutDashboard,
  LogIn,
  LogOut,
  MapPinned,
  Package,
  PackageCheck,
  ShoppingCart,
  Truck,
  UserCog,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { clearTokens } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { useClientAuth } from "@/hooks/use-client-auth";
import { useProcurementApprovals } from "@/hooks/use-procurement-approvals";
import { useProcurementRole } from "@/hooks/use-procurement-role";
import { authService } from "@/services/api-client";
import { prefetchProcurementTab } from "@/services/procurement-service";
import { useDeliveryReminderSweep } from "@/hooks/use-delivery-reminder-sweep";

type NavIcon = ComponentType<{ className?: string; "aria-hidden"?: boolean }>;

export const PROCUREMENT_NAV = [
  { title: "Dashboard", href: "/procurement", icon: LayoutDashboard },
  { title: "SCM Queue", href: "/procurement/scm", icon: ClipboardList },
  { title: "Purchase Orders", href: "/procurement/orders", icon: ShoppingCart },
  { title: "GRNs", href: "/procurement/grns", icon: PackageCheck },
  { title: "Delivery Challan", href: "/procurement/delivery-challan", icon: Truck },
  { title: "Delivery Status", href: "/procurement/delivery-status", icon: MapPinned },
  { title: "Vendors", href: "/procurement/vendors", icon: Building2 },
  { title: "Inventory", href: "/procurement/inventory", icon: Boxes },
  { title: "Approval", href: "/procurement/approval", icon: BadgeCheck },
] as const satisfies ReadonlyArray<{ title: string; href: string; icon: NavIcon }>;

export const PROCUREMENT_INSIGHT_NAV = [
  { title: "Reports", href: "/procurement/reports", icon: FileBarChart },
  { title: "Analytics", href: "/procurement/analytics", icon: BarChart3 },
] as const satisfies ReadonlyArray<{ title: string; href: string; icon: NavIcon }>;

export const ALL_PROCUREMENT_NAV = [
  ...PROCUREMENT_NAV,
  ...PROCUREMENT_INSIGHT_NAV,
] as const;

export function warmProcurementNavTarget(
  router: ReturnType<typeof useRouter>,
  href: string,
): void {
  router.prefetch(href);
  prefetchProcurementTab(href);
}

export function warmAllProcurementNavTargets(router: ReturnType<typeof useRouter>): void {
  for (const item of ALL_PROCUREMENT_NAV) {
    warmProcurementNavTarget(router, item.href);
  }
}

function isProcurementNavActive(pathname: string, href: string): boolean {
  if (href === "/procurement") {
    return pathname === "/procurement";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLinkItem({
  item,
  pathname,
  router,
  collapsed,
  badge,
}: {
  item: { title: string; href: string; icon: NavIcon };
  pathname: string;
  router: ReturnType<typeof useRouter>;
  collapsed?: boolean;
  badge?: number;
}) {
  const active = isProcurementNavActive(pathname, item.href);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      prefetch
      title={item.title}
      onPointerDown={() => warmProcurementNavTarget(router, item.href)}
      onMouseEnter={() => warmProcurementNavTarget(router, item.href)}
      onFocus={() => warmProcurementNavTarget(router, item.href)}
      className={cn(
        "group relative flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] transition-[background-color,color,box-shadow] duration-200",
        active
          ? "bg-[#0F172A] font-semibold text-white shadow-sm"
          : "font-medium text-muted-foreground hover:bg-muted/70 hover:text-foreground",
        collapsed && "justify-center px-0",
      )}
    >
      <Icon
        className={cn(
          "size-4 shrink-0",
          active ? "text-white" : "text-muted-foreground group-hover:text-foreground",
        )}
        aria-hidden
      />
      {!collapsed ? <span className="min-w-0 flex-1 truncate">{item.title}</span> : null}
      {badge && badge > 0 ? (
        <span
          className={cn(
            "inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-bold",
            collapsed && "absolute right-1 top-1 min-w-4 px-1",
            active ? "bg-amber-400 text-[#0F172A]" : "bg-amber-500 text-white",
          )}
        >
          {badge}
        </span>
      ) : null}
    </Link>
  );
}

/** Horizontal tab strip (used when procurement shares the main app sidebar). */
export function ProcurementWorkspaceNav() {
  const pathname = usePathname();
  const router = useRouter();
  useDeliveryReminderSweep();

  useEffect(() => {
    const active =
      ALL_PROCUREMENT_NAV.find((item) => isProcurementNavActive(pathname, item.href)) ??
      PROCUREMENT_NAV[0];
    warmProcurementNavTarget(router, active.href);
  }, [pathname, router]);

  return (
    <div className="grid min-w-0 max-w-full grid-cols-1">
      <nav
        aria-label="Procurement workspace"
        className="erp-scroll min-w-0 overflow-x-auto overscroll-x-contain"
      >
        <ul className="flex w-max items-center gap-0.5 border-b border-border/70 pb-px">
          {ALL_PROCUREMENT_NAV.map((item) => {
            const active = isProcurementNavActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <li key={item.href} className="shrink-0">
                <Link
                  href={item.href}
                  prefetch
                  onPointerDown={() => warmProcurementNavTarget(router, item.href)}
                  onMouseEnter={() => warmProcurementNavTarget(router, item.href)}
                  onFocus={() => warmProcurementNavTarget(router, item.href)}
                  className={cn(
                    "relative inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition-[color,background-color] duration-200",
                    active
                      ? "bg-muted/60 font-semibold text-foreground after:absolute after:inset-x-2 after:bottom-0.5 after:h-0.5 after:rounded-full after:bg-primary"
                      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                  )}
                >
                  <Icon className="size-3.5 shrink-0 opacity-80" aria-hidden />
                  {item.title}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

/** Left sidebar chrome for standalone procurement tabs (replaces AppSidebar). */
export function ProcurementSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const signedIn = useClientAuth();
  const { role, isAdmin, switchRole } = useProcurementRole();
  const { pendingCount } = useProcurementApprovals();
  useDeliveryReminderSweep();

  useEffect(() => {
    if (typeof requestIdleCallback !== "undefined") {
      const id = requestIdleCallback(() => warmAllProcurementNavTargets(router), {
        timeout: 2000,
      });
      return () => cancelIdleCallback(id);
    }
    const timer = window.setTimeout(() => warmAllProcurementNavTargets(router), 100);
    return () => window.clearTimeout(timer);
  }, [router]);

  useEffect(() => {
    const active =
      ALL_PROCUREMENT_NAV.find((item) => isProcurementNavActive(pathname, item.href)) ??
      PROCUREMENT_NAV[0];
    warmProcurementNavTarget(router, active.href);
  }, [pathname, router]);

  async function handleLogout() {
    try {
      await authService.logout();
    } catch {
      clearTokens();
    }
  }

  return (
    <aside
      data-erp-primary-sidebar
      className={cn(
        "sticky top-0 z-20 flex h-dvh shrink-0 flex-col border-r border-border/80 bg-white text-foreground transition-[width] duration-200",
        collapsed ? "w-[76px]" : "w-[260px]",
      )}
    >
      <div className={cn("flex items-center gap-3 px-4 py-5", collapsed && "justify-center px-2")}>
        <div className="flex size-10 items-center justify-center rounded-xl bg-[#0F172A] text-white shadow-sm">
          <Package className="size-4" aria-hidden />
        </div>
        {!collapsed ? (
          <div className="min-w-0">
            <p className="truncate text-base font-semibold tracking-tight text-foreground">
              Procurement
            </p>
            <p className="truncate text-[11px] font-normal text-muted-foreground">
              {isAdmin ? "Admin workspace" : "SCM workspace"}
            </p>
          </div>
        ) : null}
      </div>

      <nav aria-label="Procurement workspace" className="erp-scroll flex-1 overflow-y-auto px-3 py-1">
        <ul className="space-y-1">
          {PROCUREMENT_NAV.map((item) => (
            <li key={item.href}>
              <NavLinkItem
                item={item}
                pathname={pathname}
                router={router}
                collapsed={collapsed}
                badge={item.href === "/procurement/approval" && isAdmin ? pendingCount : undefined}
              />
            </li>
          ))}
        </ul>

        <div className={cn("mt-5", collapsed && "mt-4")}>
          {!collapsed ? (
            <p className="mb-1.5 px-3 text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
              Insight
            </p>
          ) : (
            <div className="mx-auto mb-2 h-px w-8 bg-border/80" aria-hidden />
          )}
          <ul className="space-y-1">
            {PROCUREMENT_INSIGHT_NAV.map((item) => (
              <li key={item.href}>
                <NavLinkItem item={item} pathname={pathname} router={router} collapsed={collapsed} />
              </li>
            ))}
          </ul>
        </div>
      </nav>

      <div className="space-y-1 border-t border-border/70 p-3">
        <button
          type="button"
          onClick={() => switchRole()}
          title={isAdmin ? "Switch to normal user" : "Switch to admin"}
          className={cn(
            "group flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium",
            "border border-border/80 bg-muted/30 text-foreground transition-[background-color,color] duration-200",
            "hover:bg-muted/70",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
            collapsed && "justify-center px-0",
          )}
        >
          <UserCog className="size-4 shrink-0" aria-hidden />
          {!collapsed ? (
            <span className="min-w-0 flex-1 truncate text-left">
              {isAdmin ? "Switch to User" : "Switch to Admin"}
            </span>
          ) : null}
          {!collapsed ? (
            <span className="rounded-md bg-[#0F172A] px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-white uppercase">
              {role}
            </span>
          ) : null}
        </button>
        <Button
          variant="ghost"
          size="sm"
          className="w-full cursor-pointer justify-center text-muted-foreground transition-colors duration-200 hover:bg-muted hover:text-foreground"
          onClick={() => setCollapsed((v) => !v)}
          aria-label={collapsed ? "Expand procurement sidebar" : "Collapse procurement sidebar"}
        >
          {collapsed ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
          {!collapsed ? <span className="ml-1.5 text-xs">Collapse</span> : null}
        </Button>
        {signedIn ? (
          <button
            type="button"
            onClick={() => void handleLogout()}
            title="Sign out"
            className={cn(
              "group flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium",
              "text-muted-foreground transition-[background-color,color] duration-200",
              "hover:bg-muted/70 hover:text-foreground",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
              collapsed && "justify-center px-0",
            )}
          >
            <LogOut className="size-4 shrink-0" aria-hidden />
            {!collapsed ? <span className="min-w-0 flex-1 truncate text-left">Sign out</span> : null}
          </button>
        ) : (
          <Link
            href="/login"
            title="Sign in"
            className={cn(
              "group flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium",
              "text-muted-foreground transition-[background-color,color] duration-200",
              "hover:bg-muted/70 hover:text-foreground",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
              collapsed && "justify-center px-0",
            )}
          >
            <LogIn className="size-4 shrink-0" aria-hidden />
            {!collapsed ? <span className="min-w-0 flex-1 truncate">Sign in</span> : null}
          </Link>
        )}
      </div>
    </aside>
  );
}
