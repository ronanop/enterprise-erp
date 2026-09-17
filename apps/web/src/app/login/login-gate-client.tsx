"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { AccessCodeDialog } from "@/components/landing/access-code-dialog";
import {
  clearAccessGateToken,
  fetchAccessGateSession,
  getAccessGateToken,
} from "@/services/access-gate-service";

import LoginPage from "./login-page";

/**
 * ConnectPlus path: landing code must unlock this login.
 * Direct /login visits without a valid connectplus gate token open the code dialog.
 */
export function LoginGateClient() {
  const router = useRouter();
  const [state, setState] = useState<"loading" | "ok" | "need-code">("loading");
  const [signInOpen, setSignInOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = getAccessGateToken();
      if (!token) {
        if (!cancelled) {
          setState("need-code");
          setSignInOpen(true);
        }
        return;
      }
      try {
        const session = await fetchAccessGateSession(token);
        if (cancelled) return;
        if (session.target === "demo") {
          router.replace("/demo");
          return;
        }
        if (session.target === "connectplus") {
          setState("ok");
          return;
        }
        clearAccessGateToken();
        setState("need-code");
        setSignInOpen(true);
      } catch {
        if (!cancelled) {
          clearAccessGateToken();
          setState("need-code");
          setSignInOpen(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (state === "loading") {
    return (
      <div className="flex min-h-dvh items-center justify-center text-sm text-muted-foreground">
        Checking access…
      </div>
    );
  }

  if (state === "need-code") {
    return (
      <div className="relative flex min-h-dvh items-center justify-center bg-[#F8FAFC] px-4">
        <div className="max-w-md text-center">
          <h1 className="text-xl font-semibold tracking-tight text-[#0A0A0F]">
            Access code required
          </h1>
          <p className="mt-2 text-sm text-[#5A6070]">
            Sign in from the landing page with your ConnectPlus code to open the live ERP.
          </p>
          <button
            type="button"
            onClick={() => setSignInOpen(true)}
            className="mt-6 inline-flex cursor-pointer items-center justify-center rounded-full bg-[#2563FF] px-5 py-2.5 text-sm font-semibold text-white transition-[filter] duration-200 hover:brightness-110"
          >
            Enter access code
          </button>
          <button
            type="button"
            onClick={() => router.push("/")}
            className="mt-3 block w-full cursor-pointer text-sm font-medium text-[#2563FF] transition-colors duration-200 hover:text-[#1D4ED8]"
          >
            Back to iConnect Plus
          </button>
        </div>
        <AccessCodeDialog
          open={signInOpen}
          onClose={() => {
            setSignInOpen(false);
            router.push("/");
          }}
        />
      </div>
    );
  }

  return <LoginPage />;
}
