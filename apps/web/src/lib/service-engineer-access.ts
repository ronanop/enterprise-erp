/** Role code for helpdesk / service engineers assigned to tickets. */
export const SERVICE_ENGINEER_ROLE = "SERVICE_ENGINEER";

export function hasServiceEngineerRole(roleCodes: string[] | undefined | null): boolean {
  return (roleCodes ?? []).includes(SERVICE_ENGINEER_ROLE);
}

/**
 * Service engineers see only their own assigned/co-owned tickets.
 * Managers and coordinators (with approve permission) keep the full team view.
 */
export function shouldScopeServiceToMine(
  roleCodes: string[] | undefined | null,
  permissions: string[] | undefined | null,
): boolean {
  if (!hasServiceEngineerRole(roleCodes)) {
    return false;
  }
  return !(permissions ?? []).includes("service.request:approve");
}
