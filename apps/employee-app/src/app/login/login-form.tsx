"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  MOCK_DEMO_COMPANY,
  MOCK_DEMO_EMPLOYEE_CODE,
  MOCK_DEMO_MOBILE,
  MOCK_DEMO_PASSWORD,
} from "@/data/mock-ess";
import { IconCheck } from "@/components/icons";
import { AlertBox } from "@/components/ui";
import { ApiClientError, authService } from "@/services/api-client";
import { essService } from "@/services/ess-service";
import { clearTokens } from "@/lib/auth";
import { clearFaceVerified } from "@/lib/face-auth";
import { env } from "@/utils/env";

const REMEMBER_KEY = "ess.login.remember";
const LOGIN_ROLE_KEY = "ess.login.role";

type LoginRole = "employee" | "manager" | "hr_team";

type Remembered = {
  companyCode: string;
  employeeCode: string;
};

type CompanyOption = {
  company_code: string;
  company_name: string;
  legal_name?: string;
};

function hrmsEssInboxUrl(): string {
  if (typeof window === "undefined") return "http://127.0.0.1:3000/hr/ess-inbox";
  const { protocol, hostname } = window.location;
  // Same host as ESS (localhost or LAN IP), ERP web is on 3000.
  return `${protocol}//${hostname}:3000/hr/ess-inbox`;
}

function persistLoginRole(role: LoginRole) {
  try {
    sessionStorage.setItem(LOGIN_ROLE_KEY, role);
  } catch {
    /* ignore */
  }
}

