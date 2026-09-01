"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { marketingTeamLoginAccounts } from "@/config/module-logins";
import { authService } from "@/services/api-client";
import type { UserProfile } from "@/types/api";

export type CurrentUserProfile = {
  id: string | null;
  email: string;
  displayName: string;
  designation: string | null;
  roleName: string | null;
  roleNames: string[];
  roleCodes: string[];
  userType: string | null;
  permissions: string[];
  initials: string;
};

type MeResponse = {
  user?: {
    id?: string;
    email?: string;
    display_name?: string;
    user_type?: string;
  };
  permissions?: string[];
  designation?: string | null;
  role_name?: string | null;
  role_names?: string[];
  role_codes?: string[];
};

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function demoRoleForEmail(email: string): string | null {
  const match = marketingTeamLoginAccounts.find((a) => a.email.toLowerCase() === email.toLowerCase());
  return match?.role ?? null;
}

function normalizeProfile(data: MeResponse | UserProfile | null): CurrentUserProfile | null {
  if (!data) return null;
  const nested = "user" in data && data.user ? data.user : data;
  const email = String(nested.email ?? (data as UserProfile).email ?? "");
  const displayName = String(
    nested.display_name ?? (data as UserProfile).display_name ?? (data as UserProfile).full_name ?? email,
  );
  const designation =
    ("designation" in data ? data.designation : null) ??
    demoRoleForEmail(email);
  const roleName =
    ("role_name" in data ? data.role_name : null) ??
    ("role_names" in data && data.role_names?.length ? data.role_names[0] : null) ??
    demoRoleForEmail(email);
  const roleNames = ("role_names" in data ? data.role_names : []) ?? [];
  const roleCodes = ("role_codes" in data ? data.role_codes : []) ?? [];
  const permissions = ("permissions" in data ? data.permissions : (data as UserProfile).permissions) ?? [];
  return {
    id: nested.id ? String(nested.id) : null,
    email,
    displayName,
    designation: designation ? String(designation) : null,
    roleName: roleName ? String(roleName) : null,
    roleNames: roleNames.map(String),
    roleCodes: roleCodes.map(String),
    userType: nested.user_type ? String(nested.user_type) : null,
    permissions,
    initials: initialsFromName(displayName),
  };
}

export function useUserPermissions() {
  const [raw, setRaw] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await authService.me();
        if (!cancelled) setRaw((res.data as MeResponse) ?? null);
      } catch {
        if (!cancelled) setRaw(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const profile = useMemo(() => normalizeProfile(raw), [raw]);

  const can = useCallback(
    (permission: string) => {
      const perms = profile?.permissions;
      if (!perms || perms.length === 0) {
        return true;
      }
      return perms.includes(permission) || perms.includes("*");
    },
    [profile],
  );

  return {
    user: raw,
    profile,
    loading,
    can,
  };
}
