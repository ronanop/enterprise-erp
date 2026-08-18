import { erpModules } from "@/config/modules";
import type { NavGroup } from "@/config/navigation";

const ADMIN_USER_TYPES = new Set(["super_admin", "tenant_admin"]);

export function isModuleAdmin(userType?: string): boolean {
  return Boolean(userType && ADMIN_USER_TYPES.has(userType));
}

export function allErpModuleKeys(): string[] {
  return erpModules.map((m) => m.key);
}

export function moduleKeyForHref(href: string): string | null {
  if (href === "/") return null;
  if (href === "/organization/users") return "organization";
  const mod = erpModules.find((m) => href === m.href || href.startsWith(`${m.href}/`));
  return mod?.key ?? null;
}

export function canAccessHref(href: string, moduleKeys: string[], userType?: string): boolean {
  if (href === "/") return true;
  if (href === "/organization/users") {
    return isModuleAdmin(userType) || moduleKeys.includes("foundation");
  }
  const key = moduleKeyForHref(href);
  if (!key) return true;
  if (isModuleAdmin(userType)) return true;
  return moduleKeys.includes(key);
}

export function filterNavigationGroups(
  groups: NavGroup[],
  moduleKeys: string[],
  userType?: string,
): NavGroup[] {
  return groups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => canAccessHref(item.href, moduleKeys, userType)),
    }))
    .filter((group) => group.items.length > 0);
}

export function moduleTitle(key: string): string {
  return erpModules.find((m) => m.key === key)?.title ?? key;
}

export function canManageUserModules(permissions: string[], userType?: string): boolean {
  if (isModuleAdmin(userType)) return true;
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
  if (isModuleAdmin(userType)) return true;
  return adminModuleKeys.includes(moduleKey);
}
