"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

/** Primary HR screens from FRD-09 screen inventory */
const HR_NAV = [
  { title: "Overview", href: "/hr" },
  { title: "Profiles", href: "/hr/employee-profiles" },
  { title: "Employment", href: "/hr/employment" },
  { title: "Attendance", href: "/hr/attendance" },
  { title: "Leave", href: "/hr/leave-requests" },
  { title: "Performance", href: "/hr/performance-reviews" },
  { title: "Training", href: "/hr/training" },
  { title: "Separation", href: "/hr/separation" },
] as const;

export function HrWorkspaceNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="HRMS workspace" className="erp-scroll -mx-1 overflow-x-auto px-1">
      <ul className="flex min-w-max items-center gap-0.5 border-b border-border/70 pb-px">
        {HR_NAV.map((item) => {
          const active =
            item.href === "/hr"
              ? pathname === "/hr"
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
