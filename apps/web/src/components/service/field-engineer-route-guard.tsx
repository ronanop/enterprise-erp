"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { useUserPermissions } from "@/hooks/use-user-permissions";
import { hasServiceFieldEngineerRole } from "@/lib/service-field-engineer-access";

/** Only users with the Service Field Engineer role may view the FE dashboard. */
export function FieldEngineerRouteGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { profile, loading } = useUserPermissions();

  useEffect(() => {
    if (loading) return;
    if (!hasServiceFieldEngineerRole(profile?.roleCodes, profile?.roleNames)) {
      router.replace("/service");
    }
  }, [loading, profile?.roleCodes, router]);

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  if (!hasServiceFieldEngineerRole(profile?.roleCodes, profile?.roleNames)) {
    return null;
  }

  return <>{children}</>;
}
