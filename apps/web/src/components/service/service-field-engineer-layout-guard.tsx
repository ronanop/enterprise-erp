"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";

import { useUserPermissions } from "@/hooks/use-user-permissions";
import { isServiceFieldEngineerOnly } from "@/lib/service-field-engineer-access";

/** Field-engineer logins only use their dashboard — redirect away from other service pages. */
export function ServiceFieldEngineerLayoutGuard({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { profile, loading } = useUserPermissions();

  useEffect(() => {
    if (loading) return;
    const feOnly = isServiceFieldEngineerOnly(profile?.roleCodes, profile?.permissions, profile?.roleNames);
    if (feOnly && !pathname.startsWith("/service/field-engineer")) {
      router.replace("/service/field-engineer");
    }
  }, [loading, pathname, profile?.permissions, profile?.roleCodes, router]);

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  return <>{children}</>;
}
