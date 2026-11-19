"use client";

import type { ReactNode } from "react";

import { UserAccountMenu } from "@/components/layout/user-account-menu";
import { useAuthUser } from "@/hooks/use-auth-user";
import { signOutAndRedirect } from "@/lib/sign-out";
import { cn } from "@/lib/utils";

type SidebarAccountSectionProps = {
  collapsed?: boolean;
  className?: string;
  /** Optional content below the account row (rarely used; module brand lives at sidebar top). */
  children?: ReactNode;
};

/** Signed-in user + sign-out menu for dark module sidebars (footer placement). */
export function SidebarAccountSection({
  collapsed = false,
  className,
  children,
}: SidebarAccountSectionProps) {
  const { signedIn, loading } = useAuthUser();

  if (loading) {
    return (
      <div className={cn("px-4 py-3", className)}>
        <div className={cn("flex items-center gap-3", collapsed && "justify-center")}>
          <div className="size-9 shrink-0 animate-pulse rounded-xl bg-sidebar-accent" />
          <div
            className={cn(
              "min-w-0 flex-1 space-y-1.5 transition-opacity duration-[420ms] ease-[cubic-bezier(0.22,1,0.36,1)]",
              collapsed && "hidden",
            )}
          >
            <div className="h-3.5 w-24 animate-pulse rounded bg-sidebar-accent" />
            <div className="h-2.5 w-32 animate-pulse rounded bg-sidebar-accent" />
          </div>
        </div>
      </div>
    );
  }

  if (!signedIn) {
    return children ? (
      <div className={cn("px-4 py-3", className)}>{children}</div>
    ) : null;
  }

  return (
    <div className={cn("px-4 py-3", className)}>
      <UserAccountMenu
        variant="sidebar"
        collapsed={collapsed}
        className="w-full"
        onSignOut={signOutAndRedirect}
      />
      {children ? (
        <div
          className={cn(
            "mt-3 overflow-hidden border-t border-sidebar-border/80 pt-3 transition-opacity duration-[420ms] ease-[cubic-bezier(0.22,1,0.36,1)]",
            collapsed && "pointer-events-none opacity-0",
          )}
          aria-hidden={collapsed}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}
