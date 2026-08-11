"use client";



import { FormEvent, useState } from "react";

import { useRouter, useSearchParams } from "next/navigation";

import {

  MOCK_DEMO_EMAIL,

  MOCK_DEMO_PASSWORD,

} from "@/data/mock-ess";

import { IconBrand } from "@/components/icons";

import { AlertBox } from "@/components/ui";

import { ApiClientError, authService } from "@/services/api-client";

import { essService } from "@/services/ess-service";

import { clearFaceVerified } from "@/lib/face-auth";

import * as ui from "@/theme/classes";

import { env } from "@/utils/env";



type LoginMode = "email" | "employee";



export default function LoginForm() {

  const router = useRouter();

  const searchParams = useSearchParams();

  const [mode, setMode] = useState<LoginMode>("employee");

  const [email, setEmail] = useState(env.useMock ? MOCK_DEMO_EMAIL : "");

  const [companyCode, setCompanyCode] = useState("DEMOCO");

  const [employeeCode, setEmployeeCode] = useState("EMP-004");

  const [password, setPassword] = useState(env.useMock ? MOCK_DEMO_PASSWORD : "");

  const [error, setError] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);



  async function afterLogin() {

    await essService.me();

    clearFaceVerified();

    const next = searchParams.get("next") || "/home";

    if (!env.useMock) {

      const face = await essService.faceStatus();

      if (face.data?.verification_required) {

        router.replace(`/login/face-verify?next=${encodeURIComponent(next)}`);

        return;

      }

    }

    router.replace(next);

  }



  async function onSubmit(event: FormEvent) {

    event.preventDefault();

    setLoading(true);

    setError(null);

    try {

      if (env.useMock || mode === "email") {

        const login = await authService.login(email.trim(), password);

        if (login.data?.mfa_required) {

          setError("MFA is required for this account. Use the ERP login first.");

          return;

        }

      } else {

        const login = await authService.essLogin({

          company_code: companyCode.trim(),

          employee_code: employeeCode.trim(),

          password,

        });

        if (login.data?.mfa_required) {

          setError("MFA is required for this account.");

          return;

        }

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

          setError(err.message);

        }

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

        <div className="relative">

          <IconBrand size={52} />

          <p className="mt-5 text-xs font-bold uppercase tracking-[0.2em] text-[#dbe1ff]">

            {env.appName}

          </p>

          <h1 className="mt-2 text-3xl font-bold tracking-tight">Employee Portal</h1>

        </div>

      </div>



      <form onSubmit={onSubmit} className={`${ui.card} mt-5 space-y-4 p-5`}>

        <div>

          <h2 className="text-lg font-bold text-[#0b1c30]">Sign in</h2>

          <div className="mt-2 flex gap-2">

            <button

              type="button"

              className={`flex-1 rounded-lg px-2 py-2 text-xs font-semibold ${

                mode === "employee"

                  ? "bg-[#004ac6] text-white"

                  : "bg-[#eff4ff] text-[#004ac6]"

              }`}

              onClick={() => setMode("employee")}

            >

              Employee code

            </button>

            <button

              type="button"

              className={`flex-1 rounded-lg px-2 py-2 text-xs font-semibold ${

                mode === "email"

                  ? "bg-[#004ac6] text-white"

                  : "bg-[#eff4ff] text-[#004ac6]"

              }`}

              onClick={() => setMode("email")}

            >

              Email

            </button>

          </div>

        </div>



        {env.useMock ? (

          <div className="rounded-xl border border-[#2563eb]/25 bg-[#dbe1ff]/60 px-3 py-2.5 text-xs text-[#004ac6]">

            <p className="font-semibold">Demo login</p>

            <p className="mt-0.5 text-[#0b1c30]/80">

              {MOCK_DEMO_EMAIL} / {MOCK_DEMO_PASSWORD}

            </p>

          </div>

        ) : null}



        {mode === "email" || env.useMock ? (

          <label className="block space-y-1.5 text-sm">

            <span className="font-semibold text-[#434655]">Email</span>

            <input

              className={ui.input}

              suppressHydrationWarning

              type="email"

              autoComplete="username"

              required={mode === "email" || env.useMock}

              value={email}

              onChange={(e) => setEmail(e.target.value)}

              placeholder="you@company.com"

            />

          </label>

        ) : (

          <>

            <label className="block space-y-1.5 text-sm">

              <span className="font-semibold text-[#434655]">Company code</span>

              <input

                className={ui.input}

                suppressHydrationWarning

                required

                value={companyCode}

                onChange={(e) => setCompanyCode(e.target.value)}

                placeholder="DEMOCO"

              />

            </label>

            <label className="block space-y-1.5 text-sm">

              <span className="font-semibold text-[#434655]">Employee code</span>

              <input

                className={ui.input}

                suppressHydrationWarning

                required

                value={employeeCode}

                onChange={(e) => setEmployeeCode(e.target.value)}

                placeholder="EMP-004"

              />

            </label>

          </>

        )}



        <label className="block space-y-1.5 text-sm">

          <span className="font-semibold text-[#434655]">Password</span>

          <input

            className={ui.input}

            suppressHydrationWarning

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


