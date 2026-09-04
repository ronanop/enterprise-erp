import { canManageModuleUsers, isModuleAdmin } from "@/lib/module-access";

/** CRM module admin (org ERP admin or assigned CRM module admin). */
export function isCrmModuleAdmin(
  adminModuleKeys: string[],
  userType?: string | null,
): boolean {
  return canManageModuleUsers("crm", adminModuleKeys, userType ?? undefined);
}

/** CRM delete is reserved for module admins (not regular CRM members). */
export function canDeleteCrmRecords(
  adminModuleKeys: string[],
  userType?: string | null,
): boolean {
  return isModuleAdmin(userType ?? undefined) || adminModuleKeys.includes("crm");
}
