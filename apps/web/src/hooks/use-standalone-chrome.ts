"use client";

import { usePathname, useSearchParams } from "next/navigation";

import { erpModules } from "@/config/modules";

const STANDALONE_KEY = "erp-standalone";

/** Extra in-app routes that still use the ERP shell (not module workspace chrome). */
const EXTRA_IN_APP_ROOTS = ["/organization/users"] as const;

const IN_APP_MODULE_ROOTS: readonly string[] = [
  ...erpModules
    .filter((m) => m.group === "foundation" || m.group === "organization" || m.group === "master-data")
    .map((m) => m.href),
  ...EXTRA_IN_APP_ROOTS,
];

const STANDALONE_MODULE_ROOTS: readonly string[] = erpModules
  .filter((m) => m.group === "operations")
  .map((m) => m.href);

function matchesRoot(pathname: string, root: string) {
  return pathname === root || pathname.startsWith(`${root}/`);
}

/**
 * True for operations module workspace paths opened outside the ERP shell.
 * Foundation, organization, and master data keep the ERP sidebar and topbar.
 */
export function isModuleStandalonePath(pathname: string) {
  if (!pathname || pathname === "/") return false;
  if (IN_APP_MODULE_ROOTS.some((root) => matchesRoot(pathname, root))) return false;
  return STANDALONE_MODULE_ROOTS.some((root) => matchesRoot(pathname, root));
}

/** @deprecated Use isModuleStandalonePath — kept for existing imports. */
export function isCrmStandalonePath(pathname: string) {
  return isModuleStandalonePath(pathname);
}

/**
 * True when this route uses module workspace chrome (no ERP module-picker sidebar).
 * Operations modules are standalone; foundation/org/master-data stay in the ERP shell.
 */
export function useStandaloneChrome() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const fromQuery = searchParams.get("standalone") === "1";
  return isModuleStandalonePath(pathname) || fromQuery;
}

export { STANDALONE_KEY };
