"use client";

import { UserAvatar } from "@/components/layout/user-avatar";
import { Badge } from "@/components/ui/badge";
import { useAuthUser } from "@/hooks/use-auth-user";
import { cn } from "@/lib/utils";

const MARKETING_ROLE_LABELS: Record<string, string> = {
  admin: "Module admin",
  member: "User",
  marketing_head: "Marketing head",
  video_editor: "Video editor",
  graphic_designer: "Graphic designer",
  content_creator: "Content creator",
  approval_head: "Approval head",
  supporting_member: "Supporting member",
};

function marketingRoleLabel(
  moduleRoles: Record<string, string>,
  adminModuleKeys: string[],
  userType?: string,
): string {
  const role = moduleRoles.marketing;
  if (role && MARKETING_ROLE_LABELS[role]) return MARKETING_ROLE_LABELS[role];
  if (role) return role.replaceAll("_", " ");
  if (adminModuleKeys.includes("marketing")) return "Module admin";
  if (userType === "super_admin" || userType === "tenant_admin") return "Platform admin";
  return "Marketing member";
}

type Props = {
  className?: string;
};

/** Signed-in profile chip for Marketing page headers (name + team role). */
export function MarketingSignedInProfile({ className }: Props) {
  const { user, moduleRoles, adminModuleKeys, loading, signedIn } = useAuthUser();

  if (loading) {
    return (
      <div
        className={cn(
          "flex h-10 min-w-[160px] items-center gap-2.5 rounded-xl border border-border/70 bg-muted/30 px-2.5",
          className,
        )}
        aria-hidden
      >
        <div className="size-8 animate-pulse rounded-full bg-muted" />
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="h-3 w-24 animate-pulse rounded bg-muted" />
          <div className="h-2.5 w-16 animate-pulse rounded bg-muted" />
        </div>
      </div>
    );
  }

  if (!signedIn || !user) return null;

  const roleLabel = marketingRoleLabel(moduleRoles, adminModuleKeys, user.userType);

  return (
    <div
      className={cn(
        "flex max-w-[260px] items-center gap-2.5 rounded-xl border border-border/70 bg-card px-2.5 py-1.5 shadow-sm",
        className,
      )}
      title={`${user.displayName} · ${roleLabel}`}
    >
      <UserAvatar displayName={user.displayName} size="sm" className="!size-8 !text-[10px]" />
      <div className="min-w-0">
        <p className="truncate text-sm font-medium leading-tight text-foreground">
          {user.displayName}
        </p>
        <Badge variant="outline" className="mt-0.5 max-w-full truncate font-normal capitalize">
          {roleLabel}
        </Badge>
      </div>
    </div>
  );
}
