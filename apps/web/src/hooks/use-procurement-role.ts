"use client";

import { useMemo } from "react";

import { useAuthUser } from "@/hooks/use-auth-user";
import { canManageModuleUsers } from "@/lib/module-access";
import type { ProcurementRole } from "@/lib/procurement-role";

/**
 * Procurement admin is the ERP-assigned module admin for `procurement`
 * (Organization → module users), not a local Switch to Admin toggle.
 */
export function useProcurementRole() {
  const { user, adminModuleKeys, loading } = useAuthUser();

  const isAdmin = useMemo(
    () => canManageModuleUsers("procurement", adminModuleKeys, user?.userType),
    [adminModuleKeys, user?.userType],
  );

  const role: ProcurementRole = isAdmin ? "admin" : "user";
  const ready = !loading;

  return {
    role,
    ready,
    isAdmin,
    /** @deprecated Local role override removed — ERP module admin assignment is the source of truth. */
    setProcurementRole: (_next: ProcurementRole) => {},
    /** @deprecated Local role toggle removed — use Organization module admin assignment. */
    switchRole: () => role,
  };
}
