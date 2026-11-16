import { hasServiceEngineerRole } from "@/lib/service-engineer-access";
import {
  hasServiceFieldEngineerRole,
  isServiceFieldEngineerOnly,
} from "@/lib/service-field-engineer-access";

export type ServiceLoginRoleInput = {
  email?: string | null;
  designation?: string | null;
  roleName?: string | null;
  roleNames?: string[] | null;
  roleCodes?: string[] | null;
  permissions?: string[] | null;
};

/** Friendly workspace label for the signed-in service user. */
export function resolveServiceLoginRoleLabel(input: ServiceLoginRoleInput): string {
  const codes = new Set((input.roleCodes ?? []).map((c) => c.trim().toUpperCase()));
  const names = [input.roleName, ...(input.roleNames ?? []), input.designation]
    .filter(Boolean)
    .map((n) => String(n).trim().toLowerCase());
  const email = (input.email ?? "").trim().toLowerCase();
  const perms = input.permissions ?? [];

  if (isServiceFieldEngineerOnly(input.roleCodes, input.permissions, input.roleNames)) {
    return "Service Field Engineer";
  }

  if (codes.has("SERVICE_ADMIN") || names.some((n) => n === "service admin")) {
    return "Service Admin";
  }

  if (
    codes.has("SERVICE_COORDINATOR") ||
    names.some((n) => n === "service head" || n === "service coordinator") ||
    email.startsWith("service.head@")
  ) {
    return "Service Head";
  }

  if (codes.has("SERVICE_MANAGER") || names.some((n) => n === "service manager")) {
    return "Service Manager";
  }

  if (codes.has("SERVICE_STAKEHOLDER") || names.some((n) => n.includes("stakeholder"))) {
    return "Service Stakeholder";
  }

  if (
    hasServiceFieldEngineerRole(input.roleCodes, input.roleNames) ||
    names.some((n) => n.includes("field engineer"))
  ) {
    return "Service Field Engineer";
  }

  if (hasServiceEngineerRole(input.roleCodes) || names.some((n) => n.includes("service engineer"))) {
    return "Service Engineer";
  }

  if (perms.includes("service.request:approve")) {
    return "Service Head";
  }

  if (input.designation?.trim()) {
    return input.designation.trim();
  }

  if (input.roleName?.trim()) {
    return input.roleName.trim();
  }

  const firstRole = (input.roleNames ?? []).find((n) => n.trim());
  if (firstRole) {
    return firstRole.trim();
  }

  return "Service User";
}
