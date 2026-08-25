"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  PROCUREMENT_APPROVALS_EVENT,
  listPendingPoApprovals,
  readPoApprovals,
  setPoApprovalStatus,
  type PoApprovalRequest,
  type PoApprovalStatus,
} from "@/lib/procurement-approvals";

/** Local-storage PO finalize approvals for the procurement workspace. */
export function useProcurementApprovals() {
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => {
    setTick((n) => n + 1);
  }, []);

  useEffect(() => {
    const onChange = () => refresh();
    window.addEventListener(PROCUREMENT_APPROVALS_EVENT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(PROCUREMENT_APPROVALS_EVENT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, [refresh]);

  const rows = useMemo(() => {
    void tick;
    return readPoApprovals();
  }, [tick]);

  const pending = useMemo(() => {
    void tick;
    return listPendingPoApprovals();
  }, [tick]);

  const decide = useCallback(
    (id: string, status: Exclude<PoApprovalStatus, "pending">) => {
      setPoApprovalStatus(id, status);
      refresh();
    },
    [refresh],
  );

  return {
    rows,
    pending,
    pendingCount: pending.length,
    decide,
    refresh,
  };
}

export type { PoApprovalRequest };
