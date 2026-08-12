"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  Archive,
  CheckCircle2,
  FileImage,
  LayoutDashboard,
  Megaphone,
  Newspaper,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { marketingNavActive, marketingNavIdle } from "@/lib/marketing-ui";
import { useMarketingPermissions } from "@/hooks/use-marketing-permissions";
import { detectMarketingPersona, marketingNavTitle, marketingWorkspaceLabels } from "@/lib/marketing-role-ui";
import { SidebarUserIdentity } from "@/components/layout/sidebar-user-identity";

type MarketingNavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
};

export const MARKETING_NAV: readonly MarketingNavItem[] = [
  { title: "Overview", href: "/marketing/pipeline", icon: LayoutDashboard },
  { title: "Campaigns", href: "/marketing/campaigns", icon: Megaphone },
  { title: "Content", href: "/marketing/content", icon: Newspaper },
  { title: "Approvals", href: "/marketing/approvals", icon: CheckCircle2 },
  { title: "Archive", href: "/marketing/archive", icon: Archive },
  { title: "Assets", href: "/marketing/assets", icon: FileImage },
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
      <ul className="flex min-w-max items-center gap-1 rounded-xl border border-border/60 bg-muted/20 p-1 shadow-sm">
        {visibleNav.map((item) => {
          const Icon = item.icon;
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  "inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg px-3 text-xs font-medium transition-all duration-200",
                  active ? marketingNavActive : marketingNavIdle,
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
    <aside className="sticky top-0 z-20 hidden h-dvh w-56 shrink-0 flex-col border-r border-border/70 bg-gradient-to-b from-muted/30 via-background to-background lg:flex">
      <div className="pointer-events-none h-0.5 w-full bg-gradient-to-r from-primary/60 via-violet-500/40 to-transparent" aria-hidden />
      <SidebarUserIdentity variant="marketing" className="mx-0 mt-3 shrink-0 border-0 bg-transparent px-3" />
      <div className="shrink-0 border-b border-border/70 px-4 py-3.5">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">{workspace.section}</p>
        <p className="mt-1 text-sm font-semibold tracking-tight">{workspace.title}</p>
      </div>
      <nav aria-label="Marketing sidebar" className="erp-scroll flex-1 space-y-1 overflow-y-auto p-2.5">
        {visibleNav.map((item) => {
          const Icon = item.icon;
          const label = marketingNavTitle(item.href, persona, item.title);
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm transition-all duration-200",
                active ? marketingNavActive : marketingNavIdle,
              )}
            >
              <span
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-background/80",
                  active && "border-primary/25 bg-primary/10",
                )}
              >
                <Icon className={cn("size-3.5 shrink-0", active ? "text-primary" : "text-muted-foreground")} aria-hidden />
              </span>
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
