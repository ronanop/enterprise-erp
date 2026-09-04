"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { isAuthenticated } from "@/lib/auth";

/** Client-only signed-in state; updates after login/logout and route changes. */
export function useClientAuth(): boolean {
  const pathname = usePathname();
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    const sync = () => setSignedIn(isAuthenticated());
    sync();
    window.addEventListener("storage", sync);
    window.addEventListener("erp-auth-change", sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("erp-auth-change", sync);
    };
  }, [pathname]);

  return signedIn;
}
