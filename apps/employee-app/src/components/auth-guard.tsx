"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { SessionSplash } from "@/components/session-splash";
import { isAuthenticated } from "@/lib/auth";
import { ApiClientError } from "@/services/api-client";
import { essService } from "@/services/ess-service";
import { env } from "@/utils/env";

export function AuthGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [sessionComplete, setSessionComplete] = useState(false);
  const [ready, setReady] = useState(false);

  const onSplashFinished = useCallback(() => {
    setReady(true);
  }, []);

  useEffect(() => {
    if (!isAuthenticated()) {
      window.location.replace(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }

    if (env.useMock) {
      setSessionComplete(true);
      return;
    }

    let cancelled = false;
    // Absolute fail-open so AuthGuard cannot keep SessionSplash forever.
    const hardOpen = window.setTimeout(() => {
      if (!cancelled) {
        setSessionComplete(true);
        setReady(true);
      }
    }, 5_500);

    (async () => {
      try {
        await Promise.race([
          essService.me(),
          new Promise<never>((_, reject) => {
            window.setTimeout(
              () => reject(new ApiClientError("Session check timed out", 0)),
              4_000,
            );
          }),
        ]);
        if (!cancelled) setSessionComplete(true);
      } catch (err) {
        if (!cancelled) {
          if (err instanceof ApiClientError && err.status === 401) {
            window.location.replace(
              `/login?next=${encodeURIComponent(pathname)}`,
            );
            return;
          }
          setSessionComplete(true);
        }
      }
    })();

    return () => {
      cancelled = true;
      window.clearTimeout(hardOpen);
    };
  }, [pathname, router]);

  if (!ready) {
    return (
      <SessionSplash complete={sessionComplete} onFinished={onSplashFinished} />
    );
  }

  return <>{children}</>;
}
