"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useUserPermissions } from "@/hooks/use-user-permissions";
import {
  hasServiceFieldEngineerRole,
  isServiceFieldEngineerOnly,
} from "@/lib/service-field-engineer-access";
import { cn } from "@/lib/utils";

/** SOP service request ticket workflow only */
const SERVICE_NAV = [
  { title: "Overview", href: "/service" },
  { title: "Request Tickets", href: "/service/service-request-tickets" },
  { title: "Mailbox", href: "/service/mailbox", mailboxAccess: true },
  { title: "Field Engineer", href: "/service/field-engineer", fieldEngineerOnly: true },
  { title: "SLAs", href: "/service/service-slas" },
  { title: "Resolved", href: "/service/resolved-tickets" },
] as const;

function canViewServiceMailbox(permissions: string[] | undefined | null): boolean {
  const perms = permissions ?? [];
  return perms.includes("service.request:update") || perms.includes("service.request:approve");
}

export function ServiceWorkspaceNav() {
  const pathname = usePathname();
  const { profile, loading } = useUserPermissions();

  const isFe = hasServiceFieldEngineerRole(profile?.roleCodes, profile?.roleNames);
  const feOnly = isServiceFieldEngineerOnly(profile?.roleCodes, profile?.permissions, profile?.roleNames);

  const visibleNav = SERVICE_NAV.filter((item) => {
    if ("fieldEngineerOnly" in item && item.fieldEngineerOnly) {
      return isFe;
    }
    if ("mailboxAccess" in item && item.mailboxAccess) {
      return canViewServiceMailbox(profile?.permissions) && !feOnly;
    }
    if (feOnly) {
      return false;
    }
    return true;
  });

  if (loading) {
    return (
      <nav aria-label="Service workspace" className="erp-scroll -mx-1 overflow-x-auto px-1">
        <ul className="flex min-w-max items-center gap-0.5 border-b border-border/70 pb-px">
          <li className="inline-flex h-8 items-center px-2.5 text-xs text-muted-foreground">Loading…</li>
        </ul>
      </nav>
    );
  }

  if (visibleNav.length === 0 || (feOnly && visibleNav.length === 1)) {
    return null;
  }

  return (
    <nav aria-label="Service workspace" className="erp-scroll -mx-1 overflow-x-auto px-1">
      <ul className="flex min-w-max items-center gap-0.5 border-b border-border/70 pb-px">
        {visibleNav.map((item) => {
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