type CaptchaState = {
  captcha_id: string;
  question: string;
  code: string;
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

function mobileDigits(value: string) {
  return value.replace(/\D/g, "").slice(-10);
}

const fieldClass =
  "w-full rounded-xl border border-[#e5e7eb] bg-white px-3.5 py-3 text-[0.95rem] text-[#111827] outline-none placeholder:text-[#9ca3af] transition focus:border-[#7c5cfc] focus:shadow-[0_0_0_3px_rgba(124,92,252,0.15)]";

const labelClass = "block text-sm font-medium text-[#374151]";

const ROLE_OPTIONS: { value: LoginRole; label: string }[] = [
  { value: "employee", label: "Employee" },
  { value: "manager", label: "Manager" },
  { value: "hr_team", label: "HR Team" },
];

function CompanyPicker({
  companies,
  loading,
  value,
  onChange,
  disabled,
}: {
  companies: CompanyOption[];
  loading: boolean;
  value: string;
  onChange: (code: string) => void;
  disabled?: boolean;
}) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const selected = companies.find(
    (c) => c.company_code.trim().toUpperCase() === value.trim().toUpperCase(),
  );

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        className={`${fieldClass} flex items-center justify-between gap-3 text-left disabled:opacity-60`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        disabled={disabled || loading}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="min-w-0 flex-1 truncate">
          {loading ? (
            <span className="text-[#9ca3af]">Loading companies…</span>
          ) : selected ? (
            <>
              <span className="font-medium text-[#111827]">{selected.company_name}</span>
              <span className="ml-1.5 text-[#6b7280]">({selected.company_code})</span>
            </>
          ) : (
            <span className="text-[#9ca3af]">Select your company</span>
          )}
        </span>
        <svg
          width="16"
          height="16"
          viewBox="0 0 20 20"
          fill="none"
          className={`shrink-0 text-[#6b7280] transition ${open ? "rotate-180" : ""}`}
          aria-hidden
        >
          <path
            d="M5 7.5 10 12.5 15 7.5"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 z-30 mt-1.5 max-h-56 overflow-auto rounded-xl border border-[#e5e7eb] bg-white py-1 shadow-[0_12px_28px_rgba(15,23,42,0.12)]"
        >
          {companies.length === 0 ? (
            <li className="px-3.5 py-3 text-sm text-[#6b7280]">No companies available</li>
          ) : (
            companies.map((c) => {
              const active =
                c.company_code.trim().toUpperCase() === value.trim().toUpperCase();
              return (
                <li key={c.company_code} role="option" aria-selected={active}>
                  <button
                    type="button"
                    className={
                      active
                        ? "flex w-full flex-col items-start gap-0.5 bg-[#f3efff] px-3.5 py-2.5 text-left"
                        : "flex w-full flex-col items-start gap-0.5 px-3.5 py-2.5 text-left hover:bg-[#f9fafb]"
                    }
                    onClick={() => {
                      onChange(c.company_code);
                      setOpen(false);
                    }}
                  >
                    <span className="text-sm font-medium text-[#111827]">{c.company_name}</span>
                    <span className="text-xs text-[#6b7280]">{c.company_code}</span>
                  </button>
                </li>
              );
            })
          )}
        </ul>
      ) : null}
    </div>
  );
}

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState<1 | 2>(1);
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [companiesLoading, setCompaniesLoading] = useState(true);
  const [companiesError, setCompaniesError] = useState<string | null>(null);
  const [companyCode, setCompanyCode] = useState(env.useMock ? "CDPL" : "");
  const [mobile, setMobile] = useState(env.useMock ? MOCK_DEMO_MOBILE : "");
  const [phoneIdentified, setPhoneIdentified] = useState(false);
  const [captcha, setCaptcha] = useState<CaptchaState | null>(null);
  const [captchaAnswer, setCaptchaAnswer] = useState("");
  const [captchaLoading, setCaptchaLoading] = useState(false);
  const [mobileMasked, setMobileMasked] = useState("");
  const [loginRole, setLoginRole] = useState<LoginRole>("employee");
  const [employeeCode, setEmployeeCode] = useState(env.useMock ? MOCK_DEMO_EMPLOYEE_CODE : "");
  const [password, setPassword] = useState(env.useMock ? MOCK_DEMO_PASSWORD : "");
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const loadCaptcha = useCallback(async () => {
    setCaptchaLoading(true);
    try {
      const res = await authService.essCaptcha();
      const data = res.data;
      if (data?.captcha_id) {
        setCaptcha({
          captcha_id: data.captcha_id,
          question: data.question || "Please type the below code",
          code: data.code || "",
        });
        setCaptchaAnswer("");
      }
    } catch {
      setCaptcha(null);
      setError("Could not load captcha. Tap reload to try again.");
    } finally {
      setCaptchaLoading(false);
    }
  }, []);

  const resetPhoneGate = useCallback(() => {
    setPhoneIdentified(false);
    setMobileMasked("");
    setCaptcha(null);
    setCaptchaAnswer("");
  }, []);

  useEffect(() => {
    const loginError = searchParams.get("error");
    if (loginError) setError(loginError);
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;
    const saved = !env.useMock ? loadRemembered() : null;

    async function loadCompanies() {
      setCompaniesLoading(true);
      setCompaniesError(null);
      try {
        const res = await authService.listEssCompanies();
        if (cancelled) return;
        const rows = Array.isArray(res.data) ? res.data : [];
        setCompanies(rows);

        const rememberedCode = saved?.companyCode?.trim().toUpperCase() ?? "";
        const match = rows.find(
          (c) => c.company_code.trim().toUpperCase() === rememberedCode,
        );
        if (match) {
          setCompanyCode(match.company_code);
        } else if (rows.length === 1) {
          setCompanyCode(rows[0].company_code);
        } else if (env.useMock) {
          const demo =
            rows.find((c) => c.company_code.toUpperCase() === "CDPL") ||
            rows.find((c) => c.company_code.toUpperCase() === MOCK_DEMO_COMPANY) ||
            rows[0];
          if (demo) setCompanyCode(demo.company_code);
        }
      } catch {
        if (!cancelled) {
          setCompanies([]);
          setCompaniesError("Could not load company list. Retry.");
        }
      } finally {
        if (!cancelled) setCompaniesLoading(false);
      }
    }

    void loadCompanies();

    if (saved) {
    setRememberMe(true);
    if (saved.employeeCode) setEmployeeCode(saved.employeeCode);
    setPassword("");
    }

    return () => {
      cancelled = true;
    };
  }, []);

  async function reloadCompanies() {
    setCompaniesLoading(true);
    setCompaniesError(null);
    try {
      const res = await authService.listEssCompanies();
      const rows = Array.isArray(res.data) ? res.data : [];
      setCompanies(rows);
      if (!companyCode && rows.length === 1) {
        setCompanyCode(rows[0].company_code);
      }
    } catch {
      setCompanies([]);
      setCompaniesError("Could not load company list. Retry.");
    } finally {
      setCompaniesLoading(false);
    }
  }

  async function afterLogin() {
    const meRes = await essService.me();
    const me = meRes.data;
    clearFaceVerified();
    persistLoginRole(loginRole);

    const forcedNext = searchParams.get("next");

    if (loginRole === "manager") {
      if (!me?.can_approve_team_leave && !me?.is_manager) {
        clearTokens();
        throw new ApiClientError(
          "This account is not set up as a manager (no direct reports). Sign in as Employee, or ask HR to assign your team.",
          403,
        );
      }
      window.location.replace(forcedNext || "/approvals");
      return;
    }

    if (loginRole === "hr_team") {
      if (!me?.is_ess_admin && me?.ess_role !== "admin") {
        clearTokens();
        throw new ApiClientError(
          "This account does not have HR Team access. Use HRMS with an HR login, or sign in as Employee / Manager.",
          403,
        );
      }
      // Final HR approvals live in HRMS — open that portal after ESS auth check.
      window.location.replace(hrmsEssInboxUrl());
      return;
    }

    // Employee (default)
    window.location.replace(forcedNext || "/home");
  }

  async function identifyPhone() {
    setLoading(true);
    setError(null);
    setInfo(null);
    try {
      const res = await authService.lookupEssPhone({
        company_code: companyCode.trim().toUpperCase(),
        mobile: mobile.trim(),
      });
      setPhoneIdentified(true);
      setMobileMasked(res.data?.mobile_masked || "");
      if (res.data?.company_code) setCompanyCode(res.data.company_code);
      await loadCaptcha();
    } catch (err) {
      resetPhoneGate();
      if (err instanceof ApiClientError) {
        setError(err.message || "Phone number not found for this company.");
      } else {
        setError("Unable to verify phone. Check API connection.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function onStep1Submit(event: FormEvent) {
    event.preventDefault();
    if (!phoneIdentified) {
      await identifyPhone();
      return;
    }

    setLoading(true);
    setError(null);
    setInfo(null);
    try {
      if (!captcha?.captcha_id) {
        setError("Captcha is required. Tap reload and try again.");
        await loadCaptcha();
        return;
      }
      const res = await authService.verifyEssPhone({
        company_code: companyCode.trim().toUpperCase(),
        mobile: mobile.trim(),
        captcha_id: captcha.captcha_id,
        captcha_answer: captchaAnswer.trim(),
      });
      setMobileMasked(res.data?.mobile_masked || mobileMasked);
      if (res.data?.company_code) setCompanyCode(res.data.company_code);
      setStep(2);
    } catch (err) {
      await loadCaptcha();
      if (err instanceof ApiClientError) {
        setError(err.message || "Captcha verification failed.");
      } else {
        setError("Unable to continue. Check API connection.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function onSubmitLogin(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setInfo(null);

    try {
      const login = await authService.essLogin({
        company_code: companyCode.trim().toUpperCase(),
        employee_code: employeeCode.trim().toUpperCase(),
        password: password.trim(),
        login_role: loginRole,
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
          setError(err.message || "Invalid company, employee code, or password.");
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
    setInfo(
      "Default password is your Employee Code + Date of Birth (DDMMYYYY), e.g. CT535415102003. For password resets, contact your HR team.",
    );
  }

  function backToStep1() {
    setStep(1);
    setError(null);
    setInfo(null);
    setPassword("");
    resetPhoneGate();
  }

  const selectedCompany = companies.find(
    (c) => c.company_code.trim().toUpperCase() === companyCode.trim().toUpperCase(),
  );
  const digitsOk = mobileDigits(mobile).length >= 10;
  const canIdentify = Boolean(companyCode.trim()) && digitsOk;
  const canContinue =
    phoneIdentified && Boolean(captchaAnswer.trim()) && Boolean(captcha?.captcha_id);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-[#f5f5f7] px-5 py-10 text-[#111827]">
      <div className="flex flex-1 flex-col justify-center">
        <div className="mb-7 flex flex-col items-center text-center">
          <div
            className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#7c5cfc] text-white shadow-[0_10px_24px_rgba(124,92,252,0.3)]"
            aria-hidden
          >
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
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
          <h1 className="text-[1.65rem] font-bold tracking-tight text-[#111827]">
            Welcome Back
          </h1>
          <p className="mt-1.5 max-w-xs text-sm leading-relaxed text-[#6b7280]">
            {step === 1
              ? phoneIdentified
                ? "Enter the captcha to continue."
                : "Select your entity and enter your registered mobile."
              : "Enter your employee ID and password."}
          </p>
          <div className="mt-4 flex items-center gap-2 text-xs font-medium text-[#6b7280]">
            <span
              className={
                step === 1
                  ? "rounded-full bg-[#7c5cfc] px-2.5 py-1 text-white"
                  : "rounded-full bg-[#e5e7eb] px-2.5 py-1"
              }
            >
              1 · Phone
            </span>
            <span aria-hidden>→</span>
            <span
              className={
                step === 2
                  ? "rounded-full bg-[#7c5cfc] px-2.5 py-1 text-white"
                  : "rounded-full bg-[#e5e7eb] px-2.5 py-1"
              }
            >
              2 · Sign in
            </span>
          </div>
        </div>

        {step === 1 ? (
          <form onSubmit={onStep1Submit} className="space-y-4 overflow-visible">
          {env.useMock ? (
              <div className="rounded-xl border border-[#7c5cfc]/20 bg-[#f3efff] px-3.5 py-3 text-xs text-[#5b3fd4]">
              <p className="font-semibold">Demo login</p>
              <p className="mt-0.5 text-[#374151]/80">
                  Phone: {MOCK_DEMO_MOBILE} · Code: {MOCK_DEMO_EMPLOYEE_CODE} · Password:{" "}
                  {MOCK_DEMO_PASSWORD}
              </p>
            </div>
          ) : null}

            <div className="space-y-1.5">
              <span className={labelClass}>Company / Entity</span>
              {companies.length > 0 || companiesLoading ? (
                <CompanyPicker
                  companies={companies}
                  loading={companiesLoading}
                  value={companyCode}
                  disabled={phoneIdentified}
                  onChange={(code) => {
                    setCompanyCode(code);
                    resetPhoneGate();
                    setError(null);
                  }}
                />
              ) : (
                <div className="space-y-2">
            <input
              className={fieldClass}
              suppressHydrationWarning
              required
              value={companyCode}
                    onChange={(e) => {
                      setCompanyCode(e.target.value.toUpperCase());
                      resetPhoneGate();
                    }}
                    placeholder="e.g. CDPL"
                  />
                  <button
                    type="button"
                    className="text-sm font-semibold text-[#7c5cfc] hover:underline"
                    onClick={() => void reloadCompanies()}
                  >
                    Retry loading companies
                  </button>
                </div>
              )}
              {companiesError ? (
                <p className="mt-1 text-xs text-[#b45309]">{companiesError}</p>
              ) : null}
            </div>

            <label className="block space-y-1.5">
              <span className={labelClass}>Mobile number</span>
              <input
                className={fieldClass}
                suppressHydrationWarning
                required
                inputMode="tel"
                autoComplete="tel"
                value={mobile}
                disabled={phoneIdentified}
                onChange={(e) => {
                  setMobile(e.target.value);
                  if (phoneIdentified) resetPhoneGate();
                  setError(null);
                }}
                placeholder="10-digit registered mobile"
              />
            </label>

            {phoneIdentified ? (
              <div className="space-y-2 rounded-xl border border-[#ddd6fe] bg-[#faf8ff] p-3.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-[#5b3fd4]">Mobile identified</p>
                    <p className="mt-0.5 text-xs text-[#6b7280]">
                      {mobileMasked || "Verified"}
                      {selectedCompany ? ` · ${selectedCompany.company_name}` : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="shrink-0 text-xs font-semibold text-[#7c5cfc] hover:underline"
                    onClick={() => {
                      resetPhoneGate();
                      setError(null);
                    }}
                  >
                    Change
                  </button>
                </div>

                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className={labelClass}>Captcha</span>
                    <button
                      type="button"
                      className="text-sm font-semibold text-[#7c5cfc] hover:underline disabled:opacity-50"
                      onClick={() => void loadCaptcha()}
                      disabled={captchaLoading}
                    >
                      {captchaLoading ? "Loading…" : "Reload"}
                    </button>
                  </div>
                  <div className="flex items-center justify-center rounded-xl border border-dashed border-[#c4b5fd] bg-white px-3 py-3.5">
                    <span className="select-none font-mono text-[1.35rem] font-bold tracking-[0.4em] text-[#5b3fd4]">
                      {captcha?.code || (captchaLoading ? "·····" : "— — —")}
                    </span>
                  </div>
                  <p className="text-xs text-[#6b7280]">
                    {captcha?.question || "Please type the below code"}
                  </p>
                  <input
                    className={fieldClass}
                    suppressHydrationWarning
                    required
                    autoComplete="off"
                    value={captchaAnswer}
                    onChange={(e) => setCaptchaAnswer(e.target.value.toUpperCase())}
                    placeholder="Type the code above"
                    maxLength={8}
                  />
                </div>
              </div>
            ) : null}

            {error ? <AlertBox>{error}</AlertBox> : null}

            <button
              className="mt-1 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#7c5cfc] px-4 py-3.5 text-[1rem] font-semibold text-white shadow-[0_10px_24px_rgba(124,92,252,0.35)] transition active:scale-[0.98] hover:bg-[#6d4ff0] disabled:opacity-55 disabled:shadow-none"
              type="submit"
              disabled={
                loading ||
                (phoneIdentified ? !canContinue : !canIdentify)
              }
            >
              {loading
                ? phoneIdentified
                  ? "Verifying…"
                  : "Checking mobile…"
                : phoneIdentified
                  ? "Continue"
                  : "Verify mobile"}
            </button>
          </form>
        ) : (
          <form onSubmit={onSubmitLogin} className="space-y-4">
            {mobileMasked ? (
              <div className="rounded-xl border border-[#7c5cfc]/20 bg-[#f3efff] px-3.5 py-3 text-xs text-[#5b3fd4]">
                Phone verified: {mobileMasked}
                {selectedCompany ? ` · ${selectedCompany.company_name}` : ""}
              </div>
            ) : null}

            <fieldset className="space-y-1.5">
              <legend className={labelClass}>Sign in as</legend>
              <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Sign in as">
                {ROLE_OPTIONS.map((opt) => {
                  const selected = loginRole === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      className={
                        selected
                          ? "rounded-xl border border-[#7c5cfc] bg-[#f3efff] px-2 py-2.5 text-sm font-semibold text-[#5b3fd4] shadow-[0_0_0_1px_rgba(124,92,252,0.2)]"
                          : "rounded-xl border border-[#e5e7eb] bg-white px-2 py-2.5 text-sm font-medium text-[#4b5563] active:bg-[#f9fafb]"
                      }
                      onClick={() => {
                        setLoginRole(opt.value);
                        setError(null);
                        setInfo(null);
                      }}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-[#6b7280]">
                {loginRole === "manager"
                  ? "Opens Team Approvals. Your HRMS profile must have direct reports."
                  : loginRole === "hr_team"
                    ? "Checks HR access, then opens HRMS ESS inbox for final approvals."
                    : "Standard employee self-service home."}
              </p>
            </fieldset>

            <label className="block space-y-1.5">
              <span className={labelClass}>Company</span>
              <input
                className={`${fieldClass} bg-[#f9fafb] text-[#6b7280]`}
                value={
                  selectedCompany
                    ? `${selectedCompany.company_name} (${companyCode})`
                    : companyCode
                }
                readOnly
            />
          </label>

          <label className="block space-y-1.5">
              <span className={labelClass}>Employee ID</span>
            <input
              className={fieldClass}
              suppressHydrationWarning
              required
              value={employeeCode}
              onChange={(e) => setEmployeeCode(e.target.value.toUpperCase())}
                placeholder="e.g. CDPL5352"
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
                placeholder="Employee code + DOB"
            />
            <p className="mt-1 text-xs text-[#6b7280]">
                Format: Employee Code + DOB (DDMMYYYY)
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
              <div className="rounded-xl border border-[#7c5cfc]/20 bg-[#f3efff] px-3.5 py-3 text-sm text-[#5b3fd4]">
              {info}
            </div>
          ) : null}

          <button
              className="mt-1 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#7c5cfc] px-4 py-3.5 text-[1rem] font-semibold text-white shadow-[0_10px_24px_rgba(124,92,252,0.35)] transition active:scale-[0.98] hover:bg-[#6d4ff0] disabled:opacity-55 disabled:shadow-none"
            type="submit"
              disabled={loading || !employeeCode.trim() || !password.trim()}
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

            <button
              type="button"
              className="w-full text-center text-sm font-semibold text-[#6b7280] hover:text-[#7c5cfc]"
              onClick={backToStep1}
            >
              ← Back to phone verification
          </button>
        </form>
        )}
      </div>

      <p className="mt-8 text-center text-sm text-[#6b7280]">
        Need an account?{" "}
        <span className="font-semibold text-[#7c5cfc]">Contact HR</span>
      </p>
    </main>
  );
}
