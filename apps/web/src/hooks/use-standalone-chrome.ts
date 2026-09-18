"use client";

import { useLayoutEffect, useSyncExternalStore } from "react";
import { usePathname, useSearchParams } from "next/navigation";

const STANDALONE_KEY = "erp-standalone";

let sessionVersion = 0;
const sessionListeners = new Set<() => void>();

function emitSessionStandaloneChange() {
  sessionVersion += 1;
  sessionListeners.forEach((listener) => listener());
}

function subscribeSessionStandalone(onStoreChange: () => void) {
  sessionListeners.add(onStoreChange);
  return () => {
    sessionListeners.delete(onStoreChange);
  };
}

function readSessionStandalone(): boolean {
  void sessionVersion;
  try {
    return sessionStorage.getItem(STANDALONE_KEY) === "1";
  } catch {
    return false;
  }
}

function getServerSessionStandalone(): boolean {
  return false;
}

function isAssetsPath(pathname: string): boolean {
  return pathname === "/assets" || pathname.startsWith("/assets/");
}

/**
 * True when this browser tab should use module content chrome (no main ERP sidebar).
 *
 * Asset Management (`/assets/*`) always uses AssetsModuleSidebar so dashboard and
 * sub-routes stay consistent whether opened with or without `?standalone=1`.
 * Other modules still rely on `?standalone=1` and sessionStorage.
 */
export function useStandaloneChrome() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const fromQuery = searchParams.get("standalone") === "1";
  const assetsRoute = isAssetsPath(pathname);
  const sessionStandalone = useSyncExternalStore(
    subscribeSessionStandalone,
    readSessionStandalone,
    getServerSessionStandalone,
  );

  useLayoutEffect(() => {
    if (!fromQuery) return;
    try {
      sessionStorage.setItem(STANDALONE_KEY, "1");
      emitSessionStandaloneChange();
    } catch {
      /* private mode / quota */
    }
  }, [fromQuery]);

  return assetsRoute || fromQuery || sessionStandalone;
}

export { STANDALONE_KEY };
