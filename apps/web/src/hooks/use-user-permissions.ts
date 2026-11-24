"use client";

import { useCallback, useEffect, useState } from "react";

import { parseAuthMe } from "@/lib/auth-user";
import { isAuthenticated } from "@/lib/auth";
import { isErpAdmin } from "@/lib/module-access";
import { authService } from "@/services/api-client";
import type { UserProfile } from "@/types/api";

export function useUserPermissions() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [hrModuleAdmin, setHrModuleAdmin] = useState(false);
  const [assetsModuleAdmin, setAssetsModuleAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated()) {
      setUser(null);
      setHrModuleAdmin(false);
      setAssetsModuleAdmin(false);
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
          setAssetsModuleAdmin(parsed.assetsModuleAdmin);
        }
      } catch {
        if (!cancelled) {
          setUser(null);
          setHrModuleAdmin(false);
          setAssetsModuleAdmin(false);
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
    if (isErpAdmin(user?.user_type)) return true;
    const perms = user?.permissions ?? [];
    return perms.includes(permission) || perms.includes("*");
  }, [user]);

  const can = useCallback(
    (permission: string) => {
      // Match API bypass for platform/tenant admins (require_*_permission).
      if (isErpAdmin(user?.user_type)) return true;
      if (assetsModuleAdmin && permission.startsWith("asset.")) return true;
      const perms = user?.permissions;
      if (!perms || perms.length === 0) {
        return hrModuleAdmin;
      }
      return perms.includes(permission) || perms.includes("*");
    },
    [user, hrModuleAdmin, assetsModuleAdmin],
  );

  const isHrmsSuperAdmin = hrModuleAdmin;

  return {
    user,
    loading,
    can,
    canExact,
    isHrmsSuperAdmin,
    hrModuleAdmin,
    assetsModuleAdmin,
  };
}
