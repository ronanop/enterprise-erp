"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { isAuthenticated, redirectToLogin } from "@/lib/auth";
import { ensureOrgContextReady } from "@/lib/ensure-org-context";

/** Redirects to login when no access token is stored; restores company context before app renders. */
export function AuthSessionGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [allowed, setAllowed] = useState(false);
  const [status, setStatus] = useState("Checking session…");

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      if (!isAuthenticated()) {
        redirectToLogin();
        return;
      }

      setStatus("Restoring company context…");
      try {
        const result = await ensureOrgContextReady();
        if (cancelled) return;

        if (result === "needs_company") {
          const next = encodeURIComponent(
            typeof window !== "undefined"
              ? `${window.location.pathname}${window.location.search}`
              : "/",
          );
          router.replace(`/select-company?next=${next}`);
          return;
        }

        setAllowed(true);
      } catch {
        if (cancelled) return;
        // Prefer showing the app over a permanent spinner if restore fails
        setAllowed(true);
      }
    })();

    return () => {
      cancelled = true;
    };
    // Run once on mount — do not re-block on every route change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!allowed) {
    return (
      <div className="flex min-h-dvh flex-1 items-center justify-center px-4 text-sm text-muted-foreground">
        {status}
      </div>
    );
  }

  return <>{children}</>;
}
