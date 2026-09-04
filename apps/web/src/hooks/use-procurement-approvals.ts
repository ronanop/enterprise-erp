"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  PROCUREMENT_APPROVALS_EVENT,
  readPoApprovals,
  setPoApprovalStatus,
  submitCreatePoInStockApproval,
  submitPoFinalizeApproval,
  type PoApprovalRequest,
  type PoApprovalStatus,
} from "@/lib/procurement-approvals";
import { pushPoApprovalDecisionNotification } from "@/lib/procurement-approval-notifications";

export function useProcurementApprovals() {
  const [rows, setRows] = useState<PoApprovalRequest[]>([]);

  const refresh = useCallback(() => {
    setRows(readPoApprovals());
  }, []);

  useEffect(() => {
    refresh();
    window.addEventListener(PROCUREMENT_APPROVALS_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(PROCUREMENT_APPROVALS_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [refresh]);

  const pending = useMemo(
    () => rows.filter((row) => row.status === "pending"),
    [rows],
  );

  const submitFinalizeRequest = useCallback(
    (input: Parameters<typeof submitPoFinalizeApproval>[0]) => {
      const row = submitPoFinalizeApproval(input);
      refresh();
      return row;
    },
    [refresh],
  );

  const submitCreatePoInStockRequest = useCallback(
    (input: Parameters<typeof submitCreatePoInStockApproval>[0]) => {
      const row = submitCreatePoInStockApproval(input);
      refresh();
      return row;
    },
    [refresh],
  );

  const decide = useCallback(
    (id: string, status: Exclude<PoApprovalStatus, "pending">) => {
      const row = setPoApprovalStatus(id, status);
      if (row) {
        pushPoApprovalDecisionNotification({
          approvalId: row.id,
          orderId: row.orderId,
          companyPoNumber: row.companyPoNumber,
          documentNumber: row.documentNumber,
          decision: status,
          kind: row.kind,
        });
      }
      refresh();
      return row;
    },
    [refresh],
  );

  return {
    rows,
    pending,
    pendingCount: pending.length,
    submitFinalizeRequest,
    submitCreatePoInStockRequest,
    decide,
    refresh,
  };
}
