"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { clearTokens, isAuthenticated, redirectToLogin } from "@/lib/auth";
import { parseAuthMe, type AuthSessionUser } from "@/lib/auth-user";
import { ApiClientError, authService } from "@/services/api-client";

export type AuthSessionStatus = "loading" | "authenticated" | "unauthenticated" | "error";

type AuthSessionValue = {
  user: AuthSessionUser | null;
  permissions: string[];
  moduleKeys: string[];
  adminModuleKeys: string[];
  moduleRoles: Record<string, string>;
  projectModuleAdmin: boolean;
  hrModuleAdmin: boolean;
  assetsModuleAdmin: boolean;
  loading: boolean;
  signedIn: boolean;
  /** Confirmed session load outcome (not just token presence). */
  status: AuthSessionStatus;
  error: string | null;
  refresh: () => Promise<void>;
};

const EMPTY: Omit<AuthSessionValue, "loading" | "signedIn" | "status" | "error" | "refresh"> = {
  user: null,
  permissions: [],
  moduleKeys: [],
  adminModuleKeys: [],
  moduleRoles: {},
  projectModuleAdmin: false,
  hrModuleAdmin: false,
  assetsModuleAdmin: false,
};

const AuthSessionContext = createContext<AuthSessionValue | null>(null);

const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 400;

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function fetchAuthMeWithRetry(): Promise<ReturnType<typeof parseAuthMe>> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await authService.me();
      return parseAuthMe(res.data);
    } catch (err) {
      lastError = err;
      // Auth failure - do not retry; token is invalid.
      if (err instanceof ApiClientError && err.status === 401) {
        throw err;
      }
      if (attempt < MAX_ATTEMPTS) {
        await sleep(RETRY_DELAY_MS * attempt);
      }
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new ApiClientError("Failed to load session", 0);
}

export function AuthSessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState({
    ...EMPTY,
    loading: true,
    status: "loading" as AuthSessionStatus,
    error: null as string | null,
  });
  const loadIdRef = useRef(0);

  const refresh = useCallback(async () => {
    const loadId = ++loadIdRef.current;

    if (!isAuthenticated()) {
      if (loadId !== loadIdRef.current) return;
      setState({
        ...EMPTY,
        loading: false,
        status: "unauthenticated",
        error: null,
      });
      return;
    }

    setState((prev) => ({
      ...prev,
      // Avoid blanking the sidebar on background refresh after a good session.
      loading: prev.status === "authenticated" ? false : true,
      status: prev.status === "authenticated" ? "authenticated" : "loading",
      error: null,
    }));

    try {
      const parsed = await fetchAuthMeWithRetry();
      if (loadId !== loadIdRef.current) return;

      if (!parsed.user) {
        setState({
          ...EMPTY,
          loading: false,
          status: "error",
          error: "Session response was incomplete. Retry to continue.",
        });
        return;
      }

      setState({
        user: parsed.user,
        permissions: parsed.permissions,
        moduleKeys: parsed.moduleKeys,
        adminModuleKeys: parsed.adminModuleKeys,
        moduleRoles: parsed.moduleRoles,
        projectModuleAdmin: parsed.projectModuleAdmin,
        hrModuleAdmin: parsed.hrModuleAdmin,
        assetsModuleAdmin: parsed.assetsModuleAdmin,
        loading: false,
        status: "authenticated",
        error: null,
      });
    } catch (err) {
      if (loadId !== loadIdRef.current) return;

      if (err instanceof ApiClientError && err.status === 401) {
        clearTokens();
        setState({
          ...EMPTY,
          loading: false,
          status: "unauthenticated",
          error: null,
        });
        redirectToLogin();
        return;
      }

      const message =
        err instanceof ApiClientError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to load session";

      // Keep prior modules if we already had a good session - avoid false "no modules".
      setState((prev) => {
        if (prev.status === "authenticated" && prev.user) {
          return {
            ...prev,
            loading: false,
            error: message,
          };
        }
        return {
          ...EMPTY,
          loading: false,
          status: "error",
          error: message,
        };
      });
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const statusRef = useRef(state.status);
  statusRef.current = state.status;
  const errorRef = useRef(state.error);
  errorRef.current = state.error;

  // Retry when returning to the tab after a failed or incomplete session load.
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState !== "visible") return;
      if (
        statusRef.current === "error" ||
        statusRef.current === "unauthenticated" ||
        Boolean(errorRef.current)
      ) {
        void refresh();
      }
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [refresh]);

  const value = useMemo<AuthSessionValue>(
    () => ({
      ...state,
      signedIn: Boolean(state.user) || state.status === "authenticated",
      refresh,
    }),
    [state, refresh],
  );

  return <AuthSessionContext.Provider value={value}>{children}</AuthSessionContext.Provider>;
}

export function useAuthUser(): AuthSessionValue {
  const ctx = useContext(AuthSessionContext);
  if (!ctx) {
    throw new Error("useAuthUser must be used within AuthSessionProvider");
  }
  return ctx;
}
