"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, ShieldCheck } from "lucide-react";

import { AuthCardShell, AuthFormError } from "@/components/auth/auth-card-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { parseAuthMe } from "@/lib/auth-user";
import { isErpAdmin } from "@/lib/module-access";
import { welcomeDisplayName } from "@/lib/welcome-display-name";
import { queueWelcomeSplash } from "@/lib/welcome-splash-session";
import { ApiClientError, apiClient, authService } from "@/services/api-client";

function safeReturnPath(value: string | null): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return null;
  // Admin login only returns into the admin area.
  if (value === "/admin" || value.startsWith("/admin/")) return value;
  return "/admin";
}

export default function AdminLoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = safeReturnPath(searchParams.get("next"));

  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [otp, setOtp] = useState("");
  const [mfaRequired, setMfaRequired] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(searchParams.get("error"));

  async function finishSignIn() {
    let userName = "there";
    let mustChange = false;
    try {
      const profile = await authService.me();
      const { user } = parseAuthMe(profile.data);
      const raw = (profile.data as { user?: { must_change_password?: boolean } } | null)?.user;
      mustChange = Boolean(raw?.must_change_password);

      if (!isErpAdmin(user?.userType)) {
        try {
          await authService.logout();
        } catch {
          // Session cleared client-side by api client on logout failure.
        }
        setMfaRequired(false);
        setOtp("");
        setError("This account does not have admin access. Use the employee sign-in instead.");
        return;
      }

      if (user) {
        userName = welcomeDisplayName(user.displayName, user.email);
      }
    } catch {
      setError("Could not verify admin access. Try again.");
      return;
    }

    const redirect = nextPath ?? "/admin";
    if (mustChange) {
      router.replace(`/change-password?next=${encodeURIComponent(redirect)}`);
      return;
    }
    queueWelcomeSplash(userName);
    router.replace(redirect);
    router.refresh();
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      if (mfaRequired) {
        await apiClient("/auth/mfa/verify", {
          method: "POST",
          auth: false,
          body: {
            email: userId.trim(),
            user_id: userId.trim(),
            otp: otp.trim(),
          },
        });
        await finishSignIn();
        return;
      }
      const res = await authService.login(userId.trim(), password);
      if (res.data?.mfa_required) {
        setMfaRequired(true);
        return;
      }
      await finishSignIn();
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.status === 0
            ? "Cannot reach the server. Check your connection and try again."
            : err.message || "Invalid email or password"
          : "Sign-in failed. Try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthCardShell
      title="Admin sign-in"
      description="Sign in with a platform or tenant admin account to open the admin panel."
      footer={
        <Link
          href="/login"
          className="cursor-pointer font-medium text-primary underline-offset-2 transition-colors duration-200 hover:underline focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Employee sign-in
        </Link>
      }
    >
      <form className="space-y-5" onSubmit={(e) => void onSubmit(e)} noValidate>
        <AuthFormError message={error} />

        <div className="space-y-1.5">
          <Label htmlFor="admin-login-user-id" className="text-sm font-medium">
            Admin email
          </Label>
          <Input
            id="admin-login-user-id"
            name="username"
            autoComplete="username"
            autoFocus
            required
            value={userId}
            disabled={mfaRequired || submitting}
            onChange={(e) => setUserId(e.target.value)}
            placeholder="admin@example.com"
            className="h-11 transition-colors duration-200"
          />
        </div>

        {mfaRequired ? (
          <div className="space-y-1.5">
            <Label htmlFor="admin-login-otp" className="text-sm font-medium">
              Authenticator code
            </Label>
            <Input
              id="admin-login-otp"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              required
              value={otp}
              disabled={submitting}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
              placeholder="6-digit code"
              className="h-11 tracking-[0.3em] transition-colors duration-200"
            />
          </div>
        ) : (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="admin-login-password" className="mb-0 text-sm font-medium">
                Password
              </Label>
              <Link
                href={
                  userId.trim()
                    ? `/forgot-password?user=${encodeURIComponent(userId.trim())}`
                    : "/forgot-password"
                }
                className="cursor-pointer text-xs font-medium text-primary underline-offset-2 transition-colors duration-200 hover:underline focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <Input
                id="admin-login-password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                value={password}
                disabled={submitting}
                onChange={(e) => setPassword(e.target.value)}
                className="h-11 pr-11 transition-colors duration-200"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute inset-y-0 right-0 flex w-11 cursor-pointer items-center justify-center rounded-r-lg text-muted-foreground transition-colors duration-200 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>
        )}

        <Button
          type="submit"
          className="mt-1 h-11 w-full cursor-pointer gap-2 font-medium transition-colors duration-200"
          disabled={submitting || !userId.trim() || (mfaRequired ? otp.length !== 6 : !password)}
        >
          <ShieldCheck className="size-4" />
          {submitting ? "Signing in…" : mfaRequired ? "Verify" : "Sign in to admin"}
        </Button>
      </form>
    </AuthCardShell>
  );
}
