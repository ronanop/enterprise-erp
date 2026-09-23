"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

import { WelcomeSplash } from "@/components/auth/welcome-splash";
import { getPostLoginRedirect } from "@/config/module-logins";
import { parseAuthMe } from "@/lib/auth-user";
import { welcomeDisplayName } from "@/lib/welcome-display-name";
import { queueWelcomeSplash, clearWelcomeSplash } from "@/lib/welcome-splash-session";
import { ApiClientError, authService } from "@/services/api-client";

type ReadyState = {
  userName: string;
  redirectTo: string;
};

function safeReturnPath(value: string | null | undefined): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return null;
  return value;
}

function MicrosoftAuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState<ReadyState | null>(null);
  const redirectRef = useRef("/home");

  useEffect(() => {
    const code = searchParams.get("code");
    if (!code) {
      setError("Missing Microsoft sign-in code.");
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const result = await authService.exchangeMicrosoftCode(code);
        if (cancelled) return;
        // Prefer the OAuth return_to (e.g. scanned asset QR) over demo module defaults.
        const oauthReturn = safeReturnPath(result.data?.redirect_to ?? null);
        let redirect = oauthReturn ?? "/home";
        let userName = "there";
        try {
          const profile = await authService.me();
          const { user } = parseAuthMe(profile.data);
          if (user) {
            userName = welcomeDisplayName(user.displayName, user.email);
            if (!oauthReturn) {
              if (user.email) {
                redirect = getPostLoginRedirect(user.email);
              } else if (user.userType === "super_admin") {
                redirect = "/home";
              }
            }
          }
        } catch {
          // keep redirect from exchange payload
        }
        // AuthGate will show splash after navigation if this page is skipped/torn down.
        queueWelcomeSplash(userName);
        redirectRef.current = redirect;
        setReady({ userName, redirectTo: redirect });
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof ApiClientError ? err.message : "Microsoft sign-in failed");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  const finishSplash = useCallback(() => {
    clearWelcomeSplash();
    router.replace(ready?.redirectTo ?? redirectRef.current);
    router.refresh();
  }, [ready, router]);

  if (error) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4">
        <p className="max-w-md text-center text-sm text-destructive">{error}</p>
        <Link
          href="/login"
          className="inline-flex h-9 cursor-pointer items-center justify-center rounded-md border border-input bg-background px-4 text-sm font-medium transition-colors duration-200 hover:bg-accent"
        >
          Back to sign in
        </Link>
      </div>
    );
  }

  if (ready) {
    return <WelcomeSplash userName={ready.userName} onComplete={finishSplash} />;
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-[#f5f5f7] px-4">
      <p className="text-sm text-[#6e6e73]">Completing Microsoft sign-in…</p>
    </div>
  );
}

export default function MicrosoftAuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center bg-[#f5f5f7] px-4">
          <p className="text-sm text-[#6e6e73]">Completing Microsoft sign-in…</p>
        </div>
      }
    >
      <MicrosoftAuthCallbackContent />
    </Suspense>
  );
}
