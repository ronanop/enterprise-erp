"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

import { ApiClientError, authService } from "@/services/api-client";
import { getPostLoginRedirect } from "@/config/module-logins";

export default function MicrosoftAuthCallbackPage() {
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
          const email = profile.data?.user?.email;
          if (email) {
            redirect = getPostLoginRedirect(email);
          } else if (profile.data?.user?.user_type === "super_admin") {
            redirect = "/";
          }
        } catch {
          // keep redirect from exchange payload
        }
        router.replace(redirect);
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
            className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-4 text-sm font-medium transition-colors hover:bg-accent"
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
