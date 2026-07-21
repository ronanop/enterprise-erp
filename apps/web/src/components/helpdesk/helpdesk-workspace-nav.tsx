"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

/** Primary helpdesk screens from FRD-17 screen inventory */
const HELPDESK_NAV = [
  { title: "Overview", href: "/helpdesk" },
  { title: "Tickets", href: "/helpdesk/tickets" },
  { title: "Assignments", href: "/helpdesk/ticket-assignments" },
  { title: "Escalations", href: "/helpdesk/ticket-escalations" },
  { title: "Knowledge", href: "/helpdesk/knowledge-articles" },
  { title: "Resolutions", href: "/helpdesk/resolutions" },
  { title: "Teams", href: "/helpdesk/support-teams" },
  { title: "Feedback", href: "/helpdesk/customer-feedback" },
] as const;

export function HelpdeskWorkspaceNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Helpdesk workspace" className="erp-scroll -mx-1 overflow-x-auto px-1">
      <ul className="flex min-w-max items-center gap-0.5 border-b border-border/70 pb-px">
        {HELPDESK_NAV.map((item) => {
          const active =
            item.href === "/helpdesk"
              ? pathname === "/helpdesk"
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
