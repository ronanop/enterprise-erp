"use client";

import { useEffect, useState } from "react";

import { parseAuthMe, type AuthSessionUser } from "@/lib/auth-user";
import { isAuthenticated } from "@/lib/auth";
import { authService } from "@/services/api-client";

export function useAuthUser() {
  const [user, setUser] = useState<AuthSessionUser | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [moduleKeys, setModuleKeys] = useState<string[]>([]);
  const [adminModuleKeys, setAdminModuleKeys] = useState<string[]>([]);
  const [projectModuleAdmin, setProjectModuleAdmin] = useState(false);
  const [hrModuleAdmin, setHrModuleAdmin] = useState(false);
  const [assetsModuleAdmin, setAssetsModuleAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated()) {
      setUser(null);
      setPermissions([]);
      setModuleKeys([]);
      setAdminModuleKeys([]);
      setProjectModuleAdmin(false);
      setHrModuleAdmin(false);
      setAssetsModuleAdmin(false);
      setLoading(false);
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const res = await authService.me();
        const parsed = parseAuthMe(res.data);
        if (!cancelled) {
          setUser(parsed.user);
          setPermissions(parsed.permissions);
          setModuleKeys(parsed.moduleKeys);
          setAdminModuleKeys(parsed.adminModuleKeys);
          setProjectModuleAdmin(parsed.projectModuleAdmin);
          setHrModuleAdmin(parsed.hrModuleAdmin);
          setAssetsModuleAdmin(parsed.assetsModuleAdmin);
        }
      } catch {
        if (!cancelled) {
          setUser(null);
          setPermissions([]);
          setModuleKeys([]);
          setAdminModuleKeys([]);
          setProjectModuleAdmin(false);
          setHrModuleAdmin(false);
          setAssetsModuleAdmin(false);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return {
    user,
    permissions,
    moduleKeys,
    adminModuleKeys,
    projectModuleAdmin,
    hrModuleAdmin,
    assetsModuleAdmin,
    loading,
    signedIn: Boolean(user),
  };
}
