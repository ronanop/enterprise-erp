"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

/** Primary Integration Hub screens from FRD-21 / ERD_21 */
const INTEGRATION_NAV = [
  { title: "Overview", href: "/integration" },
  { title: "Systems", href: "/integration/external-systems" },
  { title: "Connectors", href: "/integration/connectors" },
  { title: "Webhooks", href: "/integration/webhooks" },
  { title: "Events", href: "/integration/event-definitions" },
  { title: "Queues", href: "/integration/message-queues" },
  { title: "Sync", href: "/integration/sync-jobs" },
  { title: "Dead Letters", href: "/integration/dead-letters" },
] as const;

export function IntegrationWorkspaceNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Integration workspace"
      className="erp-scroll -mx-1 overflow-x-auto px-1"
    >
      <ul className="flex min-w-max items-center gap-0.5 border-b border-border/70 pb-px">
        {INTEGRATION_NAV.map((item) => {
          const active =
            item.href === "/integration"
              ? pathname === "/integration"
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
