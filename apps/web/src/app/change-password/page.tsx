"use client";

import { Suspense, useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { KeyRound } from "lucide-react";

import { AuthCardShell, AuthFormError } from "@/components/auth/auth-card-shell";
import { NewPasswordFields, passwordMeetsPolicy } from "@/components/auth/new-password-fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { parseAuthMe } from "@/lib/auth-user";
import { welcomeDisplayName } from "@/lib/welcome-display-name";
import { queueWelcomeSplash } from "@/lib/welcome-splash-session";
import { ApiClientError, authService } from "@/services/api-client";

function safeReturnPath(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/hr";
  return value;
}

function ChangePasswordForm() {
  const router = useRouter();
  const next = safeReturnPath(useSearchParams().get("next"));
  const [userName, setUserName] = useState("there");
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void authService
      .me()
      .then((res) => {
        const { user } = parseAuthMe(res.data);
        if (user) setUserName(welcomeDisplayName(user.displayName, user.email));
      })
      .catch(() => router.replace(`/login?next=${encodeURIComponent("/change-password")}`));
  }, [router]);

  const valid = Boolean(current) && passwordMeetsPolicy(password) && password === confirm;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting || !valid) return;
    setSubmitting(true);
    setError(null);
    try {
      await authService.changePassword(current, password);
      queueWelcomeSplash(userName);
      router.replace(next);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof ApiClientError && err.status !== 0
          ? err.message || "Could not change password"
          : "Cannot reach the server. Try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthCardShell
      title="Change your password"
      description="You signed in with a temporary password. Set your own password to continue."
    >
      <form className="space-y-4" onSubmit={(e) => void onSubmit(e)} noValidate>
        <AuthFormError message={error} />
        <div>
          <Label htmlFor="current-password">Current (temporary) password</Label>
          <Input
            id="current-password"
            type="password"
            autoComplete="current-password"
            autoFocus
            required
            value={current}
            disabled={submitting}
            onChange={(e) => setCurrent(e.target.value)}
            className="h-10"
          />
        </div>
        <NewPasswordFields
          password={password}
          confirm={confirm}
          onPasswordChange={setPassword}
          onConfirmChange={setConfirm}
          disabled={submitting}
        />
        <Button
          type="submit"
          className="h-10 w-full cursor-pointer gap-2 font-medium transition-colors duration-200"
          disabled={submitting || !valid}
        >
          <KeyRound className="size-4" />
          {submitting ? "Saving…" : "Save password"}
        </Button>
      </form>
    </AuthCardShell>
  );
}

export default function ChangePasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center text-sm text-muted-foreground">
          Loading…
        </div>
      }
    >
      <ChangePasswordForm />
    </Suspense>
  );
}
