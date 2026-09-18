"use client";

import { useEffect, useState } from "react";

import { getAccessToken } from "@/lib/auth";
import { getApiUrl } from "@/utils/env";

/**
 * Loads the signed-in user's Microsoft profile photo from GET /auth/me/avatar
 * as a blob object URL. Falls back to null when unavailable.
 */
export function useAuthAvatar(enabled: boolean): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      setUrl(null);
      return;
    }

    const token = getAccessToken();
    if (!token) {
      setUrl(null);
      return;
    }

    let cancelled = false;
    let objectUrl: string | null = null;

    void (async () => {
      try {
        const res = await fetch(`${getApiUrl()}/auth/me/avatar`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        if (cancelled) return;
        if (res.status === 204 || !res.ok) {
          setUrl(null);
          return;
        }
        const blob = await res.blob();
        if (cancelled || !blob.type.startsWith("image/") || blob.size === 0) {
          setUrl(null);
          return;
        }
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      } catch {
        if (!cancelled) setUrl(null);
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [enabled]);

  return url;
}
