"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

import { getPostLoginRedirect } from "@/config/module-logins";
import { ApiClientError, authService } from "@/services/api-client";

function MicrosoftAuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

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
        let redirect = result.data?.redirect_to ?? "/";
        try {
          const profile = await authService.me();
          const data = profile.data as { email?: string; user?: { email?: string } } | null;
          const email = data?.email ?? data?.user?.email;
          if (email) redirect = getPostLoginRedirect(email);
        } catch {
          // keep redirect from exchange payload
        }
        router.replace(redirect.startsWith("/") ? redirect : "/");
        router.refresh();
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof ApiClientError ? err.message : "Microsoft sign-in failed");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router, searchParams]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4">
      {error ? (
        <>
          <p className="max-w-md text-center text-sm text-destructive">{error}</p>
          <Link
            href="/login"
            className="inline-flex h-9 cursor-pointer items-center justify-center rounded-md border border-input bg-background px-4 text-sm font-medium transition-colors duration-200 hover:bg-accent"
          >
            Back to sign in
          </Link>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">Completing Microsoft sign-in…</p>
      )}
    </div>
  );
}

export default function MicrosoftAuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center px-4">
          <p className="text-sm text-muted-foreground">Completing Microsoft sign-in…</p>
        </div>
      }
    >
      <MicrosoftAuthCallbackContent />
    </Suspense>
  );
}
