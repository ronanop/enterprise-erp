"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "erp.procurement.role";

export type ProcurementWorkspaceRole = "admin" | "user";

function readRole(): ProcurementWorkspaceRole {
  if (typeof window === "undefined") return "user";
  return window.localStorage.getItem(STORAGE_KEY) === "admin" ? "admin" : "user";
}

/** Demo toggle between SCM user and admin workspace. */
export function useProcurementRole() {
  const [role, setRole] = useState<ProcurementWorkspaceRole>("user");

  useEffect(() => {
    setRole(readRole());
  }, []);

  const switchRole = useCallback(() => {
    setRole((current) => {
      const next: ProcurementWorkspaceRole = current === "admin" ? "user" : "admin";
      window.localStorage.setItem(STORAGE_KEY, next);
      return next;
    });
  }, []);

  return { role, isAdmin: role === "admin", switchRole };
}
