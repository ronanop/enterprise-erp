/** Normalized signed-in user from GET /auth/me. */

export type AuthSessionUser = {
  id: string;
  email: string;
  displayName: string;
  userType?: string;
  employeeId?: string;
};

export function parseAuthMe(data: unknown): {
  user: AuthSessionUser | null;
  permissions: string[];
  moduleKeys: string[];
  adminModuleKeys: string[];
  projectModuleAdmin: boolean;
} {
  if (!data || typeof data !== "object") {
    return {
      user: null,
      permissions: [],
      moduleKeys: [],
      adminModuleKeys: [],
      projectModuleAdmin: false,
    };
  }
  const record = data as Record<string, unknown>;

  const permissions = Array.isArray(record.permissions)
    ? (record.permissions as string[])
    : [];
  const moduleKeys = Array.isArray(record.module_keys)
    ? (record.module_keys as string[])
    : Array.isArray(record.moduleKeys)
      ? (record.moduleKeys as string[])
      : [];
  const adminModuleKeys = Array.isArray(record.admin_module_keys)
    ? (record.admin_module_keys as string[])
    : Array.isArray(record.adminModuleKeys)
      ? (record.adminModuleKeys as string[])
      : [];
  const projectModuleAdmin = Boolean(record.project_module_admin);

  if (record.user && typeof record.user === "object") {
    const u = record.user as Record<string, unknown>;
    return {
      user: {
        id: String(u.id ?? ""),
        email: String(u.email ?? ""),
        displayName: String(u.display_name ?? u.email ?? "User"),
        userType: u.user_type ? String(u.user_type) : undefined,
        employeeId: u.employee_id ? String(u.employee_id) : undefined,
      },
      permissions,
      moduleKeys,
      adminModuleKeys,
      projectModuleAdmin,
    };
  }

  if (typeof record.id === "string" && typeof record.email === "string") {
    return {
      user: {
        id: record.id,
        email: record.email,
        displayName: String(record.display_name ?? record.full_name ?? record.email),
        userType: record.user_type ? String(record.user_type) : undefined,
        employeeId: record.employee_id ? String(record.employee_id) : undefined,
      },
      permissions,
      moduleKeys,
      adminModuleKeys,
      projectModuleAdmin,
    };
  }

  return {
    user: null,
    permissions: [],
    moduleKeys: [],
    adminModuleKeys: [],
    projectModuleAdmin: false,
  };
}

export function userInitials(displayName: string): string {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]?.[0] ?? ""}${parts[parts.length - 1]?.[0] ?? ""}`.toUpperCase();
  }
  const compact = displayName.replace(/[^a-zA-Z0-9]/g, "");
  return (compact.slice(0, 2) || "U").toUpperCase();
}

export function shortUserId(id: string): string {
  if (!id) return "—";
  if (id.length <= 12) return id;
  return `${id.slice(0, 8)}…`;
}
