"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Package, Search } from "lucide-react";

import { ModuleUsersNavTab } from "@/components/organization/module-users-nav-tab";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuthUser } from "@/hooks/use-auth-user";
import { canManageModuleUsers } from "@/lib/module-access";
import { cn } from "@/lib/utils";
import { prefetchProcurementTab } from "@/services/procurement-service";
import { useDeliveryReminderSweep } from "@/hooks/use-delivery-reminder-sweep";

export const PROCUREMENT_NAV = [
  { title: "Dashboard", href: "/procurement" },
  { title: "SCM Queue", href: "/procurement/scm" },
  { title: "Purchase Orders", href: "/procurement/orders" },
  { title: "GRNs", href: "/procurement/grns" },
  { title: "Delivery Challan", href: "/procurement/delivery-challan" },
  { title: "Delivery Status", href: "/procurement/delivery-status" },
  { title: "Vendors", href: "/procurement/vendors" },
  { title: "Inventory", href: "/procurement/inventory" },
] as const;

function prefetchAllProcurementTabs(router: ReturnType<typeof useRouter>): void {
  for (const item of PROCUREMENT_NAV) {
    router.prefetch(item.href);
    prefetchProcurementTab(item.href);
  }
}

function isProcurementNavActive(pathname: string, href: string): boolean {
  if (href === "/procurement") {
    return pathname === "/procurement";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Horizontal tab strip (used when procurement shares the main app sidebar). */
export function ProcurementWorkspaceNav() {
  const pathname = usePathname();
  const router = useRouter();
  useDeliveryReminderSweep();

  useEffect(() => {
    const active =
      PROCUREMENT_NAV.find((item) => isProcurementNavActive(pathname, item.href)) ??
      PROCUREMENT_NAV[0];
    router.prefetch(active.href);
    prefetchProcurementTab(active.href);
    prefetchAllProcurementTabs(router);
  }, [pathname, router]);

  return (
    <div className="grid min-w-0 max-w-full grid-cols-1">
      <nav
        aria-label="Procurement workspace"
        className="erp-scroll min-w-0 overflow-x-auto overscroll-x-contain"
      >
        <ul className="flex w-max items-center gap-0.5 border-b border-border/70 pb-px">
          {PROCUREMENT_NAV.map((item) => {
            const active = isProcurementNavActive(pathname, item.href);
            return (
              <li key={item.href} className="shrink-0">
                <Link
                  href={item.href}
                  prefetch
                  onMouseEnter={() => {
                    router.prefetch(item.href);
                    prefetchProcurementTab(item.href);
                  }}
                  onFocus={() => {
                    router.prefetch(item.href);
                    prefetchProcurementTab(item.href);
                  }}
                  className={cn(
                    "relative inline-flex h-8 cursor-pointer items-center rounded-lg px-2.5 text-xs font-medium transition-[color,background-color] duration-200",
                    active
                      ? "bg-muted/60 font-semibold text-foreground after:absolute after:inset-x-2 after:bottom-0.5 after:h-0.5 after:rounded-full after:bg-primary"
                      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                  )}
                >
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
const PROCUREMENT_USERS_ITEM = { title: "Users", href: "/procurement/users" } as const;

export function ProcurementSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [query, setQuery] = useState("");
  const { user, adminModuleKeys } = useAuthUser();
  useDeliveryReminderSweep();

  const navItems = useMemo(() => {
    const items: { title: string; href: string }[] = [...PROCUREMENT_NAV];
    if (canManageModuleUsers("procurement", adminModuleKeys, user?.userType)) {
      items.push(PROCUREMENT_USERS_ITEM);
    }
    return items;
  }, [adminModuleKeys, user?.userType]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return navItems;
    return navItems.filter((item) => item.title.toLowerCase().includes(q));
  }, [navItems, query]);

  return (
    <aside
      data-erp-primary-sidebar
      className={cn(
        "sticky top-0 z-20 flex h-dvh shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200",
        collapsed ? "w-[72px]" : "w-[260px]",
      )}
    >
      <div className={cn("flex items-center gap-3 px-4 py-5", collapsed && "justify-center px-2")}>
        <div className="flex size-9 items-center justify-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground shadow-sm">
          <Package className="size-4" aria-hidden />
        </div>
        {!collapsed ? (
          <div className="min-w-0">
            <p className="truncate text-sm font-medium tracking-tight text-sidebar-foreground">
              Procurement
            </p>
            <p className="truncate text-[11px] text-sidebar-foreground/55">
              {navItems.length} workspace panes
            </p>
          </div>
        ) : null}
      </div>

      {!collapsed ? (
        <div className="px-3 pb-3">
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-sidebar-foreground/40"
            />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search procurement…"
              className="h-9 border-sidebar-border bg-white/5 pl-8 text-sidebar-foreground placeholder:text-sidebar-foreground/40 focus-visible:ring-sidebar-ring"
              aria-label="Search procurement panes"
            />
          </div>
        </div>
      ) : null}

      <nav aria-label="Procurement workspace" className="erp-scroll flex-1 overflow-y-auto px-2.5 py-2">
        {!collapsed ? (
          <p className="mb-2 px-2.5 text-[10px] font-medium tracking-[0.14em] text-sidebar-foreground/40 uppercase">
            Workspace
          </p>
        ) : null}
        <ul className="space-y-0.5">
          {filtered.map((item) => {
            const active = isProcurementNavActive(pathname, item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  prefetch
                  title={item.title}
                  onMouseEnter={() => {
                    router.prefetch(item.href);
                    prefetchProcurementTab(item.href);
                  }}
                  onFocus={() => {
                    router.prefetch(item.href);
                    prefetchProcurementTab(item.href);
                  }}
                  className={cn(
                    "group relative flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] transition-colors duration-200",
                    active
                      ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                    collapsed && "justify-center px-0",
                  )}
                >
                  {active ? (
                    <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-sidebar-primary" />
                  ) : null}
                  {!collapsed ? (
                    <span className="min-w-0 flex-1 truncate font-medium">{item.title}</span>
                  ) : (
                    <span className="text-[10px] font-semibold tracking-wide">
                      {item.title.slice(0, 2).toUpperCase()}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
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
