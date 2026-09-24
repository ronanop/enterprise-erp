"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  MOCK_DEMO_COMPANY,
  MOCK_DEMO_EMPLOYEE_CODE,
  MOCK_DEMO_PASSWORD,
} from "@/data/mock-ess";
import { IconCheck } from "@/components/icons";
import { AlertBox } from "@/components/ui";
import { ApiClientError, authService } from "@/services/api-client";
import { essService } from "@/services/ess-service";
import { clearFaceVerified } from "@/lib/face-auth";
import { env } from "@/utils/env";

const REMEMBER_KEY = "ess.login.remember";

type Remembered = {
  companyCode: string;
  employeeCode: string;
};

function loadRemembered(): Remembered | null {
  try {
    const raw = localStorage.getItem(REMEMBER_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Remembered;
  } catch {
    return null;
  }
}

function saveRemembered(data: Remembered | null) {
  try {
    if (!data) localStorage.removeItem(REMEMBER_KEY);
    else localStorage.setItem(REMEMBER_KEY, JSON.stringify(data));
  } catch {
    /* ignore quota / private mode */
  }
}

function MicrosoftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 23 23" aria-hidden>
      <path fill="#f35325" d="M1 1h10v10H1z" />
      <path fill="#81bc06" d="M12 1h10v10H12z" />
      <path fill="#05a6f0" d="M1 12h10v10H1z" />
      <path fill="#ffba08" d="M12 12h10v10H12z" />
    </svg>
  );
}

const fieldClass =
  "w-full rounded-2xl border border-[#e5e7eb] bg-white px-4 py-3.5 text-[0.95rem] text-[#111827] outline-none placeholder:text-[#9ca3af] transition focus:border-[#7c5cfc] focus:shadow-[0_0_0_3px_rgba(124,92,252,0.15)]";

