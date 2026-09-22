"use client";

import { userInitials } from "@/lib/auth-user";
import { cn } from "@/lib/utils";

type UserAvatarProps = {
  displayName: string;
  imageUrl?: string | null;
  size?: "sm" | "md";
  className?: string;
};

const sizeClasses = {
  sm: "size-9 text-[11px]",
  md: "size-11 text-sm",
};

export function UserAvatar({
  displayName,
  imageUrl,
  size = "sm",
  className,
}: UserAvatarProps) {
  const initials = userInitials(displayName);

  if (imageUrl) {
    return (
      <div
        className={cn(
          "relative shrink-0 overflow-hidden rounded-xl bg-sidebar-accent ring-1 ring-sidebar-border",
          sizeClasses[size],
          className,
        )}
      >
        {/* blob:/data: URLs from Microsoft photo — plain img avoids Next image optimizer */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt=""
          className="size-full object-cover"
          draggable={false}
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sidebar-primary to-sidebar-primary/80 font-semibold tracking-wide text-sidebar-primary-foreground shadow-[0_1px_2px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.2)] ring-1 ring-white/10",
        sizeClasses[size],
        className,
      )}
      aria-hidden
    >
      {initials}
    </div>
  );
}
