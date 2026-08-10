"use client";

import { User } from "lucide-react";

import { useUserPermissions } from "@/hooks/use-user-permissions";
import { cn } from "@/lib/utils";

type SidebarUserIdentityProps = {
  collapsed?: boolean;
  className?: string;
  variant?: "default" | "marketing";
};

export function SidebarUserIdentity({
  collapsed = false,
  className,
  variant = "default",
}: SidebarUserIdentityProps) {
  const { profile, loading } = useUserPermissions();

  if (loading) {
    return (
      <div className={cn("px-3 py-2", className)}>
        <div className="h-10 animate-pulse rounded-lg bg-muted/60" />
      </div>
    );
  }

  if (!profile) return null;

  const subtitle = profile.designation || profile.roleName || profile.userType;

  if (collapsed) {
    return (
      <div className={cn("flex justify-center px-2 py-2", className)} title={`${profile.displayName} — ${subtitle}`}>
        <div
          className={cn(
            "flex size-9 items-center justify-center rounded-full text-xs font-semibold",
            variant === "marketing" ? "bg-primary/15 text-primary" : "bg-sidebar-primary/20 text-sidebar-primary",
          )}
        >
          {profile.initials}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "mx-2 mb-2 flex items-center gap-2.5 rounded-lg border px-2.5 py-2",
        variant === "marketing"
          ? "border-border/70 bg-background/80"
          : "border-sidebar-border bg-sidebar-accent/30",
        className,
      )}
    >
      <div
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-full",
          variant === "marketing" ? "bg-primary/15 text-primary" : "bg-sidebar-primary text-sidebar-primary-foreground",
        )}
      >
        {profile.initials ? (
          <span className="text-xs font-semibold">{profile.initials}</span>
        ) : (
          <User className="size-4" aria-hidden />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "truncate text-sm font-medium",
            variant === "marketing" ? "text-foreground" : "text-sidebar-foreground",
          )}
        >
          {profile.displayName}
        </p>
        {subtitle ? (
          <p
            className={cn(
              "truncate text-[11px]",
              variant === "marketing" ? "text-muted-foreground" : "text-sidebar-foreground/60",
            )}
          >
            {subtitle}
          </p>
        ) : null}
        {variant !== "marketing" ? (
          <p
            className={cn(
              "truncate text-[10px]",
              "text-sidebar-foreground/45",
            )}
          >
            {profile.email}
          </p>
        ) : null}
      </div>
    </div>
  );
}
