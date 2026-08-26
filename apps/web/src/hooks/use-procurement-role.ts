"use client";

import { useCallback, useEffect, useState } from "react";

import {
  PROCUREMENT_ROLE_EVENT,
  readProcurementRole,
  toggleProcurementRole,
  writeProcurementRole,
  type ProcurementRole,
} from "@/lib/procurement-role";

export function useProcurementRole() {
  const [role, setRole] = useState<ProcurementRole>("user");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const sync = () => setRole(readProcurementRole());
    sync();
    setReady(true);
    window.addEventListener(PROCUREMENT_ROLE_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(PROCUREMENT_ROLE_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const setProcurementRole = useCallback((next: ProcurementRole) => {
    writeProcurementRole(next);
  }, []);

  const switchRole = useCallback(() => toggleProcurementRole(), []);

  return { role, ready, isAdmin: role === "admin", setProcurementRole, switchRole };
}
