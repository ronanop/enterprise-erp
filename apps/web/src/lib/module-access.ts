import { erpModules } from "@/config/modules";
import type { NavGroup } from "@/config/navigation";

const ADMIN_USER_TYPES = new Set(["super_admin", "tenant_admin"]);

/** Sidebar groups / modules only ERP platform admins may open. */
const ERP_ADMIN_ONLY_GROUPS = new Set(["foundation", "organization", "master-data"]);

export function isModuleAdmin(userType?: string): boolean {
  return Boolean(userType && ADMIN_USER_TYPES.has(userType));
}

/** Alias: platform ERP admin (super_admin / tenant_admin), not per-module admin. */
export function isErpAdmin(userType?: string): boolean {
  return isModuleAdmin(userType);
}

export function allErpModuleKeys(): string[] {
  return erpModules.map((m) => m.key);
}

/** True when every ERP module is assigned as module-admin (All modules entitlement). */
export function hasAllModulesAdmin(adminModuleKeys: string[]): boolean {
  const all = allErpModuleKeys();
  if (all.length === 0) return false;
  const set = new Set(adminModuleKeys);
  return all.every((key) => set.has(key));
}

const ASSET_IT_KEY = "assets-it";
const ASSET_NON_IT_KEY = "assets-non-it";
const ASSET_PARENT_KEY = "assets";

export function moduleKeyForHref(href: string): string | null {
  if (href === "/" || href === "/home" || href === "/my-jobs") return null;
  // External absolute URLs (e.g. Feedback Microsoft Form) are not module-gated.
  if (/^https?:\/\//i.test(href)) return null;
  if (href === "/organization/users" || href.startsWith("/organization/")) {
    return "organization";
  }
  // Assets IT / Non-IT are separate assignable modules under /assets.
  if (href === "/assets/non-it" || href.startsWith("/assets/non-it/")) {
    return ASSET_NON_IT_KEY;
  }
  if (href === "/assets" || href.startsWith("/assets/")) {
    return ASSET_IT_KEY;
  }
  const mod = erpModules.find((m) => href === m.href || href.startsWith(`${m.href}/`));
  return mod?.key ?? null;
}

function hasAssetModuleAccess(
  key: string,
  moduleKeys: string[],
  adminModuleKeys: string[],
): boolean {
  const assigned = new Set([...moduleKeys, ...adminModuleKeys]);
  const hasIt = assigned.has(ASSET_IT_KEY);
  const hasNonIt = assigned.has(ASSET_NON_IT_KEY);
  // Explicit IT / Non-IT grants win. Parent ``assets`` alone is legacy full access.
  // Do not let a leftover parent row unlock the other domain when a submodule is set.
  if (hasIt || hasNonIt) {
    if (key === ASSET_IT_KEY) return hasIt;
    if (key === ASSET_NON_IT_KEY) return hasNonIt;
    return false;
  }
  if (assigned.has(ASSET_PARENT_KEY)) return true;
  return false;
}

function moduleGroupForHref(href: string): string | null {
  if (href === "/organization/users" || href.startsWith("/organization/")) {
    return "organization";
  }
  const mod = erpModules.find((m) => href === m.href || href.startsWith(`${m.href}/`));
  return mod?.group ?? null;
}

export function hasModuleAssignments(
  moduleKeys: string[],
  userType?: string,
  adminModuleKeys: string[] = [],
): boolean {
  if (isErpAdmin(userType)) return true;
  return moduleKeys.length > 0 || adminModuleKeys.length > 0;
}

export function canAccessHref(
  href: string,
  moduleKeys: string[],
  userType?: string,
  adminModuleKeys: string[] = [],
): boolean {
  if (href === "/" || href === "/home" || href === "/my-jobs") return true;

  const group = moduleGroupForHref(href);
  if (group && ERP_ADMIN_ONLY_GROUPS.has(group)) {
    return isErpAdmin(userType);
  }

  const key = moduleKeyForHref(href);
  if (!key) return true;
  if (isErpAdmin(userType)) return true;
  if (key === ASSET_IT_KEY || key === ASSET_NON_IT_KEY) {
    return hasAssetModuleAccess(key, moduleKeys, adminModuleKeys);
  }
  // Module admins can open every screen in the modules they administer.
  if (adminModuleKeys.includes(key)) return true;
  return moduleKeys.includes(key);
}

export function filterNavigationGroups(
  groups: NavGroup[],
  moduleKeys: string[],
  userType?: string,
  adminModuleKeys: string[] = [],
): NavGroup[] {
  const erpAdmin = isErpAdmin(userType);
  return groups
    .filter((group) => {
      const title = group.title.toLowerCase();
      if (title === "foundation" || title === "organization" || title === "master data") {
        return erpAdmin;
      }
      return true;
    })
    .map((group) => ({
      ...group,
      items: group.items.filter((item) =>
        canAccessHref(item.href, moduleKeys, userType, adminModuleKeys),
      ),
    }))
    .filter((group) => group.items.length > 0);
}

export function moduleTitle(key: string): string {
  return erpModules.find((m) => m.key === key)?.title ?? key;
}

/** Organization Users is reserved for ERP-wide module-admin assignment. */
export function moduleUsersHref(moduleKey: string): string {
  if (moduleKey === "organization") return "/organization/module-users";
  if (moduleKey === ASSET_IT_KEY) return "/assets/users?domain=IT";
  if (moduleKey === ASSET_NON_IT_KEY) return "/assets/users?domain=NON_IT";
  if (moduleKey === ASSET_PARENT_KEY) return "/assets/users";
  return `/${moduleKey}/users`;
}

export function canManageModuleUsers(
  moduleKey: string,
  adminModuleKeys: string[],
  userType?: string,
): boolean {
  if (isErpAdmin(userType)) return true;
  if (adminModuleKeys.includes(moduleKey)) return true;
  // Parent Assets admin may manage IT / Non-IT Users tabs.
  if (
    (moduleKey === ASSET_IT_KEY || moduleKey === ASSET_NON_IT_KEY) &&
    adminModuleKeys.includes(ASSET_PARENT_KEY)
  ) {
    return true;
  }
  return false;
}

/**
 * True when the user may see all screens/records in a module (not member-scoped).
 * Platform admins and per-module admins qualify; team roles stay role-gated separately.
 */
export function canViewAllModuleScreens(
  moduleKey: string,
  adminModuleKeys: string[],
  userType?: string,
  moduleRoles: Record<string, string> = {},
): boolean {
  if (isErpAdmin(userType)) return true;
  if (adminModuleKeys.includes(moduleKey)) return true;
  // Legacy: role "admin" on the module assignment is module admin.
  return moduleRoles[moduleKey] === "admin";
}
