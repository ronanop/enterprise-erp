"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  CheckCircle2,
  Clock3,
  Inbox,
  LayoutDashboard,
  Ticket,
  Wrench,
} from "lucide-react";

import { ModuleUsersNavTab } from "@/components/organization/module-users-nav-tab";
import { useUserPermissions } from "@/hooks/use-user-permissions";
import {
  hasServiceFieldEngineerRole,
  isServiceFieldEngineerOnly,
} from "@/lib/service-field-engineer-access";
import { cn } from "@/lib/utils";

type ServiceNavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  mailboxAccess?: boolean;
  fieldEngineerOnly?: boolean;
};

/** SOP service request ticket workflow — CRM-style icon strip. */
const SERVICE_NAV: readonly ServiceNavItem[] = [
  { title: "Dashboard", href: "/service", icon: LayoutDashboard },
  { title: "Request Tickets", href: "/service/service-request-tickets", icon: Ticket },
  { title: "Mailbox", href: "/service/mailbox", icon: Inbox, mailboxAccess: true },
  {
    title: "Field Engineer",
    href: "/service/field-engineer",
    icon: Wrench,
    fieldEngineerOnly: true,
  },
  { title: "SLAs", href: "/service/service-slas", icon: Clock3 },
  { title: "Resolved", href: "/service/resolved-tickets", icon: CheckCircle2 },
];

function canViewServiceMailbox(permissions: string[] | undefined | null): boolean {
  const perms = permissions ?? [];
  return perms.includes("service.request:update") || perms.includes("service.request:approve");
}

export function ServiceWorkspaceNav() {
  const pathname = usePathname();
  const { profile, loading } = useUserPermissions();

  const isFe = hasServiceFieldEngineerRole(profile?.roleCodes, profile?.roleNames);
  const feOnly = isServiceFieldEngineerOnly(
    profile?.roleCodes,
    profile?.permissions,
    profile?.roleNames,
  );

  const visibleNav = SERVICE_NAV.filter((item) => {
    if (item.fieldEngineerOnly) {
      return isFe;
    }
    if (item.mailboxAccess) {
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
          <li className="inline-flex h-8 items-center px-2.5 text-xs text-muted-foreground">
            Loading…
          </li>
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
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  "inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-t-md px-2.5 text-xs font-medium transition-colors duration-200",
                  active
                    ? "border-b-2 border-primary text-foreground"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                )}
              >
                <Icon className="size-3.5 shrink-0 opacity-80" aria-hidden />
                {item.title}
              </Link>
            </li>
          );
        })}
        {!feOnly ? <ModuleUsersNavTab moduleKey="service" /> : null}
      </ul>
    </nav>
  );
}
