"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DEMO_PASSWORD,
  adminLoginAccounts,
  getPostLoginRedirect,
  moduleLoginAccounts,
} from "@/config/module-logins";
import { ApiClientError, authService } from "@/services/api-client";
import { env } from "@/utils/env";
import { cn } from "@/lib/utils";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState(env.demoEmail);
  const [password, setPassword] = useState(env.demoPassword || DEMO_PASSWORD);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function selectAccount(nextEmail: string) {
    setEmail(nextEmail);
    setPassword(DEMO_PASSWORD);
    setError(null);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const trimmed = email.trim();
      await authService.login(trimmed, password);
      router.replace(getPostLoginRedirect(trimmed));
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Login failed");
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
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 right-[-10%] h-72 w-72 rounded-full bg-[oklch(0.72_0.1_190/0.18)] blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-[-10%] left-[-5%] h-80 w-80 rounded-full bg-[oklch(0.55_0.06_250/0.12)] blur-3xl"
      />

      <div className="relative grid w-full max-w-5xl gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <div className="animate-in fade-in-0 zoom-in-95 duration-300">
          <div className="mb-6 text-center lg:text-left">
            <div className="mx-auto mb-3 flex size-11 items-center justify-center rounded-2xl bg-primary text-xs font-semibold tracking-wide text-primary-foreground shadow-md lg:mx-0">
              ERP
            </div>
            <h1 className="text-2xl font-medium tracking-tight">{env.appName}</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Sign in with a module account to open that department hub directly.
            </p>
          </div>

          <div className="rounded-2xl border border-border/80 bg-card/95 p-6 shadow-lg backdrop-blur-sm">
            <div className="mb-5 rounded-xl border border-border/70 bg-muted/40 px-3.5 py-3 text-xs text-muted-foreground">
              <p className="font-medium text-foreground">
                Shared demo password: <span className="font-semibold">Secure1!</span>
              </p>
              <p className="mt-1">
                Click any account on the right to fill the email field. Admins land on the
                dashboard; module users land on their module hub.
              </p>
            </div>

            <form className="space-y-3.5" onSubmit={onSubmit}>
              <div className="space-y-1.5">
                <label
                  className="text-xs font-medium tracking-wide text-muted-foreground uppercase"
                  htmlFor="email"
                >
                  Email
                </label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-10 shadow-none"
                  autoComplete="username"
                />
              </div>
              <div className="space-y-1.5">
                <label
                  className="text-xs font-medium tracking-wide text-muted-foreground uppercase"
                  htmlFor="password"
                >
                  Password
                </label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-10 shadow-none"
                  autoComplete="current-password"
                />
              </div>
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
              <Button type="submit" className="h-10 w-full font-medium" disabled={loading}>
                {loading ? "Signing in…" : "Sign in"}
              </Button>
              <Link
                href="/"
                className="block text-center text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                Continue without auth
              </Link>
            </form>
          </div>
        </div>

        <div className="animate-in fade-in-0 slide-in-from-bottom-2 duration-300 rounded-2xl border border-border/80 bg-card/95 p-5 shadow-lg backdrop-blur-sm lg:p-6">
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <h2 className="text-sm font-medium tracking-tight text-foreground">Demo accounts</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {moduleLoginAccounts.length} modules · click to prefill
              </p>
            </div>
            <code className="rounded-md bg-muted px-2 py-1 text-[11px] text-muted-foreground">
              {DEMO_PASSWORD}
            </code>
          </div>

          <div className="mb-4 space-y-1.5">
            <p className="text-[10px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
              Admins
            </p>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {adminLoginAccounts.map((account) => {
                const selected = email.trim().toLowerCase() === account.email.toLowerCase();
                return (
                  <button
                    key={account.email}
                    type="button"
                    onClick={() => selectAccount(account.email)}
                    className={cn(
                      "rounded-lg border px-3 py-2.5 text-left transition-colors",
                      selected
                        ? "border-primary/40 bg-accent/50"
                        : "border-border/70 bg-background/50 hover:border-primary/25 hover:bg-accent/30",
                    )}
                  >
                    <p className="text-xs font-medium text-foreground">{account.displayName}</p>
                    <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{account.email}</p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <p className="text-[10px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
              Module users
            </p>
            <div className="erp-scroll grid max-h-[min(52vh,28rem)] gap-1.5 overflow-y-auto pr-1 sm:grid-cols-2">
              {moduleLoginAccounts.map((account) => {
                const selected = email.trim().toLowerCase() === account.email.toLowerCase();
                return (
                  <button
                    key={account.email}
                    type="button"
                    onClick={() => selectAccount(account.email)}
                    className={cn(
                      "rounded-lg border px-3 py-2.5 text-left transition-colors",
                      selected
                        ? "border-primary/40 bg-accent/50"
                        : "border-border/70 bg-background/50 hover:border-primary/25 hover:bg-accent/30",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-medium text-foreground">{account.moduleTitle}</p>
                      <span className="shrink-0 text-[10px] text-muted-foreground">{account.href}</span>
                    </div>
                    <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{account.email}</p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
