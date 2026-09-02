"use client";

import { UserAvatar } from "@/components/layout/user-avatar";
import { useAuthUser } from "@/hooks/use-auth-user";
import { cn } from "@/lib/utils";

type SignedInUserIdentityProps = {
  /** Sidebar collapsed — avatar only with tooltip via title. */
  collapsed?: boolean;
  /** Top bar: single-line name + email beside avatar. */
  variant?: "sidebar" | "topbar";
  className?: string;
};

export function SignedInUserIdentity({
  collapsed = false,
  variant = "sidebar",
  className,
}: SignedInUserIdentityProps) {
  const { user, loading, signedIn } = useAuthUser();

  if (loading) {
    return (
      <div
        className={cn(
          "flex items-center gap-3",
          variant === "topbar" && "min-w-0",
          collapsed && "justify-center",
          className,
        )}
        aria-busy="true"
        aria-label="Loading user"
      >
        <div className="size-9 shrink-0 animate-pulse rounded-xl bg-muted" />
        {!collapsed && variant === "sidebar" ? (
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="h-3.5 w-24 animate-pulse rounded bg-muted" />
            <div className="h-2.5 w-32 animate-pulse rounded bg-muted" />
          </div>
        ) : null}
        {!collapsed && variant === "topbar" ? (
          <div className="min-w-0 hidden space-y-1 sm:block">
            <div className="h-3.5 w-28 animate-pulse rounded bg-muted" />
            <div className="h-2.5 w-36 animate-pulse rounded bg-muted" />
          </div>
        ) : null}
      </div>
    );
  }

  if (!signedIn || !user) {
    return null;
  }

  const title = `${user.displayName} · ${user.email}`;

  if (variant === "topbar") {
    return (
      <div className={cn("flex min-w-0 items-center gap-2.5", className)} title={title}>
        <UserAvatar displayName={user.displayName} size="sm" className="!size-8 !text-[10px]" />
        <div className="min-w-0 hidden sm:block">
          <p className="truncate text-sm font-medium tracking-tight text-foreground">{user.displayName}</p>
          <p className="truncate text-xs text-muted-foreground">{user.email}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn("flex items-center gap-3", collapsed && "justify-center", className)}
      title={collapsed ? title : undefined}
    >
      <span className="shrink-0">
        <UserAvatar displayName={user.displayName} size="sm" />
      </span>
      {!collapsed ? (
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium tracking-tight text-sidebar-foreground">
            {user.displayName}
          </p>
          <p className="truncate text-[11px] text-sidebar-foreground/65">{user.email}</p>
        </div>
      ) : null}
    </div>
  );
}
