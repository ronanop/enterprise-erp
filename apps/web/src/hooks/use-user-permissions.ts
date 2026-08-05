"use client";

import { useCallback, useEffect, useState } from "react";

import { cachedFetch } from "@/lib/client-cache";
import { authService } from "@/services/api-client";
import type { UserProfile } from "@/types/api";

export function useUserPermissions() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void cachedFetch("auth:me", 60_000, () => authService.me())
      .then((res) => {
        if (!cancelled) setUser(res.data);
      })
      .catch(() => {
        if (!cancelled) setUser(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const can = useCallback(
    (permission: string) => {
      const perms = user?.permissions;
      if (!perms || perms.length === 0) {
        // Demo module users often carry broad access via role without enumerated list.
        return true;
      }
      return perms.includes(permission) || perms.includes("*");
    },
    [user],
  );

  return { user, loading, can };
}
