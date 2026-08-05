"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";

import { isAuthenticated, redirectToLogin } from "@/lib/auth";

/** Redirects to login when no access token is stored (protected app routes). */
export function AuthSessionGuard({ children }: { children: ReactNode }) {
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    if (!isAuthenticated()) {
      redirectToLogin();
      return;
    }
    setAllowed(true);
  }, []);

  if (!allowed) {
    return (
      <div className="flex min-h-dvh flex-1 items-center justify-center px-4 text-sm text-muted-foreground">
        Redirecting to sign in…
      </div>
    );
  }

  return <>{children}</>;
}
