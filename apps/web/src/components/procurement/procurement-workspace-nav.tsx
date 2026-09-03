"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ComponentType } from "react";
import {
  BadgeCheck,
  BarChart3,
  Boxes,
  Building2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FileBarChart,
  History,
  LayoutDashboard,
  MapPinned,
  Package,
  PackageCheck,
  ShoppingCart,
  Truck,
  UserCog,
  Wrench,
} from "lucide-react";

import { ModuleUsersNavTab } from "@/components/organization/module-users-nav-tab";
import { SidebarAccountSection } from "@/components/layout/sidebar-account-section";
import { Button } from "@/components/ui/button";
import { canManageModuleUsers } from "@/lib/module-access";
import { cn } from "@/lib/utils";
import { useAuthUser } from "@/hooks/use-auth-user";
import { useProcurementApprovals } from "@/hooks/use-procurement-approvals";
import { useProcurementRole } from "@/hooks/use-procurement-role";
import { useScmQueueUnreadCount } from "@/hooks/use-scm-queue-unread-count";
import { prefetchProcurementTab } from "@/services/procurement-service";
import { useDeliveryReminderSweep } from "@/hooks/use-delivery-reminder-sweep";

type NavIcon = ComponentType<{ className?: string; "aria-hidden"?: boolean }>;

type ProcurementNavItem = {
  title: string;
  href: string;
  icon: NavIcon;
};

export const PROCUREMENT_NAV = [
  { title: "Dashboard", href: "/procurement", icon: LayoutDashboard },
  { title: "SCM Queue", href: "/procurement/scm", icon: ClipboardList },
  { title: "Purchase Orders", href: "/procurement/orders", icon: ShoppingCart },
  { title: "GRNs", href: "/procurement/grns", icon: PackageCheck },
  { title: "Billing/DC", href: "/procurement/delivery-challan", icon: Truck },
  { title: "Delivery Status", href: "/procurement/delivery-status", icon: MapPinned },
  { title: "Installation", href: "/procurement/installation", icon: Wrench },
  { title: "Vendors", href: "/procurement/vendors", icon: Building2 },
  { title: "Inventory", href: "/procurement/inventory", icon: Boxes },
  { title: "Approval", href: "/procurement/approval", icon: BadgeCheck },
] as const satisfies ReadonlyArray<ProcurementNavItem>;

