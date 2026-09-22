import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { hydrateAuth, isAuthenticated } from "@/lib/auth";
import { clearSessionUnlock, markSessionUnlocked } from "@/lib/biometric";
import { hydrateFaceAuth } from "@/lib/face-auth";
import { authService } from "@/services/api-client";
import { essService } from "@/services/ess-service";
import type { EssMe } from "@/types/api";

type AuthStatus = "loading" | "signedOut" | "signedIn";

type AuthContextValue = {
  status: AuthStatus;
  me: EssMe | null;
  refreshMe: () => Promise<EssMe | null>;
  signOut: () => Promise<void>;
  /** Call after successful login to mark session ready and load profile. */
  completeSignIn: () => Promise<EssMe | null>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [me, setMe] = useState<EssMe | null>(null);

  const refreshMe = useCallback(async () => {
    try {
      const res = await essService.me();
      setMe(res.data);
      return res.data;
    } catch {
      setMe(null);
      return null;
    }
  }, []);

  const completeSignIn = useCallback(async () => {
    const profile = await refreshMe();
    markSessionUnlocked();
    setStatus("signedIn");
    return profile;
  }, [refreshMe]);

  const signOut = useCallback(async () => {
    await authService.logout();
    clearSessionUnlock();
    setMe(null);
    setStatus("signedOut");
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await hydrateAuth();
      await hydrateFaceAuth();
      if (cancelled) return;
      if (!isAuthenticated()) {
        setStatus("signedOut");
        return;
      }
      try {
        const res = await essService.me();
        if (cancelled) return;
        setMe(res.data);
        setStatus("signedIn");
      } catch {
        if (cancelled) return;
        await authService.logout();
        setMe(null);
        setStatus("signedOut");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo(
    () => ({ status, me, refreshMe, signOut, completeSignIn }),
    [status, me, refreshMe, signOut, completeSignIn],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
