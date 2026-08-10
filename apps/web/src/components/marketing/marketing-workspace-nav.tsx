"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  Archive,
  CalendarDays,
  BarChart3,
  CheckCircle2,
  FileImage,
  GitBranch,
  ListChecks,
  Globe,
  LayoutDashboard,
  Megaphone,
  Newspaper,
  Radio,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { useMarketingPermissions } from "@/hooks/use-marketing-permissions";
import { detectMarketingPersona, marketingNavTitle, marketingWorkspaceLabels } from "@/lib/marketing-role-ui";
import { SidebarUserIdentity } from "@/components/layout/sidebar-user-identity";

type MarketingNavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
};

export const MARKETING_NAV: readonly MarketingNavItem[] = [
  { title: "Overview", href: "/marketing", icon: LayoutDashboard },
  { title: "My Pipeline", href: "/marketing/pipeline", icon: GitBranch },
  { title: "Workflow", href: "/marketing/workflow", icon: ListChecks },
  { title: "Campaigns", href: "/marketing/campaigns", icon: Megaphone },
  { title: "Content", href: "/marketing/content", icon: Newspaper },
  { title: "Calendar", href: "/marketing/calendar", icon: CalendarDays },
  { title: "Channels", href: "/marketing/channels", icon: Radio },
  { title: "Publish Log", href: "/marketing/publish-log", icon: Globe },
  { title: "Approvals", href: "/marketing/approvals", icon: CheckCircle2 },
  { title: "Archive", href: "/marketing/archive", icon: Archive },
  { title: "Assets", href: "/marketing/assets", icon: FileImage },
  { title: "Reports", href: "/marketing/reports", icon: BarChart3 },
] as const;

export function MarketingWorkspaceNav() {
  const pathname = usePathname();
  const perms = useMarketingPermissions();
  const visibleNav = MARKETING_NAV.filter((item) => perms.canShowNav(item.href));

  if (perms.loading) {
    return null;
  }

  return (
    <nav aria-label="Marketing workspace" className="erp-scroll -mx-1 overflow-x-auto px-1">
      <ul className="flex min-w-max items-center gap-0.5 border-b border-border/70 pb-px">
        {visibleNav.map((item) => {
          const active =
            item.href === "/marketing"
              ? pathname === "/marketing"
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  "inline-flex h-8 cursor-pointer items-center rounded-t-md px-2.5 text-xs font-medium transition-colors duration-200",
                  active
                    ? "border-b-2 border-primary text-foreground"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                )}
              >
                {item.title}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function MarketingSidebar() {
  const pathname = usePathname();
  const perms = useMarketingPermissions();
  const persona = detectMarketingPersona(perms);
  const workspace = marketingWorkspaceLabels(persona);
  const visibleNav = MARKETING_NAV.filter((item) => perms.canShowNav(item.href));

  if (perms.loading) {
    return null;
  }

  return (
    <aside className="sticky top-0 z-20 hidden h-dvh w-56 shrink-0 flex-col border-r border-border/70 bg-muted/20 lg:flex">
      <SidebarUserIdentity variant="marketing" className="mx-0 mt-3 shrink-0 border-0 bg-transparent px-3" />
      <div className="shrink-0 border-b border-border/70 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{workspace.section}</p>
        <p className="mt-1 text-sm font-medium">{workspace.title}</p>
      </div>
      <nav aria-label="Marketing sidebar" className="erp-scroll flex-1 space-y-0.5 overflow-y-auto p-2">
        {visibleNav.map((item) => {
          const Icon = item.icon;
          const label = marketingNavTitle(item.href, persona, item.title);
          const active =
            item.href === "/marketing"
              ? pathname === "/marketing"
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2 rounded-md px-2.5 py-2 text-sm transition-colors",
                active
                  ? "bg-primary/10 font-medium text-primary"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
              )}
            >
              <Icon className="size-4 shrink-0" aria-hidden />
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
