"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { ModuleUsersNavTab } from "@/components/organization/module-users-nav-tab";
import { cn } from "@/lib/utils";

const EMAIL_NAV = [
  { title: "Overview", href: "/email" },
  { title: "Compose", href: "/email/compose" },
  { title: "Templates", href: "/email/templates" },
  { title: "Deliveries", href: "/email/deliveries" },
  { title: "Events", href: "/email/events" },
] as const;

export function EmailWorkspaceNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Email workspace" className="erp-scroll -mx-1 overflow-x-auto px-1">
      <ul className="flex min-w-max items-center gap-0.5 border-b border-border/70 pb-px">
        {EMAIL_NAV.map((item) => {
          const active =
            item.href === "/email"
              ? pathname === "/email"
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
        <ModuleUsersNavTab moduleKey="email" />
      </ul>
    </nav>
  );
}
