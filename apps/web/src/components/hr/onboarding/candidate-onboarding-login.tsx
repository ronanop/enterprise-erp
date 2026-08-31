"use client";

import { FormEvent, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getPortalSession,
  loginOnboardingPortal,
  savePortalSession,
} from "@/services/onboarding-management-service";

export function CandidateOnboardingLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const session = getPortalSession();
    if (session?.token) {
      window.location.replace(`/onboarding/${session.token}`);
    }
  }, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const caseRow = await loginOnboardingPortal(email, password);
      const token = caseRow.invitation?.token;
      if (!token) {
        throw new Error("This invitation is missing a portal session. Please contact HR.");
      }
      savePortalSession({
        token,
        email: email.trim().toLowerCase(),
        caseId: caseRow.id,
      });
      window.location.replace(`/onboarding/${token}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="hrms-theme min-h-screen bg-background px-4 py-10 text-foreground">
      <div className="mx-auto w-full max-w-md">
        <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
          Employee onboarding
        </p>
        <h1 className="mt-1 text-xl font-semibold tracking-tight">Sign in to continue</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Use the email and password from your invitation. If you closed the link, sign in again with
          the same credentials.
        </p>

        <form
          className="mt-6 space-y-3.5 rounded-xl border border-border/70 bg-card p-5 shadow-sm"
          onSubmit={(e) => void onSubmit(e)}
        >
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="onb-email">
              Email
            </label>
            <Input
              id="onb-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="username"
              className="h-10"
              placeholder="you@example.com"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="onb-password">
              Password
            </label>
            <Input
              id="onb-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="h-10"
              placeholder="Password from your invitation email"
            />
          </div>
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
          <Button type="submit" className="w-full cursor-pointer" disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </Button>
        </form>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Lost the password? Ask HR to resend your onboarding invitation.
        </p>
      </div>
    </div>
  );
}
