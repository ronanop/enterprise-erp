"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

/** Primary quality screens from FRD-14 screen inventory */
const QUALITY_NAV = [
  { title: "Overview", href: "/quality" },
  { title: "Incoming", href: "/quality/incoming-inspections" },
  { title: "In-Process", href: "/quality/inprocess-inspections" },
  { title: "Final", href: "/quality/final-inspections" },
  { title: "NCRs", href: "/quality/ncrs" },
  { title: "CAPAs", href: "/quality/capas" },
  { title: "Audits", href: "/quality/audits" },
  { title: "Complaints", href: "/quality/complaints" },
] as const;

export function QualityWorkspaceNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Quality workspace" className="erp-scroll -mx-1 overflow-x-auto px-1">
      <ul className="flex min-w-max items-center gap-0.5 border-b border-border/70 pb-px">
        {QUALITY_NAV.map((item) => {
          const active =
            item.href === "/quality"
              ? pathname === "/quality"
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
