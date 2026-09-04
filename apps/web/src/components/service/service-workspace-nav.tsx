"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Headphones,
  Inbox,
  LayoutDashboard,
  Ticket,
  UserCog,
  Wrench,
} from "lucide-react";

import { SidebarAccountSection } from "@/components/layout/sidebar-account-section";
import { ModuleUsersNavTab } from "@/components/organization/module-users-nav-tab";
import { Button } from "@/components/ui/button";
import { useAuthUser } from "@/hooks/use-auth-user";
import { useUserPermissions } from "@/hooks/use-user-permissions";
import { canManageModuleUsers } from "@/lib/module-access";
import {
  hasServiceFieldEngineerRole,
  isServiceFieldEngineerOnly,
} from "@/lib/service-field-engineer-access";
import { cn } from "@/lib/utils";

export type ServiceNavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  mailboxAccess?: boolean;
  fieldEngineerOnly?: boolean;
};

/** SOP service request ticket workflow — CRM-style workspace panes. */
export const SERVICE_NAV: readonly ServiceNavItem[] = [
  { title: "Dashboard", href: "/service", icon: LayoutDashboard },
  { title: "Request Tickets", href: "/service/service-request-tickets", icon: Ticket },
  { title: "Mailbox", href: "/service/mailbox", icon: Inbox, mailboxAccess: true },
  {
    title: "Field Engineer",
    href: "/service/field-engineer",
    icon: Wrench,
    fieldEngineerOnly: true,
  },
  { title: "SLAs", href: "/service/service-slas", icon: Clock3 },
  { title: "Resolved", href: "/service/resolved-tickets", icon: CheckCircle2 },
];

function canViewServiceMailbox(permissions: string[] | undefined | null): boolean {
  const perms = permissions ?? [];
  return perms.includes("service.request:update") || perms.includes("service.request:approve");
}

function filterServiceNav(
  items: readonly ServiceNavItem[],
  opts: {
    permissions?: string[] | null;
    roleCodes?: string[] | null;
    roleNames?: string[] | null;
  },
): ServiceNavItem[] {
  const isFe = hasServiceFieldEngineerRole(opts.roleCodes, opts.roleNames);
  const feOnly = isServiceFieldEngineerOnly(opts.roleCodes, opts.permissions, opts.roleNames);

  return items.filter((item) => {
    if (item.fieldEngineerOnly) return isFe;
    if (item.mailboxAccess) return canViewServiceMailbox(opts.permissions) && !feOnly;
    if (feOnly) return false;
    return true;
  });
}

function isServiceNavActive(pathname: string, href: string): boolean {
  if (href === "/service") return pathname === "/service";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Horizontal tab strip (used when Service shares the main app sidebar). */
export function ServiceWorkspaceNav() {
  const pathname = usePathname();
  const { profile, loading } = useUserPermissions();

  const visibleNav = useMemo(
    () =>
      filterServiceNav(SERVICE_NAV, {
        permissions: profile?.permissions,
        roleCodes: profile?.roleCodes,
        roleNames: profile?.roleNames,
      }),
    [profile?.permissions, profile?.roleCodes, profile?.roleNames],
  );

  const feOnly = isServiceFieldEngineerOnly(
    profile?.roleCodes,
    profile?.permissions,
    profile?.roleNames,
  );

  if (loading) {
    return (
      <div className="grid min-w-0 max-w-full grid-cols-1">
        <nav aria-label="Service workspace" className="erp-scroll min-w-0 overflow-x-auto overscroll-x-contain">
          <ul className="flex w-max items-center gap-0.5 border-b border-border/70 pb-px">
            <li className="inline-flex h-8 items-center px-2.5 text-xs text-muted-foreground">
              Loading…
            </li>
          </ul>
        </nav>
      </div>
    );
  }

  if (visibleNav.length === 0 || (feOnly && visibleNav.length === 1)) {
    return null;
  }

  return (
    <div className="grid min-w-0 max-w-full grid-cols-1">
      <nav
        aria-label="Service workspace"
        className="erp-scroll min-w-0 overflow-x-auto overscroll-x-contain"
      >
        <ul className="flex w-max items-center gap-0.5 border-b border-border/70 pb-px">
          {visibleNav.map((item) => {
            const active = isServiceNavActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <li key={item.href} className="shrink-0">
                <Link
                  href={item.href}
                  className={cn(
                    "relative inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition-[color,background-color] duration-200",
                    active
                      ? "bg-muted/60 font-semibold text-foreground after:absolute after:inset-x-2 after:bottom-0.5 after:h-0.5 after:rounded-full after:bg-primary"
                      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                  )}
                >
                  <Icon className="size-3.5 shrink-0" aria-hidden />
                  {item.title}
                </Link>
              </li>
            );
          })}
          {!feOnly ? <ModuleUsersNavTab moduleKey="service" variant="pill" /> : null}
        </ul>
      </nav>
    </div>
  );
}

