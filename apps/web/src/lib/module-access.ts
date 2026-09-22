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

export function moduleKeyForHref(href: string): string | null {
  if (href === "/" || href === "/home" || href === "/my-jobs") return null;
  if (href === "/organization/users" || href.startsWith("/organization/")) {
    return "organization";
  }
  const mod = erpModules.find((m) => href === m.href || href.startsWith(`${m.href}/`));
  return mod?.key ?? null;
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

export function canManageUserModules(permissions: string[], userType?: string): boolean {
  if (isErpAdmin(userType)) return true;
  return permissions.includes("foundation.user:update");
}

/** Organization Users is reserved for ERP-wide module-admin assignment. */
export function moduleUsersHref(moduleKey: string): string {
  if (moduleKey === "organization") return "/organization/module-users";
  return `/${moduleKey}/users`;
}

export function canManageModuleUsers(
  moduleKey: string,
  adminModuleKeys: string[],
  userType?: string,
): boolean {
  if (isErpAdmin(userType)) return true;
  return adminModuleKeys.includes(moduleKey);
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
