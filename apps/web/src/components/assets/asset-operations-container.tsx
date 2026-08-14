"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { fetchAssetOperationsData } from "@/components/assets/asset-operations-fetch";
import { AssetOperationsDashboard } from "@/components/assets/asset-operations-dashboard";
import {
  branchLookupFromOptions,
  mapDashboardPayloadToViewModel,
  type AssetOperationsKpiModel,
  type AssetOperationsKpiTrends,
  type AssetOperationsQueueTotals,
  type BranchBreakdownRow,
} from "@/components/assets/dashboard.mapper";
import { BRANCH_ALL_VALUE, type BranchOption, type QueueCardRow } from "@/components/assets/shared";
import { listBranchOptions } from "@/lib/org-options";
import type { AssetDashboardSummaryDto } from "@/services/assets-service";

const EMPTY_SUMMARY: AssetDashboardSummaryDto = {
  company_id: "",
  total_assets: 0,
  ready_to_move: 0,
  assigned: 0,
  retired: 0,
  pending_disposal: 0,
  disposed: 0,
};

const EMPTY_LIST = { items: [], total: 0, page: 1, page_size: 10 };

export function AssetOperationsContainer() {
  const [branchId, setBranchId] = useState(BRANCH_ALL_VALUE);
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [kpis, setKpis] = useState<AssetOperationsKpiModel | null>(null);
  const [kpiTrends, setKpiTrends] = useState<AssetOperationsKpiTrends | null>(null);
  const [queueTotals, setQueueTotals] = useState<AssetOperationsQueueTotals | null>(null);
  const [byBranchRows, setByBranchRows] = useState<BranchBreakdownRow[]>([]);
  const [readyQueueRows, setReadyQueueRows] = useState<QueueCardRow[]>([]);
  const [disposalQueueRows, setDisposalQueueRows] = useState<QueueCardRow[]>([]);
  const [assignmentRows, setAssignmentRows] = useState<QueueCardRow[]>([]);
  const [kpisLoading, setKpisLoading] = useState(true);
  const [queuesLoading, setQueuesLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [queueErrors, setQueueErrors] = useState<{
    ready?: string;
    disposal?: string;
    assignments?: string;
  }>({});
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void listBranchOptions()
      .then((options) => {
        if (!cancelled) {
          setBranches(options.map((o) => ({ id: o.id, label: o.label })));
        }
      })
      .catch(() => {
        if (!cancelled) setBranches([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const branchLookup = useMemo(() => branchLookupFromOptions(branches), [branches]);

  const load = useCallback(async () => {
    setKpisLoading(true);
    setQueuesLoading(true);
    setErrorMessage(null);
    setQueueErrors({});

    const result = await fetchAssetOperationsData(branchId);

    setQueueErrors({
      ready: result.errors.ready,
      disposal: result.errors.disposal,
      assignments: result.errors.assignments,
    });

    const nothingLoaded =
      !result.summary &&
      !result.readyList &&
      !result.disposalList &&
      !result.assignmentsList;

    if (nothingLoaded) {
      const messages = Object.values(result.errors).filter(Boolean);
      setErrorMessage(messages[0] ?? "Something went wrong. Please try again.");
      setKpis(null);
      setKpiTrends(null);
      setQueueTotals(null);
      setByBranchRows([]);
      setReadyQueueRows([]);
      setDisposalQueueRows([]);
      setAssignmentRows([]);
      setKpisLoading(false);
      setQueuesLoading(false);
      return;
    }

    if (result.errors.summary) {
      setErrorMessage(result.errors.summary);
      setKpis(null);
      setKpiTrends(null);
      setByBranchRows([]);
    } else {
      setErrorMessage(null);
    }

    const view = mapDashboardPayloadToViewModel({
      summary: result.summary ?? EMPTY_SUMMARY,
      readyList: result.readyList ?? EMPTY_LIST,
      disposalList: result.disposalList ?? EMPTY_LIST,
      assignmentsList: result.assignmentsList ?? EMPTY_LIST,
      branchLookup,
    });

    setKpis(result.summary ? view.kpis : null);
    setKpiTrends(result.summary ? view.kpiTrends : null);
    setByBranchRows(result.summary ? view.byBranch : []);
    setQueueTotals({
      ready: result.readyList ? view.queueTotals.ready : 0,
      disposal: result.disposalList ? view.queueTotals.disposal : 0,
      assignments: result.assignmentsList ? view.queueTotals.assignments : 0,
    });
    setReadyQueueRows(result.readyList ? view.queues.readyRows : []);
    setDisposalQueueRows(result.disposalList ? view.queues.disposalRows : []);
    setAssignmentRows(result.assignmentsList ? view.queues.assignmentRows : []);

    setKpisLoading(false);
    setQueuesLoading(false);
  }, [branchId, branchLookup]);

  useEffect(() => {
    void load();
  }, [load, reloadToken]);

  const onRetry = useCallback(() => {
    setReloadToken((t) => t + 1);
  }, []);

  return (
    <AssetOperationsDashboard
      branchId={branchId}
      branches={branches}
      onBranchChange={setBranchId}
      kpisLoading={kpisLoading}
      queuesLoading={queuesLoading}
      kpis={kpis}
      kpiTrends={kpiTrends}
      queueTotals={queueTotals}
      byBranchRows={byBranchRows}
      readyQueueRows={readyQueueRows}
      disposalQueueRows={disposalQueueRows}
      assignmentRows={assignmentRows}
      errorMessage={errorMessage}
      onRetry={onRetry}
      queueErrors={queueErrors}
    />
  );
}
