"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { AssetInventoryContainer } from "@/components/assets/asset-inventory-container";
import { fetchAssetOperationsData } from "@/components/assets/asset-operations-fetch";
import { AssetOperationsDashboard } from "@/components/assets/asset-operations-dashboard";
import {
  branchLookupFromOptions,
  mapDashboardPayloadToViewModel,
  mapOperationsPayloadToRecentActivity,
  type AssetOperationsKpiModel,
  type RecentActivityItem,
} from "@/components/assets/dashboard.mapper";
import {
  buildPendingActionItems,
  type PendingActionItem,
} from "@/components/assets/operations-pending-actions";
import { useAssetNavigation } from "@/components/assets/navigation/use-asset-navigation";
import { BRANCH_ALL_VALUE, type BranchOption, type QueueCardRow } from "@/components/assets/shared";
import {
  DEMO_ASSET_BRANCHES,
  DEMO_ASSET_DASHBOARD_SUMMARY,
} from "@/components/assets/demo-asset-master";
import { listDemoRegisteredAssets } from "@/components/assets/demo-registered-assets";
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

/**
 * Asset Operations Workspace (CR-005 Phase 1–4).
 * Unified branch drives KPIs, register, drawer scope, and recent activity.
 */
export function AssetOperationsContainer() {
  const navigation = useAssetNavigation();
  const [branchId, setBranchId] = useState(BRANCH_ALL_VALUE);
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [kpis, setKpis] = useState<AssetOperationsKpiModel | null>(null);
  const [recentActivity, setRecentActivity] = useState<RecentActivityItem[]>([]);
  const [readyRows, setReadyRows] = useState<QueueCardRow[]>([]);
  const [disposalRows, setDisposalRows] = useState<QueueCardRow[]>([]);
  const [kpisLoading, setKpisLoading] = useState(true);
  const [activityLoading, setActivityLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [searchDraft, setSearchDraft] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const exportHandlerRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    let cancelled = false;
    void listBranchOptions()
      .then((options) => {
        if (!cancelled) {
          const mapped = options.map((o) => ({ id: o.id, label: o.label }));
          setBranches(
            mapped.length > 0
              ? mapped
              : DEMO_ASSET_BRANCHES.map((o) => ({ id: o.id, label: o.label })),
          );
        }
      })
      .catch(() => {
        if (!cancelled) {
          setBranches(DEMO_ASSET_BRANCHES.map((o) => ({ id: o.id, label: o.label })));
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const branchLookup = useMemo(() => branchLookupFromOptions(branches), [branches]);

  const load = useCallback(async () => {
    setKpisLoading(true);
    setActivityLoading(true);
    setErrorMessage(null);

    const result = await fetchAssetOperationsData(branchId);

    if (!result.summary) {
      // Keep dashboard panels usable for demos when APIs require auth.
      const view = mapDashboardPayloadToViewModel({
        summary: DEMO_ASSET_DASHBOARD_SUMMARY,
        readyList: EMPTY_LIST,
        disposalList: EMPTY_LIST,
        assignmentsList: EMPTY_LIST,
        branchLookup,
      });
      const demoReady = listDemoRegisteredAssets()
        .filter((a) => String(a.operational_status).toUpperCase() === "READY_TO_MOVE")
        .map((a) => ({
          id: a.id,
          cells: [a.asset_code, a.asset_name, a.branch_label],
        }));
      const demoAssigned = listDemoRegisteredAssets()
        .filter((a) => String(a.operational_status).toUpperCase() === "ASSIGNED")
        .slice(0, 3);
      setKpis(view.kpis);
      setReadyRows(
        demoReady.length
          ? demoReady
          : [
              { id: "demo-ready-1", cells: ["AST-LAP-DEMO-02", "Lenovo ThinkPad — Demo", "Head Office"] },
              { id: "demo-ready-2", cells: ["AST-LAP-DEMO-03", "HP EliteBook — Demo", "Head Office"] },
            ],
      );
      setDisposalRows([
        { id: "demo-disp-1", cells: ["AST-OLD-001", "Legacy Monitor", "Head Office"] },
      ]);
      setRecentActivity([
        {
          id: "demo-act-1",
          kind: "registered",
          label: "Asset Registered",
          asset: "AST-LAP-001",
          employee: "—",
          date: "Demo",
          status: "active",
        },
        {
          id: "demo-act-2",
          kind: "assigned",
          label: "Asset Assigned",
          asset: demoAssigned[0]?.asset_code ?? "AST-PROJ-001",
          employee: demoAssigned[0]?.current_holder ?? "Demo User",
          date: "Demo",
          status: "active",
        },
        {
          id: "demo-act-3",
          kind: "registered",
          label: "Asset Registered",
          asset: "AST-VEH-001",
          employee: "—",
          date: "Demo",
          status: "READY_TO_MOVE",
        },
      ]);
      setErrorMessage(
        result.errors.summary
          ? `${result.errors.summary} Showing demo dashboard data.`
          : "Showing demo dashboard data. Sign in for live KPIs.",
      );
      setKpisLoading(false);
      setActivityLoading(false);
      return;
    }

    const view = mapDashboardPayloadToViewModel({
      summary: result.summary ?? EMPTY_SUMMARY,
      readyList: result.readyList ?? EMPTY_LIST,
      disposalList: result.disposalList ?? EMPTY_LIST,
      assignmentsList: result.assignmentsList ?? EMPTY_LIST,
      branchLookup,
    });

    setKpis(view.kpis);
    setReadyRows(view.readyRows);
    setDisposalRows(view.disposalRows);
    setRecentActivity(
      mapOperationsPayloadToRecentActivity({
        recentAssets: result.recentAssets,
        assignmentsList: result.assignmentsList,
        disposalList: result.disposalList,
        transferList: result.transferList,
        limit: 10,
      }),
    );
    setErrorMessage(null);
    setKpisLoading(false);
    setActivityLoading(false);
  }, [branchId, branchLookup]);

  useEffect(() => {
    void load();
  }, [load, reloadToken]);

  const onRefresh = useCallback(() => {
    setReloadToken((t) => t + 1);
  }, []);

  const onRegisterExport = useCallback((runExport: () => void) => {
    exportHandlerRef.current = runExport;
  }, []);

  const onSearchSubmit = useCallback(() => {
    setAppliedSearch(searchDraft.trim());
  }, [searchDraft]);

  const pendingActions: PendingActionItem[] = useMemo(
    () =>
      buildPendingActionItems({
        readyRows,
        disposalRows,
        assignedCount: kpis?.assigned ?? 0,
        onAllocate: (assetId) =>
          assetId ? navigation.openAssignment(assetId) : navigation.openAssignmentWizard(),
        onReturn: () => navigation.openReturnWizard(),
        onDisposal: (assetId) =>
          assetId ? navigation.openDetails(assetId) : navigation.openInventory(),
        onMaintenance: () => navigation.openMaintenanceList(),
        limit: 5,
      }),
    [disposalRows, kpis?.assigned, navigation, readyRows],
  );

  return (
    <AssetOperationsDashboard
      branchId={branchId}
      branches={branches}
      onBranchChange={setBranchId}
      searchValue={searchDraft}
      onSearchChange={setSearchDraft}
      onSearchSubmit={onSearchSubmit}
      kpisLoading={kpisLoading}
      activityLoading={activityLoading}
      pendingLoading={kpisLoading}
      queuesLoading={kpisLoading}
      kpis={kpis}
      recentActivity={recentActivity}
      pendingActions={pendingActions}
      readyRows={readyRows}
      disposalRows={disposalRows}
      errorMessage={errorMessage}
      onRefresh={onRefresh}
      onAddAsset={() => navigation.openRegisterNew()}
      onAllocate={() => navigation.openAssignmentWizard()}
      onReturn={() => navigation.openReturnWizard()}
      onImport={() => navigation.openInventoryImport()}
      onExport={() => exportHandlerRef.current?.()}
      onReadyQueueOpen={(assetId) =>
        assetId ? navigation.openAssignment(assetId) : navigation.openAssignmentWizard()
      }
      onDisposalQueueOpen={(assetId) =>
        assetId ? navigation.openDetails(assetId) : navigation.openInventory()
      }
      register={
        <AssetInventoryContainer
          branchId={branchId}
          onBranchChange={setBranchId}
          embedded
          hideQuickSearch
          forcedSearch={appliedSearch}
          onRegisterExport={onRegisterExport}
          onAddAssetEmpty={() => navigation.openRegisterNew()}
        />
      }
    />
  );
}
