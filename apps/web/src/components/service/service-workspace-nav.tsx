"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

/** SOP service request ticket workflow only */
const SERVICE_NAV = [
  { title: "Overview", href: "/service" },
  { title: "Request Tickets", href: "/service/service-request-tickets" },
  { title: "SLAs", href: "/service/service-slas" },
  { title: "Resolved", href: "/service/resolved-tickets" },
] as const;

export function ServiceWorkspaceNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Service workspace" className="erp-scroll -mx-1 overflow-x-auto px-1">
      <ul className="flex min-w-max items-center gap-0.5 border-b border-border/70 pb-px">
        {SERVICE_NAV.map((item) => {
          const active =
            item.href === "/service"
              ? pathname === "/service"
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
