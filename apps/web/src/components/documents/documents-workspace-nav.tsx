"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

/** Primary DMS screens from FRD-19 screen inventory */
const DOCUMENTS_NAV = [
  { title: "Overview", href: "/documents" },
  { title: "Folders", href: "/documents/folders" },
  { title: "Documents", href: "/documents/documents" },
  { title: "Versions", href: "/documents/document-versions" },
  { title: "Approvals", href: "/documents/document-approvals" },
  { title: "Templates", href: "/documents/templates" },
  { title: "Retention", href: "/documents/retention-policies" },
  { title: "Archives", href: "/documents/archives" },
] as const;

export function DocumentsWorkspaceNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Documents workspace" className="erp-scroll -mx-1 overflow-x-auto px-1">
      <ul className="flex min-w-max items-center gap-0.5 border-b border-border/70 pb-px">
        {DOCUMENTS_NAV.map((item) => {
          const active =
            item.href === "/documents"
              ? pathname === "/documents"
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
