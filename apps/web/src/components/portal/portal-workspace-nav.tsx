"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

/** Primary portal screens from ERD_23 */
const PORTAL_NAV = [
  { title: "Overview", href: "/portal" },
  { title: "Accounts", href: "/portal/portal-accounts" },
  { title: "Profiles", href: "/portal/customer-profiles" },
  { title: "Sessions", href: "/portal/portal-sessions" },
  { title: "Orders", href: "/portal/order-views" },
  { title: "Invoices", href: "/portal/invoice-views" },
  { title: "Tickets", href: "/portal/support-tickets" },
  { title: "Requests", href: "/portal/service-requests" },
] as const;

export function PortalWorkspaceNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Portal workspace"
      className="erp-scroll -mx-1 overflow-x-auto px-1"
    >
      <ul className="flex min-w-max items-center gap-0.5 border-b border-border/70 pb-px">
        {PORTAL_NAV.map((item) => {
          const active =
            item.href === "/portal"
              ? pathname === "/portal"
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
