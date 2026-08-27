"use client";

import { usePathname, useSearchParams } from "next/navigation";

import { erpModules } from "@/config/modules";

const STANDALONE_KEY = "erp-standalone";

/** Extra in-app routes that still use module chrome (not the platform dashboard). */
const EXTRA_MODULE_ROOTS = ["/organization/users"] as const;

const MODULE_ROOTS: readonly string[] = [
  ...erpModules.map((m) => m.href),
  ...EXTRA_MODULE_ROOTS,
];

/**
 * True for any ERP module workspace path (Finance, CRM, HR, …).
 * Platform dashboard (`/`) stays in the main shell.
 */
export function isModuleStandalonePath(pathname: string) {
  if (!pathname || pathname === "/") return false;
  return MODULE_ROOTS.some(
    (root) => pathname === root || pathname.startsWith(`${root}/`),
  );
}

/** @deprecated Use isModuleStandalonePath — kept for existing imports. */
export function isCrmStandalonePath(pathname: string) {
  return isModuleStandalonePath(pathname);
}

/**
 * True when this route uses module workspace chrome (no ERP module-picker sidebar).
 * All module routes are standalone by default; `?standalone=1` remains for compatibility.
 */
export function useStandaloneChrome() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const fromQuery = searchParams.get("standalone") === "1";
  return isModuleStandalonePath(pathname) || fromQuery;
}

export { STANDALONE_KEY };
