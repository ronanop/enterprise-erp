import { isModuleAdmin } from "@/lib/module-access";

/** Module keys where the user is assigned as member but not module admin. */
export function memberOnlyModuleKeys(
  assignedModuleKeys: string[],
  adminModuleKeys: string[],
): string[] {
  const admins = new Set(adminModuleKeys);
  return assignedModuleKeys.filter((key) => !admins.has(key));
}

export function hasModuleAdminAssignment(
  userType: string,
  adminModuleKeys: string[],
): boolean {
  if (isModuleAdmin(userType)) return true;
  return adminModuleKeys.length > 0;
}

export function hasModuleMemberAssignment(
  userType: string,
  assignedModuleKeys: string[],
  adminModuleKeys: string[],
): boolean {
  if (isModuleAdmin(userType)) return false;
  return memberOnlyModuleKeys(assignedModuleKeys, adminModuleKeys).length > 0;
}

export function hasAnyModuleAssignment(
  userType: string,
  assignedModuleKeys: string[],
  adminModuleKeys: string[],
): boolean {
  return (
    hasModuleAdminAssignment(userType, adminModuleKeys) ||
    hasModuleMemberAssignment(userType, assignedModuleKeys, adminModuleKeys)
  );
}
