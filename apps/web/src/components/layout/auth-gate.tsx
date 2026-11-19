"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";

import { isAuthenticated } from "@/lib/auth";

function AuthGatePlaceholder({ message }: { message: string }) {
  return (
    <div className="flex min-h-dvh w-full items-center justify-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}

/** Redirect unauthenticated visitors to Microsoft login. */
export function AuthGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    setMounted(true);
    setAuthed(isAuthenticated());
  }, []);

  useEffect(() => {
    if (!mounted || authed) return;
    const next = pathname && pathname !== "/" ? `?next=${encodeURIComponent(pathname)}` : "";
    router.replace(`/login${next}`);
  }, [pathname, router, mounted, authed]);

  if (!mounted) {
    return <AuthGatePlaceholder message="Loading…" />;
  }

  if (!authed) {
    return <AuthGatePlaceholder message="Redirecting to sign-in…" />;
  }

  return <>{children}</>;
}
