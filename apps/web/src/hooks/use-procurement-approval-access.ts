"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { useProcurementRole } from "@/hooks/use-procurement-role";
import {
  getProcApprovalCapabilities,
  type ProcApprovalCapabilities,
  type ScmApprovalStage,
} from "@/services/procurement-service";

const STAGE_TO_STEP: Record<ScmApprovalStage, string> = {
  accept_po: "accept_po",
  management: "management_po",
};

export function useProcurementApprovalAccess() {
  const { isAdmin, ready: roleReady } = useProcurementRole();
  const [caps, setCaps] = useState<ProcApprovalCapabilities | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const next = await getProcApprovalCapabilities();
      setCaps(next);
    } catch {
      setCaps({
        is_module_admin: isAdmin,
        steps: isAdmin ? ["accept_po", "management_po"] : [],
        can_decide_approvals: isAdmin,
      });
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    if (!roleReady) return;
    void refresh();
  }, [roleReady, refresh]);

  const steps = useMemo(() => new Set(caps?.steps ?? []), [caps]);
  const canDecideApprovals = Boolean(caps?.can_decide_approvals || isAdmin);
  const canDecideAcceptPo = isAdmin || steps.has("accept_po");
  const canDecideManagement = isAdmin || steps.has("management_po");
  const canDecideHold = steps.has("hold_decision");
  const canDecideFreight = steps.has("freight_finance");

  function canDecideStage(stage: ScmApprovalStage | null | undefined): boolean {
    if (isAdmin) return true;
    if (!stage) return canDecideAcceptPo;
    const step = STAGE_TO_STEP[stage];
    return step ? steps.has(step) : false;
  }

  return {
    ready: roleReady && !loading,
    loading,
    isAdmin,
    canDecideApprovals,
    canDecideAcceptPo,
    canDecideManagement,
    canDecideHold,
    canDecideFreight,
    canDecideStage,
    refresh,
  };
}
