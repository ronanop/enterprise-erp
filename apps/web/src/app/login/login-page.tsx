"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DEMO_PASSWORD,
  getPostLoginRedirect,
  serviceTeamLoginAccounts,
} from "@/config/module-logins";
import { ApiClientError, authService } from "@/services/api-client";
import { env } from "@/utils/env";
import { cn } from "@/lib/utils";

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
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [microsoftEnabled, setMicrosoftEnabled] = useState<boolean | null>(null);
  const [email, setEmail] = useState(env.demoEmail);
  const [password, setPassword] = useState(env.demoPassword || DEMO_PASSWORD);
  const [loading, setLoading] = useState(false);

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

  async function onPasswordLogin(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await authService.login(email.trim(), password);
      const dest = getPostLoginRedirect(email) || returnTo;
      router.replace(dest.startsWith("/") ? dest : "/");
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : "Sign-in failed. Check email and password.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function quickLogin(nextEmail: string) {
    setEmail(nextEmail);
    setPassword(DEMO_PASSWORD);
    setLoading(true);
    setError(null);
    try {
      await authService.login(nextEmail, DEMO_PASSWORD);
      router.replace(getPostLoginRedirect(nextEmail));
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : "Demo login failed. Seed the service team first.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden px-4 py-10">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_oklch(0.92_0.03_200)_0%,_oklch(0.985_0.004_220)_55%,_oklch(0.97_0.01_240)_100%)]"
      />

      <div className="relative grid w-full max-w-5xl gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <div className="animate-in fade-in-0 zoom-in-95 duration-300">
          <div className="mb-6 text-center lg:text-left">
            <div className="mx-auto mb-3 flex size-11 items-center justify-center rounded-2xl bg-primary text-xs font-semibold tracking-wide text-primary-foreground shadow-md lg:mx-0">
              ERP
            </div>
            <h1 className="text-2xl font-medium tracking-tight">{env.appName}</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Organization users sign in with Microsoft. ERP admins assign a Service Head; the head
              assigns engineers under Service → Users.
            </p>
          </div>

          <div className="rounded-2xl border border-border/80 bg-card/95 p-6 shadow-lg backdrop-blur-sm">
            {error ? <p className="mb-4 text-sm text-destructive">{error}</p> : null}

            {microsoftEnabled === false ? (
              <p className="mb-4 text-sm text-muted-foreground">
                Microsoft sign-in is not configured. Use a demo password account below, or set{" "}
                <code className="rounded bg-muted px-1 text-xs">MICROSOFT_CLIENT_ID</code> on the
                API.
              </p>
            ) : null}

            {microsoftEnabled !== false ? (
              <Button
                type="button"
                className="h-11 w-full cursor-pointer gap-2 font-medium transition-colors duration-200"
                disabled={microsoftEnabled === null || loading}
                onClick={() => {
                  window.location.href = authService.microsoftLoginUrl(returnTo);
                }}
              >
                <MicrosoftIcon className="size-4" />
                {microsoftEnabled === null ? "Checking sign-in…" : "Sign in with Microsoft"}
              </Button>
            ) : null}

            <div className="relative my-5">
              <div className="absolute inset-0 flex items-center" aria-hidden>
                <div className="w-full border-t border-border/70" />
              </div>
              <div className="relative flex justify-center text-[11px] uppercase tracking-wide">
                <span className="bg-card px-2 text-muted-foreground">or demo password</span>
              </div>
            </div>

            <form className="space-y-3" onSubmit={onPasswordLogin}>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground" htmlFor="login-email">
                  Email
                </label>
                <Input
                  id="login-email"
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label
                  className="text-xs font-medium text-muted-foreground"
                  htmlFor="login-password"
                >
                  Password
                </label>
                <Input
                  id="login-password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <Button
                type="submit"
                variant="secondary"
                className="h-10 w-full cursor-pointer"
                disabled={loading}
              >
                {loading ? "Signing in…" : "Sign in with password"}
              </Button>
            </form>
          </div>
        </div>

        <div className="animate-in fade-in-0 slide-in-from-bottom-2 duration-300 rounded-2xl border border-border/80 bg-card/95 p-5 shadow-lg backdrop-blur-sm lg:p-6">
          <div className="mb-4 space-y-1.5">
            <p className="text-sm font-semibold text-foreground">Service team (demo)</p>
            <p className="text-xs text-muted-foreground">
              Local password accounts that mirror SSO roles. Production: assign the same roles via
              Organization → Users (Service Head) and Service → Users (engineers). Password:{" "}
              <code className="rounded bg-muted px-1">{DEMO_PASSWORD}</code>
            </p>
          </div>
          <div className="mb-4 space-y-1.5">
            <div className="grid gap-1.5 sm:grid-cols-2">
              {serviceTeamLoginAccounts.map((account) => (
                <button
                  key={account.email}
                  type="button"
                  disabled={loading}
                  onClick={() => void quickLogin(account.email)}
                  className={cn(
                    "rounded-xl border border-border/70 bg-background/80 px-3 py-3 text-left transition-colors duration-200",
                    "hover:border-primary/40 hover:bg-muted/40 disabled:opacity-60",
                  )}
                >
                  <p className="text-sm font-medium text-foreground">{account.displayName}</p>
                  <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{account.email}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">{account.role}</p>
                </button>
              ))}
            </div>
          </div>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Seed with <code className="rounded bg-muted px-1">python -m scripts.seed_service_team</code>
            . After Microsoft SSO, ERP admins set Service as a module admin on Organization users;
            that user becomes Service Head and manages engineers under Service → Users.
          </p>
        </div>
      </div>
    </div>
  );
}
