"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { essService } from "@/services/ess-service";
import type { EssMe } from "@/types/api";

type EssMeContextValue = {
  me: EssMe | null;
  loading: boolean;
  refresh: () => Promise<void>;
};

const EssMeContext = createContext<EssMeContextValue | null>(null);

export function EssMeProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<EssMe | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const res = await essService.me();
    setMe(res.data ?? null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    refresh()
      .catch(() => {
        if (!cancelled) setMe(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  const value = useMemo(
    () => ({ me, loading, refresh }),
    [me, loading, refresh],
  );

  return (
    <EssMeContext.Provider value={value}>{children}</EssMeContext.Provider>
  );
}

export function useEssMe() {
  const ctx = useContext(EssMeContext);
  if (!ctx) {
    throw new Error("useEssMe must be used within EssMeProvider");
  }
  return ctx;
}

export function useCanApproveTeamLeave() {
  const { me } = useEssMe();
  return Boolean(me?.can_approve_team_leave);
}
