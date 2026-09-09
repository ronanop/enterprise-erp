"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Briefcase,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FileText,
  FolderKanban,
  Inbox,
  LayoutDashboard,
  LineChart,
  ListTodo,
  Megaphone,
  Palette,
  Radar,
  Search,
  Share2,
  Sparkles,
  TrendingUp,
  UserCog,
  Users,
} from "lucide-react";

import { SidebarAccountSection } from "@/components/layout/sidebar-account-section";
import { ModuleUsersNavTab } from "@/components/organization/module-users-nav-tab";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuthUser } from "@/hooks/use-auth-user";
import { canManageModuleUsers } from "@/lib/module-access";
import { cn } from "@/lib/utils";

type MarketingNavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
};

type MarketingNavGroup = {
  label: string;
  items: readonly MarketingNavItem[];
};

/** Marketing & Social workspace panes — CRM-style left nav. */
export const MARKETING_NAV_GROUPS: readonly MarketingNavGroup[] = [
  {
    label: "Workspace",
    items: [
      { title: "Overview", href: "/marketing", icon: LayoutDashboard },
      { title: "Operations", href: "/marketing/operations", icon: Briefcase },
      { title: "My Work", href: "/marketing/my-work", icon: ListTodo },
      { title: "Campaigns", href: "/marketing/campaigns", icon: Megaphone },
      { title: "Inbox", href: "/marketing/inbox", icon: Inbox },
      { title: "Tasks", href: "/marketing/tasks", icon: ClipboardList },
      { title: "Workload", href: "/marketing/workload", icon: Users },
    ],
  },
  {
    label: "Content",
    items: [
      { title: "Content Studio", href: "/marketing/content", icon: FileText },
      { title: "Requests", href: "/marketing/content-requests", icon: FolderKanban },
      { title: "Calendar", href: "/marketing/calendar", icon: CalendarDays },
      { title: "Brand kit", href: "/marketing/brand-voices", icon: Palette },
    ],
  },
  {
    label: "Insights",
    items: [
      { title: "Research", href: "/marketing/research", icon: Search },
      { title: "Trends", href: "/marketing/trends", icon: TrendingUp },
      { title: "Competitors", href: "/marketing/competitors", icon: Radar },
      { title: "Analytics", href: "/marketing/analytics", icon: BarChart3 },
    ],
  },
  {
    label: "Channels",
    items: [
      { title: "Social", href: "/marketing/social-accounts", icon: Share2 },
      { title: "Microsoft 365", href: "/marketing/m365", icon: LineChart },
    ],
  },
] as const;

export const MARKETING_NAV: readonly MarketingNavItem[] = MARKETING_NAV_GROUPS.flatMap(
  (g) => g.items,
);

function isMarketingNavActive(pathname: string, href: string): boolean {
  if (href === "/marketing") return pathname === "/marketing";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Horizontal tab strip when Marketing shares the main ERP module sidebar. */
export function MarketingWorkspaceNav() {
  const pathname = usePathname();

  return (
    <div className="grid min-w-0 max-w-full grid-cols-1">
      <nav
        aria-label="Marketing workspace"
        className="erp-scroll min-w-0 overflow-x-auto overscroll-x-contain"
      >
        <ul className="flex w-max items-center gap-0.5 border-b border-border/70 pb-px">
          {MARKETING_NAV.map((item) => {
            const active = isMarketingNavActive(pathname, item.href);
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
          <ModuleUsersNavTab moduleKey="marketing" variant="pill" />
        </ul>
      </nav>
    </div>
  );
}

/** Left sidebar chrome for standalone Marketing (replaces AppSidebar) — CRM pattern. */
export function MarketingSidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [query, setQuery] = useState("");
  const { signedIn, user, adminModuleKeys } = useAuthUser();

  const filteredGroups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const groups = MARKETING_NAV_GROUPS.map((group) => ({
      ...group,
      items: q
        ? group.items.filter((item) => item.title.toLowerCase().includes(q))
        : [...group.items],
    })).filter((group) => group.items.length > 0);

    if (canManageModuleUsers("marketing", adminModuleKeys, user?.userType)) {
      const usersItem: MarketingNavItem = {
        title: "Users",
        href: "/marketing/users",
        icon: UserCog,
      };
      if (!q || usersItem.title.toLowerCase().includes(q)) {
        return [...groups, { label: "Admin", items: [usersItem] }];
      }
    }
    return groups;
  }, [adminModuleKeys, query, user?.userType]);

  const paneCount = filteredGroups.reduce((n, g) => n + g.items.length, 0);

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
            <Sparkles className="size-3.5 shrink-0 text-sidebar-primary" aria-hidden />
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-sidebar-foreground">
                Marketing &amp; Social
              </p>
              <p className="truncate text-[10px] text-sidebar-foreground/55">
                {paneCount} workspace panes
              </p>
            </div>
          </div>
        </SidebarAccountSection>
      ) : (
        <div className={cn("px-4 py-4", collapsed && "px-2")}>
          <div className={cn("flex items-center gap-3", collapsed && "justify-center")}>
            <div className="flex size-9 items-center justify-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground shadow-sm">
              <Sparkles className="size-4" aria-hidden />
            </div>
            {!collapsed ? (
              <div className="min-w-0">
                <p className="truncate text-sm font-medium tracking-tight text-sidebar-foreground">
                  Marketing &amp; Social
                </p>
                <p className="truncate text-[11px] text-sidebar-foreground/55">
                  {paneCount} workspace panes
                </p>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {!collapsed ? (
        <div className="px-3 pb-3">
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-sidebar-foreground/40"
              aria-hidden
            />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search Marketing…"
              className="h-9 cursor-text border-sidebar-border bg-white/5 pl-8 text-sidebar-foreground transition-colors duration-200 placeholder:text-sidebar-foreground/40 focus-visible:ring-sidebar-ring"
              aria-label="Search Marketing panes"
            />
          </div>
        </div>
      ) : null}

      <nav aria-label="Marketing workspace" className="erp-scroll flex-1 overflow-y-auto px-2.5 py-2">
        {filteredGroups.map((group) => (
          <div key={group.label} className="mb-3">
            {!collapsed ? (
              <p className="mb-2 px-2.5 text-[10px] font-medium tracking-[0.14em] text-sidebar-foreground/40 uppercase">
                {group.label}
              </p>
            ) : null}
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = isMarketingNavActive(pathname, item.href);
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
          </div>
        ))}
      </nav>

      <div className="border-t border-sidebar-border p-2.5">
        <Button
          variant="ghost"
          size="sm"
          className="w-full cursor-pointer justify-center text-sidebar-foreground/70 transition-colors duration-200 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          onClick={() => setCollapsed((v) => !v)}
          aria-label={collapsed ? "Expand Marketing sidebar" : "Collapse Marketing sidebar"}
        >
          {collapsed ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
          {!collapsed ? <span className="ml-1.5 text-xs">Collapse</span> : null}
        </Button>
      </div>
    </aside>
  );
}