const labelClass = "block text-sm font-medium text-[#374151]";

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [companyCode, setCompanyCode] = useState(env.useMock ? MOCK_DEMO_COMPANY : "CT");
  const [employeeCode, setEmployeeCode] = useState(env.useMock ? MOCK_DEMO_EMPLOYEE_CODE : "CT5354");
  const [password, setPassword] = useState(env.useMock ? MOCK_DEMO_PASSWORD : "");
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [microsoftEnabled, setMicrosoftEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    const oauthError = searchParams.get("error");
    if (oauthError) setError(oauthError);
  }, [searchParams]);

  useEffect(() => {
    if (env.useMock) {
      setMicrosoftEnabled(false);
      return;
    }
    authService
      .microsoftConfig()
      .then((res) => setMicrosoftEnabled(Boolean(res.data?.enabled)))
      .catch(() => setMicrosoftEnabled(false));
  }, []);

  useEffect(() => {
    if (env.useMock) return;
    const saved = loadRemembered();
    if (!saved) return;
    setRememberMe(true);
    if (saved.companyCode) setCompanyCode(saved.companyCode);
    if (saved.employeeCode) setEmployeeCode(saved.employeeCode);
    setPassword("");
  }, []);

  async function afterLogin() {
    await essService.me();
    clearFaceVerified();
    const next = searchParams.get("next") || "/home";
    router.replace(next);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setInfo(null);

    try {
      const login = await authService.essLogin({
        company_code: companyCode.trim().toUpperCase(),
        employee_code: employeeCode.trim().toUpperCase(),
        password: password.trim(),
      });
      if (login.data?.mfa_required) {
        setError("MFA is required for this account.");
        return;
      }

      if (rememberMe && !env.useMock) {
        saveRemembered({
          companyCode: companyCode.trim().toUpperCase(),
          employeeCode: employeeCode.trim().toUpperCase(),
        });
      } else {
        saveRemembered(null);
      }

      await afterLogin();
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.status === 403) {
          setError(
            err.message ||
              "Account is locked. Wait and try again or contact HR.",
          );
        } else if (err.status === 404) {
          setError("Logged in, but no employee profile is linked to this user.");
        } else {
          setError(err.message || "Invalid company code, employee code, or password.");
        }
      } else {
        setError("Unable to sign in. Check API connection.");
      }
    } finally {
      setLoading(false);
    }
  }

  function onForgotPassword() {
    setError(null);
    setInfo("Default password is your Employee Code + Date of Birth (DDMMYYYY), e.g. CT535415102003. For password resets, contact your HR team.");
  }

  function onMicrosoftSignIn() {
    const next = searchParams.get("next") || "/home";
    window.location.href = authService.microsoftLoginUrl(next);
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-[#f5f5f7] px-6 py-10 text-[#111827]">
      <div className="flex flex-1 flex-col justify-center">
        <div className="mb-8 flex flex-col items-center text-center">
          <div
            className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#7c5cfc] text-white shadow-[0_12px_28px_rgba(124,92,252,0.35)]"
            aria-hidden
          >
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 3.5 5.5 6.2v5.1c0 4.2 2.8 7.9 6.5 9.2 3.7-1.3 6.5-5 6.5-9.2V6.2L12 3.5z"
                fill="currentColor"
                opacity="0.95"
              />
              <path
                d="M8.5 12.2 10.8 14.5 15.5 9.5"
                stroke="white"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <h1 className="text-[1.75rem] font-bold tracking-tight text-[#111827]">
            Welcome Back
          </h1>
          <p className="mt-2 max-w-xs text-[0.95rem] leading-relaxed text-[#6b7280]">
            Log in with your company credentials.
          </p>
        </div>

        {!env.useMock ? (
          <div className="mb-5 space-y-3">
            <button
              type="button"
              disabled={microsoftEnabled === false || microsoftEnabled === null}
              onClick={onMicrosoftSignIn}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-[#e5e7eb] bg-white px-4 py-3.5 text-[1rem] font-semibold text-[#111827] shadow-sm transition hover:bg-[#f9fafb] disabled:opacity-55"
            >
              <MicrosoftIcon />
              {microsoftEnabled === null
                ? "Checking SSO…"
                : microsoftEnabled === false
                  ? "SSO not configured"
                  : "Sign in with Microsoft"}
            </button>
            {microsoftEnabled === false ? (
              <p className="text-center text-xs text-[#6b7280]">
                Ask IT to enable Microsoft SSO, or use your employee code below.
              </p>
            ) : (
              <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-wide text-[#9ca3af]">
                <span className="h-px flex-1 bg-[#e5e7eb]" />
                Or
                <span className="h-px flex-1 bg-[#e5e7eb]" />
              </div>
            )}
          </div>
        ) : null}

        <form onSubmit={onSubmit} className="space-y-4">
          {env.useMock ? (
            <div className="rounded-2xl border border-[#7c5cfc]/20 bg-[#f3efff] px-3.5 py-3 text-xs text-[#5b3fd4]">
              <p className="font-semibold">Demo login</p>
              <p className="mt-0.5 text-[#374151]/80">
                Company: {MOCK_DEMO_COMPANY} &middot; Code: {MOCK_DEMO_EMPLOYEE_CODE} &middot; Password: {MOCK_DEMO_PASSWORD}
              </p>
            </div>
          ) : null}

          <label className="block space-y-1.5">
            <span className={labelClass}>Company code</span>
            <input
              className={fieldClass}
              suppressHydrationWarning
              required
              value={companyCode}
              onChange={(e) => setCompanyCode(e.target.value.toUpperCase())}
              placeholder="e.g. CT or DEMOCO"
            />
          </label>

          <label className="block space-y-1.5">
            <span className={labelClass}>Employee code</span>
            <input
              className={fieldClass}
              suppressHydrationWarning
              required
              value={employeeCode}
              onChange={(e) => setEmployeeCode(e.target.value.toUpperCase())}
              placeholder="e.g. CT5354"
            />
          </label>

          <label className="block space-y-1.5">
            <span className={labelClass}>Password</span>
            <input
              className={fieldClass}
              suppressHydrationWarning
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="e.g. CT535415102003"
            />
            <p className="mt-1 text-xs text-[#6b7280]">
              Format: Employee Code + DOB (DDMMYYYY), e.g. <span className="font-mono text-[#7c5cfc]">CT535415102003</span>
            </p>
          </label>

          <div className="flex items-center justify-between gap-3 pt-0.5">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-[#4b5563]">
              <input
                type="checkbox"
                className="size-4 rounded border-[#d1d5db] text-[#7c5cfc] accent-[#7c5cfc]"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              />
              Remember me
            </label>
            <button
              type="button"
              className="text-sm font-semibold text-[#7c5cfc] hover:underline"
              onClick={onForgotPassword}
            >
              Forgot Password?
            </button>
          </div>

          {error ? <AlertBox>{error}</AlertBox> : null}
          {info ? (
            <div className="rounded-2xl border border-[#7c5cfc]/20 bg-[#f3efff] px-3.5 py-3 text-sm text-[#5b3fd4]">
              {info}
            </div>
          ) : null}

          <button
            className="mt-1 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#7c5cfc] px-4 py-3.5 text-[1rem] font-semibold text-white shadow-[0_10px_24px_rgba(124,92,252,0.35)] transition active:scale-[0.98] hover:bg-[#6d4ff0] disabled:opacity-55 disabled:shadow-none"
            type="submit"
            disabled={loading}
          >
            {loading ? (
              "Signing in…"
            ) : (
              <>
                <IconCheck size={18} className="opacity-90" />
                Sign In
              </>
            )}
          </button>
        </form>
      </div>

      <p className="mt-8 text-center text-sm text-[#6b7280]">
        Need an account?{" "}
        <span className="font-semibold text-[#7c5cfc]">Contact HR</span>
      </p>
    </main>
  );
}