export const PROCUREMENT_INSIGHT_NAV = [
  { title: "Reports", href: "/procurement/reports", icon: FileBarChart },
  { title: "Analytics", href: "/procurement/analytics", icon: BarChart3 },
  { title: "Timeline", href: "/procurement/timeline", icon: History },
] as const satisfies ReadonlyArray<ProcurementNavItem>;

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
  warmProcurementNavTarget(router, "/procurement/users");
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
  item: ProcurementNavItem;
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
        "group relative flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] transition-colors duration-200",
        active
          ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground shadow-sm"
          : "font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
        collapsed && "justify-center px-0",
      )}
    >
      {active ? (
        <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-sidebar-primary" />
      ) : null}
      <Icon
        className={cn(
          "size-4 shrink-0 transition-colors duration-200",
          active
            ? "text-sidebar-primary"
            : "text-sidebar-foreground/50 group-hover:text-sidebar-foreground/80",
        )}
        aria-hidden
      />
      {!collapsed ? <span className="min-w-0 flex-1 truncate">{item.title}</span> : (
        <span className="sr-only">{item.title}</span>
      )}
      {badge && badge > 0 ? (
        <span
          className={cn(
            "inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none tabular-nums shadow-sm",
            collapsed && "absolute right-1 top-1 min-w-4 px-1",
            active ? "bg-amber-400 text-[#0F172A]" : "bg-amber-500 text-slate-900",
          )}
        >
          {badge > 99 ? "99+" : badge}
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
          <ModuleUsersNavTab moduleKey="procurement" variant="pill" />
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
  const { signedIn, user, adminModuleKeys } = useAuthUser();
  const { isAdmin } = useProcurementRole();
  const { pendingCount } = useProcurementApprovals();
  const scmUnreadCount = useScmQueueUnreadCount();
  useDeliveryReminderSweep();

  const navItems = useMemo(() => {
    const items: ProcurementNavItem[] = [...PROCUREMENT_NAV];
    if (canManageModuleUsers("procurement", adminModuleKeys, user?.userType)) {
      items.push({ title: "Users", href: "/procurement/users", icon: UserCog });
    }
    return items;
  }, [adminModuleKeys, user?.userType]);

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
      navItems.find((item) => isProcurementNavActive(pathname, item.href)) ??
      ALL_PROCUREMENT_NAV.find((item) => isProcurementNavActive(pathname, item.href)) ??
      PROCUREMENT_NAV[0];
    warmProcurementNavTarget(router, active.href);
  }, [navItems, pathname, router]);

  return (
    <aside
      data-erp-primary-sidebar
      className={cn(
        "sticky top-0 z-20 flex h-dvh shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200",
        collapsed ? "w-[72px]" : "w-[260px]",
      )}
    >
      {signedIn ? (
        <SidebarAccountSection collapsed={collapsed}>
          <div className="flex items-center gap-2">
            <Package className="size-3.5 shrink-0 text-sidebar-primary" aria-hidden />
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-sidebar-foreground">Procurement</p>
              <p className="truncate text-[10px] text-sidebar-foreground/55">
                {isAdmin ? "Admin workspace" : "SCM workspace"}
              </p>
            </div>
          </div>
        </SidebarAccountSection>
      ) : (
        <div className={cn("px-4 py-4", collapsed && "px-2")}>
          <div className={cn("flex items-center gap-3", collapsed && "justify-center")}>
            <div className="flex size-9 items-center justify-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground shadow-sm">
              <Package className="size-4" aria-hidden />
            </div>
            {!collapsed ? (
              <div className="min-w-0">
                <p className="truncate text-sm font-medium tracking-tight text-sidebar-foreground">
                  Procurement
                </p>
                <p className="truncate text-[11px] text-sidebar-foreground/55">
                  {isAdmin ? "Admin workspace" : "SCM workspace"}
                </p>
              </div>
            ) : null}
          </div>
        </div>
      )}

      <nav aria-label="Procurement workspace" className="erp-scroll flex-1 overflow-y-auto px-2.5 py-2">
        {!collapsed ? (
          <p className="mb-2 px-2.5 text-[10px] font-medium tracking-[0.14em] text-sidebar-foreground/40 uppercase">
            Workspace
          </p>
        ) : null}
        <ul className="space-y-0.5">
          {navItems.map((item) => (
            <li key={item.href}>
              <NavLinkItem
                item={item}
                pathname={pathname}
                router={router}
                collapsed={collapsed}
                badge={
                  item.href === "/procurement/approval" && isAdmin
                    ? pendingCount
                    : item.href === "/procurement/scm"
                      ? scmUnreadCount
                      : undefined
                }
              />
            </li>
          ))}
        </ul>

        <div className={cn("mt-5", collapsed && "mt-4")}>
          {!collapsed ? (
            <p className="mb-2 px-2.5 text-[10px] font-medium tracking-[0.14em] text-sidebar-foreground/40 uppercase">
              Insight
            </p>
          ) : (
            <div className="mx-auto mb-2 h-px w-8 bg-sidebar-border" aria-hidden />
          )}
          <ul className="space-y-0.5">
            {PROCUREMENT_INSIGHT_NAV.map((item) => (
              <li key={item.href}>
                <NavLinkItem item={item} pathname={pathname} router={router} collapsed={collapsed} />
              </li>
            ))}
          </ul>
        </div>
      </nav>

      <div className="border-t border-sidebar-border p-2.5">
        <Button
          variant="ghost"
          size="sm"
          className="w-full cursor-pointer justify-center text-sidebar-foreground/70 transition-colors duration-200 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          onClick={() => setCollapsed((v) => !v)}
          aria-label={collapsed ? "Expand procurement sidebar" : "Collapse procurement sidebar"}
        >
          {collapsed ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
          {!collapsed ? <span className="ml-1.5 text-xs">Collapse</span> : null}
        </Button>
      </div>
    </aside>
  );
}

