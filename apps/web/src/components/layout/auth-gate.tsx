"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { WelcomeSplash } from "@/components/auth/welcome-splash";
import { AuthSessionProvider } from "@/hooks/use-auth-user";
import { clearTokens, getAccessToken, isAuthenticated, markSessionPresent } from "@/lib/auth";
import {
  clearWelcomeSplash,
  peekWelcomeSplash,
  type WelcomeSplashPayload,
} from "@/lib/welcome-splash-session";
import { ApiClientError, apiClient } from "@/services/api-client";

function AuthGatePlaceholder({ message }: { message: string }) {
  return (
    <div className="flex min-h-dvh w-full items-center justify-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}

function safeNextPath(pathname: string | null, search: string): string | null {
  if (!pathname || pathname === "/") return null;
  const full = search ? `${pathname}?${search}` : pathname;
  if (!full.startsWith("/") || full.startsWith("//")) return null;
  return full;
}

/** Redirect unauthenticated visitors to login, then load a shared auth session. */
export function AuthGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [mounted, setMounted] = useState(false);
  const [checking, setChecking] = useState(true);
  const [authed, setAuthed] = useState(false);
  const [welcome, setWelcome] = useState<WelcomeSplashPayload | null>(null);

  useEffect(() => {
    let cancelled = false;
    setMounted(true);
    setWelcome(peekWelcomeSplash());

    async function resolveSession() {
      if (isAuthenticated() && getAccessToken()) {
        markSessionPresent();
        if (!cancelled) {
          setAuthed(true);
          setChecking(false);
        }
        return;
      }
      // HttpOnly cookie session survives reload — probe /auth/me with credentials.
      try {
        await apiClient("/auth/me", { auth: true });
        markSessionPresent();
        if (!cancelled) {
          setAuthed(true);
          setChecking(false);
        }
        return;
      } catch {
        // fall through to unauthenticated
      }
      if (!cancelled) {
        clearTokens();
        setAuthed(false);
        setChecking(false);
      }
    }

    void resolveSession();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!mounted || checking || authed) return;
    const nextPath = safeNextPath(pathname, searchParams.toString());
    const next = nextPath ? `?next=${encodeURIComponent(nextPath)}` : "";
    router.replace(`/login${next}`);
  }, [pathname, searchParams, router, mounted, checking, authed]);

  // Temporary passwords (issued by an ERP admin) must be replaced before using the ERP.
  useEffect(() => {
    if (!mounted || checking || !authed) return;
    let cancelled = false;
    void apiClient<{ user?: { must_change_password?: boolean } }>("/auth/me", { auth: true })
      .then((res) => {
        if (cancelled || !res.data?.user?.must_change_password) return;
        const nextPath = safeNextPath(pathname, searchParams.toString()) ?? "/home";
        router.replace(`/change-password?next=${encodeURIComponent(nextPath)}`);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [mounted, checking, authed, pathname, searchParams, router]);

  // Soft session check on tab focus — only log out on confirmed 401, never on
  // transient network / API-restart blips (those were causing surprise logouts).
  useEffect(() => {
    if (!mounted || !authed) return;
    let lastCheckAt = 0;
    function onFocus() {
      const now = Date.now();
      if (now - lastCheckAt < 15_000) return;
      lastCheckAt = now;
      void apiClient("/auth/me", { auth: true })
        .then(() => {
          markSessionPresent();
        })
        .catch((err) => {
          if (err instanceof ApiClientError && err.status === 401) {
            clearTokens();
            setAuthed(false);
          }
        });
    }
    function onAuthChange() {
      if (!isAuthenticated()) {
        setAuthed(false);
      }
    }
    window.addEventListener("focus", onFocus);
    window.addEventListener("erp-auth-change", onAuthChange);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("erp-auth-change", onAuthChange);
    };
  }, [mounted, authed]);

  const finishWelcome = useCallback(() => {
    clearWelcomeSplash();
    setWelcome(null);
  }, []);

  if (!mounted || checking) {
    return <AuthGatePlaceholder message="Loading…" />;
  }

  if (!authed) {
    return <AuthGatePlaceholder message="Redirecting to sign-in…" />;
  }

  return (
    <AuthSessionProvider>
      {welcome ? (
        <WelcomeSplash userName={welcome.userName} onComplete={finishWelcome} />
      ) : null}
      {children}
    </AuthSessionProvider>
  );
}
