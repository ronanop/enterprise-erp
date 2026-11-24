/** Role code assigned when a user is provisioned as a ticket field engineer. */
export const SERVICE_FIELD_ENGINEER_ROLE = "SERVICE_FIELD_ENGINEER";

/** Human-readable role name stored in sec_role.role_name. */
export const SERVICE_FIELD_ENGINEER_ROLE_NAME = "Service Field Engineer";

export function hasServiceFieldEngineerRole(
  roleCodes: string[] | undefined | null,
  roleNames?: string[] | undefined | null,
): boolean {
  if ((roleCodes ?? []).includes(SERVICE_FIELD_ENGINEER_ROLE)) {
    return true;
  }
  return (roleNames ?? []).some(
    (name) => name.trim().toLowerCase() === SERVICE_FIELD_ENGINEER_ROLE_NAME.toLowerCase(),
  );
}

/** Field-engineer login with no service-engineer update rights — FE dashboard only. */
export function isServiceFieldEngineerOnly(
  roleCodes: string[] | undefined | null,
  permissions: string[] | undefined | null,
  roleNames?: string[] | undefined | null,
): boolean {
  if (!hasServiceFieldEngineerRole(roleCodes, roleNames)) {
    return false;
  }
  const perms = permissions ?? [];
  return !perms.includes("service.request:update");
}

export const FIELD_ENGINEER_HOME = "/service/field-engineer";
