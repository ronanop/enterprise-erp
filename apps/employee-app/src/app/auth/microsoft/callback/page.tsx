"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ApiClientError, authService } from "@/services/api-client";
import { essService } from "@/services/ess-service";
import { clearFaceVerified } from "@/lib/face-auth";

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
        clearFaceVerified();
        await essService.me();
        const redirect = result.data?.redirect_to || "/home";
        router.replace(redirect.startsWith("/") ? redirect : "/home");
      } catch (err) {
        if (cancelled) return;
        setError(
          err instanceof ApiClientError
            ? err.message
            : "Microsoft sign-in failed",
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router, searchParams]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-[#f5f5f7] px-4">
      {error ? (
        <>
          <p className="max-w-md text-center text-sm text-[#ba1a1a]">{error}</p>
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-2xl bg-[#7c5cfc] px-4 py-3 text-sm font-semibold text-white"
          >
            Back to sign in
          </Link>
        </>
      ) : (
        <p className="text-sm text-[#6b7280]">Completing Microsoft sign-in…</p>
      )}
    </div>
  );
}

export default function MicrosoftAuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center bg-[#f5f5f7] px-4">
          <p className="text-sm text-[#6b7280]">Completing Microsoft sign-in…</p>
        </div>
      }
    >
      <MicrosoftAuthCallbackContent />
    </Suspense>
  );
}