/** Left sidebar chrome for standalone Service tabs (replaces AppSidebar) — CRM pattern. */
export function ServiceSidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const { signedIn, user, adminModuleKeys } = useAuthUser();
  const { profile, loading } = useUserPermissions();

  const navItems = useMemo(() => {
    const items = filterServiceNav(SERVICE_NAV, {
      permissions: profile?.permissions,
      roleCodes: profile?.roleCodes,
      roleNames: profile?.roleNames,
    });
    const feOnly = isServiceFieldEngineerOnly(
      profile?.roleCodes,
      profile?.permissions,
      profile?.roleNames,
    );
    if (
      !feOnly &&
      canManageModuleUsers("service", adminModuleKeys, user?.userType)
    ) {
      items.push({ title: "Users", href: "/service/users", icon: UserCog });
    }
    return items;
  }, [
    adminModuleKeys,
    profile?.permissions,
    profile?.roleCodes,
    profile?.roleNames,
    user?.userType,
  ]);

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
            <Headphones className="size-3.5 shrink-0 text-sidebar-primary" aria-hidden />
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-sidebar-foreground">Service</p>
              <p className="truncate text-[10px] text-sidebar-foreground/55">
                {loading ? "…" : `${navItems.length} workspace panes`}
              </p>
            </div>
          </div>
        </SidebarAccountSection>
      ) : (
        <div className={cn("px-4 py-4", collapsed && "px-2")}>
          <div className={cn("flex items-center gap-3", collapsed && "justify-center")}>
            <div className="flex size-9 items-center justify-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground shadow-sm">
              <Headphones className="size-4" aria-hidden />
            </div>
            {!collapsed ? (
              <div className="min-w-0">
                <p className="truncate text-sm font-medium tracking-tight text-sidebar-foreground">
                  Service
                </p>
                <p className="truncate text-[11px] text-sidebar-foreground/55">
                  {loading ? "…" : `${navItems.length} workspace panes`}
                </p>
              </div>
            ) : null}
          </div>
        </div>
      )}

      <nav aria-label="Service workspace" className="erp-scroll flex-1 overflow-y-auto px-2.5 py-2">
        {!collapsed ? (
          <p className="mb-2 px-2.5 text-[10px] font-medium tracking-[0.14em] text-sidebar-foreground/40 uppercase">
            Workspace
          </p>
        ) : null}
        <ul className="space-y-0.5">
          {loading
            ? Array.from({ length: 4 }).map((_, i) => (
                <li key={i} className="h-9 animate-pulse rounded-lg bg-sidebar-accent/40" />
              ))
            : navItems.map((item) => {
                const active = isServiceNavActive(pathname, item.href);
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      title={item.title}
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
                      <Icon
                        className={cn(
                          "size-4 shrink-0 transition-colors duration-200",
                          active
                            ? "text-sidebar-primary"
                            : "text-sidebar-foreground/50 group-hover:text-sidebar-foreground/80",
                        )}
                        aria-hidden
                      />
                      {!collapsed ? (
                        <span className="min-w-0 flex-1 truncate font-medium">{item.title}</span>
                      ) : (
                        <span className="sr-only">{item.title}</span>
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
          aria-label={collapsed ? "Expand Service sidebar" : "Collapse Service sidebar"}
        >
          {collapsed ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
          {!collapsed ? <span className="ml-1.5 text-xs">Collapse</span> : null}
        </Button>
      </div>
    </aside>
  );
}
