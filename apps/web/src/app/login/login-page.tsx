"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { authService } from "@/services/api-client";
import { env } from "@/utils/env";

function MicrosoftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 21 21" aria-hidden>
      <rect x="1" y="1" width="9" height="9" fill="#f25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
      <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
      <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
    </svg>
  );
}

export default function LoginPage() {
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [microsoftEnabled, setMicrosoftEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    const oauthError = searchParams.get("error");
    if (oauthError) {
      setError(oauthError);
    }
  }, [searchParams]);

  useEffect(() => {
    void authService
      .microsoftConfig()
      .then((res) => setMicrosoftEnabled(Boolean(res.data?.enabled)))
      .catch(() => setMicrosoftEnabled(false));
  }, []);

  const returnTo = searchParams.get("next")?.startsWith("/")
    ? searchParams.get("next")!
    : "/";

  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden px-4 py-10">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_oklch(0.92_0.03_200)_0%,_oklch(0.985_0.004_220)_55%,_oklch(0.97_0.01_240)_100%)]"
      />

      <div className="relative w-full max-w-md animate-in fade-in-0 zoom-in-95 duration-300">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex size-11 items-center justify-center rounded-2xl bg-primary text-xs font-semibold tracking-wide text-primary-foreground shadow-md">
            ERP
          </div>
          <h1 className="text-2xl font-medium tracking-tight">{env.appName}</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Sign in with your organization Microsoft account. ERP admins assign module access under
            Organization → Users.
          </p>
        </div>

        <div className="rounded-2xl border border-border/80 bg-card/95 p-6 shadow-lg backdrop-blur-sm">
          {error ? <p className="mb-4 text-sm text-destructive">{error}</p> : null}

          {microsoftEnabled === false ? (
            <p className="text-sm text-muted-foreground">
              Microsoft sign-in is not configured. Ask an administrator to set{" "}
              <code className="rounded bg-muted px-1 text-xs">MICROSOFT_CLIENT_ID</code> and related
              SSO settings on the API.
            </p>
          ) : (
            <Button
              type="button"
              className="h-11 w-full cursor-pointer gap-2 font-medium transition-colors duration-200"
              disabled={microsoftEnabled === null}
              onClick={() => {
                window.location.href = authService.microsoftLoginUrl(returnTo);
              }}
            >
              <MicrosoftIcon className="size-4" />
              {microsoftEnabled === null ? "Checking sign-in…" : "Sign in with Microsoft"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
