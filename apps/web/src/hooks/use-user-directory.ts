"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { resourceService } from "@/services/api-client";

export type UserDirectory = Record<string, string>;

function displayName(row: Record<string, unknown>): string {
  const candidates = [
    row.display_name,
    row.full_name,
    row.name,
    row.email,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c.trim();
  }
  return "";
}

/** Resolve user UUIDs → display names via GET /users (when permitted). */
export function useUserDirectory() {
  const [directory, setDirectory] = useState<UserDirectory>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await resourceService.list("/users");
        if (cancelled) return;
        const list = Array.isArray(res.data) ? res.data : [];
        const map: UserDirectory = {};
        for (const row of list) {
          const r = row as Record<string, unknown>;
          const id = String(r.id ?? "");
          if (!id) continue;
          map[id] = displayName(r) || id.slice(0, 8);
        }
        setDirectory(map);
      } catch {
        if (!cancelled) setDirectory({});
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const resolve = useCallback(
    (userId?: string | null) => {
      if (!userId) return "—";
      return directory[userId] ?? "Unknown user";
    },
    [directory],
  );

  return useMemo(
    () => ({ directory, resolve, loading }),
    [directory, resolve, loading],
  );
}
