"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

/** Primary recruitment screens from FRD-09 / ERD_13 screen inventory */
const RECRUITMENT_NAV = [
  { title: "Overview", href: "/recruitment" },
  { title: "Requisitions", href: "/recruitment/job-requisitions" },
  { title: "Postings", href: "/recruitment/job-postings" },
  { title: "Candidates", href: "/recruitment/candidates" },
  { title: "Applications", href: "/recruitment/applications" },
  { title: "Interviews", href: "/recruitment/interviews" },
  { title: "Offers", href: "/recruitment/offers" },
  { title: "Onboarding", href: "/recruitment/onboarding" },
] as const;

export function RecruitmentWorkspaceNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Recruitment workspace" className="erp-scroll -mx-1 overflow-x-auto px-1">
      <ul className="flex min-w-max items-center gap-0.5 border-b border-border/70 pb-px">
        {RECRUITMENT_NAV.map((item) => {
          const active =
            item.href === "/recruitment"
              ? pathname === "/recruitment"
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
