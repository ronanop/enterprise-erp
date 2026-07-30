"use client";

import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  MOCK_DEMO_EMAIL,
  MOCK_DEMO_PASSWORD,
} from "@/data/mock-ess";
import { IconBrand, IconCheck } from "@/components/icons";
import { AlertBox } from "@/components/ui";
import { ApiClientError, authService } from "@/services/api-client";
import { essService } from "@/services/ess-service";
import * as ui from "@/theme/classes";
import { env } from "@/utils/env";

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState(env.useMock ? MOCK_DEMO_EMAIL : "");
  const [password, setPassword] = useState(env.useMock ? MOCK_DEMO_PASSWORD : "");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const login = await authService.login(email.trim(), password);
      if (login.data?.mfa_required) {
        setError("MFA is required for this account. Use the ERP login first.");
        return;
      }
      await authService.me();
      await essService.me();
      const next = searchParams.get("next") || "/home";
      router.replace(next);
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(
          err.status === 404
            ? "Logged in, but no employee profile is linked to this user."
            : err.message,
        );
      } else {
        setError("Unable to sign in. Check API connection.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className={`${ui.shellPlain} mx-auto flex max-w-lg flex-col px-5 py-8`}>
      <div className="relative overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-[#004ac6] to-[#712ae2] px-5 py-8 text-white shadow-[0_16px_40px_rgba(37,99,235,0.3)]">
        <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-10 left-10 h-28 w-28 rounded-full bg-[#8a4cfc]/30 blur-2xl" />
        <div className="relative">
          <IconBrand size={52} />
          <p className="mt-5 text-xs font-bold uppercase tracking-[0.2em] text-[#dbe1ff]">
            {env.appName}
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">
            Employee Portal
          </h1>
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-white/80">
            Intelligent orchestration for attendance, leave, and payslips.
          </p>
          <ul className="mt-5 space-y-2 text-sm text-white/85">
            {[
              "One-tap attendance",
              "AI-assisted leave",
              "Payslips on demand",
            ].map((item) => (
              <li key={item} className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/20 text-white">
                  <IconCheck size={12} />
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <form onSubmit={onSubmit} className={`${ui.card} mt-5 space-y-4 p-5`}>
        <div>
          <h2 className="text-lg font-bold text-[#0b1c30]">Sign in</h2>
          <p className={`mt-1 text-sm ${ui.muted}`}>
            {env.useMock
              ? "Demo mode — use the sample account below"
              : "Use your company ERP account"}
          </p>
        </div>

        {env.useMock ? (
          <div className="rounded-xl border border-[#2563eb]/25 bg-[#dbe1ff]/60 px-3 py-2.5 text-xs text-[#004ac6]">
            <p className="font-semibold">Demo login</p>
            <p className="mt-0.5 text-[#0b1c30]/80">
              {MOCK_DEMO_EMAIL} / {MOCK_DEMO_PASSWORD}
            </p>
          </div>
        ) : null}

        <label className="block space-y-1.5 text-sm">
          <span className="font-semibold text-[#434655]">Email</span>
          <input
            className={ui.input}
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
          />
        </label>
        <label className="block space-y-1.5 text-sm">
          <span className="font-semibold text-[#434655]">Password</span>
          <input
            className={ui.input}
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </label>
        {error ? <AlertBox>{error}</AlertBox> : null}
        <button className={`${ui.btn} w-full`} type="submit" disabled={loading}>
          {loading ? "Signing in…" : "Continue"}
        </button>
      </form>
    </main>
  );
}
