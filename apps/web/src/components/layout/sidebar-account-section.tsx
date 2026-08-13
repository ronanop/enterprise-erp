"use client";

import type { ReactNode } from "react";

import { UserAccountMenu } from "@/components/layout/user-account-menu";
import { useAuthUser } from "@/hooks/use-auth-user";
import { signOutAndRedirect } from "@/lib/sign-out";
import { cn } from "@/lib/utils";

type SidebarAccountSectionProps = {
  collapsed?: boolean;
  className?: string;
  /** Module branding below the account row (e.g. Sales CRM). */
  children?: ReactNode;
};

/** Signed-in user + sign-out menu for dark module sidebars. */
export function SidebarAccountSection({
  collapsed = false,
  className,
  children,
}: SidebarAccountSectionProps) {
  const { signedIn, loading } = useAuthUser();

  if (loading) {
    return (
      <div className={cn("px-4 py-4", collapsed && "px-2", className)}>
        <div className="flex items-center gap-3">
          <div className="size-9 shrink-0 animate-pulse rounded-xl bg-sidebar-accent" />
          {!collapsed ? (
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="h-3.5 w-24 animate-pulse rounded bg-sidebar-accent" />
              <div className="h-2.5 w-32 animate-pulse rounded bg-sidebar-accent" />
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  if (!signedIn) {
    return children ? (
      <div className={cn("px-4 py-4", collapsed && "px-2", className)}>{children}</div>
    ) : null;
  }

  return (
    <div className={cn("px-4 py-4", collapsed && "px-2", className)}>
      <UserAccountMenu
        variant="sidebar"
        collapsed={collapsed}
        className="w-full"
        onSignOut={signOutAndRedirect}
      />
      {children && !collapsed ? (
        <div className="mt-3 border-t border-sidebar-border/80 pt-3">{children}</div>
      ) : null}
    </div>
  );
}
