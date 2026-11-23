"use client";

import { useCallback, useEffect, useState } from "react";

import { parseAuthMe } from "@/lib/auth-user";
import { isAuthenticated } from "@/lib/auth";
import { authService } from "@/services/api-client";
import type { UserProfile } from "@/types/api";

/** Matches backend `HR_SUPERADMIN_PERMISSION` / hr module-admin gate. */
export const HR_SUPERADMIN_PERMISSION = "hr.superadmin:manage";

export function useUserPermissions() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [hrModuleAdmin, setHrModuleAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated()) {
      setUser(null);
      setHrModuleAdmin(false);
      setLoading(false);
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const res = await authService.me();
        const parsed = parseAuthMe(res.data);
        if (!cancelled) {
          setUser(
            parsed.user
              ? ({
                  id: parsed.user.id,
                  email: parsed.user.email,
                  display_name: parsed.user.displayName,
                  permissions: parsed.permissions,
                  user_type: parsed.user.userType,
                } as UserProfile)
              : null,
          );
          setHrModuleAdmin(parsed.hrModuleAdmin);
        }
      } catch {
        if (!cancelled) {
          setUser(null);
          setHrModuleAdmin(false);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const canExact = useCallback((permission: string) => {
    const perms = user?.permissions ?? [];
    return perms.includes(permission) || perms.includes("*");
  }, [user]);

  const can = useCallback(
    (permission: string) => {
      const perms = user?.permissions;
      if (!perms || perms.length === 0) {
        return hrModuleAdmin;
      }
      return perms.includes(permission) || perms.includes("*");
    },
    [user, hrModuleAdmin],
  );

  const isHrmsSuperAdmin = hrModuleAdmin;

  return { user, loading, can, canExact, isHrmsSuperAdmin, hrModuleAdmin };
}
