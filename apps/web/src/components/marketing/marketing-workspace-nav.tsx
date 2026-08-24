"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { ModuleUsersNavTab } from "@/components/organization/module-users-nav-tab";
import { cn } from "@/lib/utils";

const MARKETING_NAV = [
  { title: "Overview", href: "/marketing" },
  { title: "Campaigns", href: "/marketing/campaigns" },
  { title: "Content Studio", href: "/marketing/content" },
  { title: "Requests", href: "/marketing/content-requests" },
  { title: "Research", href: "/marketing/research" },
  { title: "Trends", href: "/marketing/trends" },
  { title: "Brand Voice", href: "/marketing/brand-voices" },
  { title: "Calendar", href: "/marketing/calendar" },
  { title: "Social", href: "/marketing/social-accounts" },
  { title: "Competitors", href: "/marketing/competitors" },
  { title: "Analytics", href: "/marketing/analytics" },
] as const;

export function MarketingWorkspaceNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Marketing workspace" className="erp-scroll -mx-1 overflow-x-auto px-1">
      <ul className="flex min-w-max items-center gap-0.5 border-b border-border/70 pb-px">
        {MARKETING_NAV.map((item) => {
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
        <ModuleUsersNavTab moduleKey="marketing" />
      </ul>
    </nav>
  );
}
