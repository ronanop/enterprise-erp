"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { ModuleUsersNavTab } from "@/components/organization/module-users-nav-tab";
import { cn } from "@/lib/utils";

const MARKETING_NAV_GROUPS = [
  {
    label: "Workspace",
    items: [
      { title: "Overview", href: "/marketing" },
      { title: "Operations", href: "/marketing/operations" },
      { title: "My Work", href: "/marketing/my-work" },
      { title: "Campaigns", href: "/marketing/campaigns" },
      { title: "Inbox", href: "/marketing/inbox" },
      { title: "Tasks", href: "/marketing/tasks" },
      { title: "Workload", href: "/marketing/workload" },
    ],
  },
  {
    label: "Content",
    items: [
      { title: "Content Studio", href: "/marketing/content" },
      { title: "Requests", href: "/marketing/content-requests" },
      { title: "Calendar", href: "/marketing/calendar" },
      { title: "Brand kit", href: "/marketing/brand-voices" },
    ],
  },
  {
    label: "Insights",
    items: [
      { title: "Research", href: "/marketing/research" },
      { title: "Trends", href: "/marketing/trends" },
      { title: "Competitors", href: "/marketing/competitors" },
      { title: "Analytics", href: "/marketing/analytics" },
    ],
  },
  {
    label: "Channels",
    items: [
      { title: "Social", href: "/marketing/social-accounts" },
      { title: "Microsoft 365", href: "/marketing/m365" },
    ],
  },
] as const;

const MARKETING_NAV_FLAT = MARKETING_NAV_GROUPS.flatMap((g) => g.items);

function isMarketingNavActive(pathname: string, href: string): boolean {
  if (href === "/marketing") return pathname === "/marketing";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Marketing module navigation — left sidebar on desktop, strip on small screens.
 */
export function MarketingWorkspaceNav() {
  const pathname = usePathname();

  return (
    <>
      {/* Mobile / tablet: compact horizontal strip */}
      <nav
        aria-label="Marketing workspace"
        className="erp-scroll -mx-1 overflow-x-auto px-1 md:hidden"
      >
        <ul className="flex min-w-max items-center gap-0.5 border-b border-border/70 pb-px">
          {MARKETING_NAV_FLAT.map((item) => {
            const active = isMarketingNavActive(pathname, item.href);
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

      {/* Desktop: left sidebar */}
      <aside
        aria-label="Marketing workspace"
        className="sticky top-0 hidden h-[calc(100dvh-5.5rem)] w-[200px] shrink-0 flex-col border-r border-border/80 bg-card/40 md:flex lg:w-[220px]"
      >
        <div className="border-b border-border/70 px-3 py-3">
          <p className="text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
            Marketing & Social
          </p>
        </div>
        <nav className="erp-scroll flex-1 overflow-y-auto px-2 py-2">
          {MARKETING_NAV_GROUPS.map((group) => (
            <div key={group.label} className="mb-3">
              <p className="mb-1.5 px-2.5 text-[10px] font-medium tracking-[0.12em] text-muted-foreground/80 uppercase">
                {group.label}
              </p>
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const active = isMarketingNavActive(pathname, item.href);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={cn(
                          "relative flex cursor-pointer items-center rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors duration-200",
                          active
                            ? "bg-muted text-foreground"
                            : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                        )}
                      >
                        {active ? (
                          <span
                            className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-primary"
                            aria-hidden
                          />
                        ) : null}
                        <span className="truncate">{item.title}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
          <div className="mb-2">
            <p className="mb-1.5 px-2.5 text-[10px] font-medium tracking-[0.12em] text-muted-foreground/80 uppercase">
              Admin
            </p>
            <ul className="space-y-0.5">
              <ModuleUsersNavTab moduleKey="marketing" variant="sidebar" />
            </ul>
          </div>
        </nav>
      </aside>
    </>
  );
}
