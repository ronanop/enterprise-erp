"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

/** Primary GRC screens from FRD-20 screen inventory */
const GRC_NAV = [
  { title: "Overview", href: "/grc" },
  { title: "Policies", href: "/grc/policies" },
  { title: "Risks", href: "/grc/risk-registers" },
  { title: "Controls", href: "/grc/controls" },
  { title: "Compliance", href: "/grc/compliance-assessments" },
  { title: "Audits", href: "/grc/audits" },
  { title: "CAPA", href: "/grc/corrective-actions" },
  { title: "Incidents", href: "/grc/incidents" },
] as const;

export function GrcWorkspaceNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="GRC workspace" className="erp-scroll -mx-1 overflow-x-auto px-1">
      <ul className="flex min-w-max items-center gap-0.5 border-b border-border/70 pb-px">
        {GRC_NAV.map((item) => {
          const active =
            item.href === "/grc"
              ? pathname === "/grc"
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
