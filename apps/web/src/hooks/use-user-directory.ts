"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { useUserPermissions } from "@/hooks/use-user-permissions";
import { loadUserDirectory, type UserDirectory } from "@/services/user-directory-service";

/** Resolve user UUIDs → display names via GET /users (when permitted). */
export function useUserDirectory() {
  const { canExact, loading: permLoading } = useUserPermissions();
  const [directory, setDirectory] = useState<UserDirectory>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (permLoading) return;
    let cancelled = false;
    void (async () => {
      const map = await loadUserDirectory(canExact("foundation.user:read"));
      if (!cancelled) {
        setDirectory(map);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [permLoading, canExact]);

  const resolve = useCallback(
    (id: string | null | undefined) => {
      if (!id) return "—";
      return directory[id] || id.slice(0, 8);
    },
    [directory],
  );

  return useMemo(() => ({ directory, resolve, loading }), [directory, resolve, loading]);
}
