"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useAuthUser } from "@/hooks/use-auth-user";
import { canManageModuleUsers, moduleUsersHref } from "@/lib/module-access";
import { cn } from "@/lib/utils";

type Props = {
  moduleKey: string;
  variant?: "underline" | "pill";
};

export function ModuleUsersNavTab({ moduleKey, variant = "underline" }: Props) {
  const pathname = usePathname();
  const { user, adminModuleKeys, loading } = useAuthUser();
  const href = moduleUsersHref(moduleKey);

  if (loading || !canManageModuleUsers(moduleKey, adminModuleKeys, user?.userType)) {
    return null;
  }

  const active = pathname === href || pathname.startsWith(`${href}/`);

  if (variant === "pill") {
    return (
      <li className="shrink-0">
        <Link
          href={href}
          className={cn(
            "relative inline-flex h-8 cursor-pointer items-center rounded-lg px-2.5 text-xs font-medium transition-[color,background-color] duration-200",
            active
              ? "bg-muted/60 font-semibold text-foreground after:absolute after:inset-x-2 after:bottom-0.5 after:h-0.5 after:rounded-full after:bg-primary"
              : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
          )}
        >
          Users
        </Link>
      </li>
    );
  }

  return (
    <li>
      <Link
        href={href}
        className={cn(
          "inline-flex h-8 cursor-pointer items-center rounded-t-md px-2.5 text-xs font-medium transition-colors duration-200",
          active
            ? "border-b-2 border-primary text-foreground"
            : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
        )}
      >
        Users
      </Link>
    </li>
  );
}
