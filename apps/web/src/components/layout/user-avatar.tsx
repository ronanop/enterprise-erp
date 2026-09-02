"use client";

import Image from "next/image";

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
        <Image
          src={imageUrl}
          alt=""
          fill
          className="object-cover"
          sizes={size === "sm" ? "36px" : "44px"}
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-xl bg-sidebar-primary font-semibold tracking-wide text-sidebar-primary-foreground shadow-sm",
        sizeClasses[size],
        className,
      )}
      aria-hidden
    >
      {initials}
    </div>
  );
}
