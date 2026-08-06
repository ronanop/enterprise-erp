"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { AssetInventoryWorkspace } from "@/components/assets/asset-inventory-workspace";
import {
  mapInventoryRowToDrawerData,
} from "@/components/assets/inventory/interaction/inventory-drawer.mapper";
import type { InventoryMenuActionId } from "@/components/assets/inventory/interaction/inventory-interaction.types";
import type { InventoryQuickLinkId } from "@/components/assets/inventory/interaction/inventory-interaction.types";
import type { AssetDetailDrawerData } from "@/components/assets/inventory/interaction/inventory-interaction.types";
import { dispatchInventoryQuickLink } from "@/components/assets/navigation/asset-navigation";
import {
  buildInventoryActionPermissions,
  buildInventoryQuickLinkPermissions,
} from "@/components/assets/navigation/inventory-permissions";
import { useAssetNavigation } from "@/components/assets/navigation/use-asset-navigation";
import { consumeInventoryStale } from "@/components/assets/inventory/inventory-refresh";
import {
  clearInventoryUiSnapshot,
  peekInventoryUiSnapshot,
  saveInventoryUiSnapshot,
  type InventoryUiSnapshot,
} from "@/components/assets/inventory/inventory-ui-state";
import { handleInventoryMenuWorkflow } from "@/components/assets/inventory/inventory-workflow";
import {
  exportInventoryRegister,
  InventoryExportError,
  type InventoryExportFormat,
} from "@/components/assets/inventory/export";
import { useUserPermissions } from "@/hooks/use-user-permissions";
import type { InventoryRowViewModel } from "@/components/assets/inventory.mapper";
import {
  applyClientInventoryFilters,
  branchLookupFromOrgOptions,
  buildInventoryListQuery,
  groupAssignmentsByAssetId,
  indexActiveAssignments,
  mapAssetsToInventoryRows,
} from "@/components/assets/inventory.mapper";
import type { InventoryPresetId } from "@/components/assets/inventory.types";
import { PRESET_OPERATIONAL_STATUS } from "@/components/assets/inventory.types";
import {
  BRANCH_ALL_VALUE,
  EMPTY_INVENTORY_FILTERS,
  type InventoryFilterValues,
} from "@/components/assets/shared";
import { listBranchOptions, listDepartmentOptions, listEmployeeOptions } from "@/lib/org-options";
import {
  assetCategoryService,
  assetOperationsService,
  filterActiveCategories,
} from "@/services/assets-service";
import { ApiClientError } from "@/services/api-client";

const PAGE_SIZE = 25;

const DEFAULT_UI_SNAPSHOT: InventoryUiSnapshot = {
  preset: "all",
  headerBranchId: BRANCH_ALL_VALUE,
  draftFilters: EMPTY_INVENTORY_FILTERS,
  appliedFilters: EMPTY_INVENTORY_FILTERS,
  quickSearch: "",
  page: 1,
};

function readInventoryUiOnMount(): InventoryUiSnapshot {
  if (typeof window === "undefined") return DEFAULT_UI_SNAPSHOT;
  return peekInventoryUiSnapshot() ?? DEFAULT_UI_SNAPSHOT;
}

export async function fetchInventoryPage(input: {
  preset: InventoryPresetId;
  filters: InventoryFilterValues;
  headerBranchId: string;
  page: number;
  deps?: {
    listAssets?: typeof assetOperationsService.listAssets;
    listAssignments?: typeof assetOperationsService.listAssignments;
  };
}) {
  const listAssets = input.deps?.listAssets ?? assetOperationsService.listAssets.bind(assetOperationsService);
  const listAssignments =
    input.deps?.listAssignments ?? assetOperationsService.listAssignments.bind(assetOperationsService);

  const query = buildInventoryListQuery({
    preset: input.preset,
    filters: input.filters,
    headerBranchId: input.headerBranchId,
    page: input.page,
    pageSize: PAGE_SIZE,
  });

  const branch_id = query.branch_id;

  const [assetList, assignmentList] = await Promise.all([
    listAssets(query),
    listAssignments({ page: 1, page_size: 500, branch_id }),
  ]);

  return { assetList, assignmentList };
}

export function AssetInventoryContainer() {
  const navigation = useAssetNavigation();
  const { can } = useUserPermissions();
  const actionPermissions = useMemo(() => buildInventoryActionPermissions(can), [can]);
  const quickLinkPermissions = useMemo(() => buildInventoryQuickLinkPermissions(can), [can]);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerRow, setDrawerRow] = useState<InventoryRowViewModel | null>(null);
  const [drawerData, setDrawerData] = useState<AssetDetailDrawerData | null>(null);

  const initialUiRef = useRef(readInventoryUiOnMount());
  const initialUi = initialUiRef.current;
  const [preset, setPreset] = useState<InventoryPresetId>(initialUi.preset);
  const [headerBranchId, setHeaderBranchId] = useState(initialUi.headerBranchId);
  const [draftFilters, setDraftFilters] = useState<InventoryFilterValues>(initialUi.draftFilters);
  const [appliedFilters, setAppliedFilters] = useState<InventoryFilterValues>(initialUi.appliedFilters);
  const [quickSearch, setQuickSearch] = useState(initialUi.quickSearch);
  const [page, setPage] = useState(initialUi.page);
  const [rows, setRows] = useState<ReturnType<typeof mapAssetsToInventoryRows>>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [expandedRowIds, setExpandedRowIds] = useState<Set<string>>(new Set());
  const [reloadToken, setReloadToken] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportSuccess, setExportSuccess] = useState<string | null>(null);

  const [branches, setBranches] = useState<Array<{ id: string; label: string }>>([]);
  const [departments, setDepartments] = useState<Array<{ id: string; label: string }>>([]);
  const [categories, setCategories] = useState<Array<{ id: string; category_name: string }>>([]);
  const [employeeLabels, setEmployeeLabels] = useState<Record<string, string>>({});

  useEffect(() => {
    void (async () => {
      const [branchOpts, deptOpts, empOpts, catRes] = await Promise.all([
        listBranchOptions().catch(() => []),
        listDepartmentOptions().catch(() => []),
        listEmployeeOptions().catch(() => []),
        assetCategoryService
          .search({ page: 1, page_size: 200, status: "active" })
          .catch(() => ({ items: [] })),
      ]);
      setBranches(branchOpts);
      setDepartments(deptOpts);
      setEmployeeLabels(Object.fromEntries(empOpts.map((e) => [e.id, e.label])));
      setCategories(filterActiveCategories(catRes.items));
    })();
  }, []);

  const branchLabels = useMemo(() => branchLookupFromOrgOptions(branches), [branches]);
  const departmentLabels = useMemo(
    () => Object.fromEntries(departments.map((d) => [d.id, d.label])),
    [departments],
  );
  const categoryLabels = useMemo(
    () => Object.fromEntries(categories.map((c) => [c.id, c.category_name])),
    [categories],
  );
  const locationOptions = useMemo(
    () => branches.map((b) => ({ value: b.id, label: b.label })),
    [branches],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const { assetList, assignmentList } = await fetchInventoryPage({
        preset,
        filters: appliedFilters,
        headerBranchId,
        page,
      });

      const assignmentsByAssetId = indexActiveAssignments(assignmentList.items);
      const assignmentHistoryByAssetId = groupAssignmentsByAssetId(assignmentList.items);
      const mapped = mapAssetsToInventoryRows(assetList.items, {
        branchLabels,
        departmentLabels,
        categoryLabels,
        locationLabels: branchLabels,
        assignmentsByAssetId,
        assignmentHistoryByAssetId,
        employeeLabels,
      });
      const filtered = applyClientInventoryFilters(mapped, appliedFilters, assetList.items);

      setRows(filtered);
      setTotal(assetList.total);
    } catch (err) {
      setErrorMessage(err instanceof ApiClientError ? err.message : "Failed to load inventory");
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [
    appliedFilters,
    branchLabels,
    categoryLabels,
    departmentLabels,
    employeeLabels,
    headerBranchId,
    page,
    preset,
  ]);

  useEffect(() => {
    void load();
  }, [load, reloadToken]);

  /** Clear workflow flags after Issue/Return; drawer starts closed on remount. */
  useEffect(() => {
    clearInventoryUiSnapshot();
    const stale = consumeInventoryStale();
    if (!stale) return;
    setDrawerOpen(false);
    setDrawerRow(null);
    setDrawerData(null);
    setExpandedRowIds(new Set());
  }, []);

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
    setDrawerRow(null);
    setDrawerData(null);
  }, []);

  const snapshotUiForWorkflow = useCallback(() => {
    saveInventoryUiSnapshot({
      preset,
      headerBranchId,
      draftFilters,
      appliedFilters,
      quickSearch,
      page,
    });
  }, [appliedFilters, draftFilters, headerBranchId, page, preset, quickSearch]);

  const onPresetChange = useCallback((next: InventoryPresetId) => {
    setPreset(next);
    setPage(1);
    const op = PRESET_OPERATIONAL_STATUS[next] ?? "";
    setDraftFilters((f) => ({ ...f, operationalStatus: op }));
    setAppliedFilters((f) => ({ ...f, operationalStatus: op }));
  }, []);

  const onApplyFilters = useCallback(() => {
    setAppliedFilters({ ...draftFilters, search: quickSearch.trim() || draftFilters.search });
    setPage(1);
  }, [draftFilters, quickSearch]);

  const onResetFilters = useCallback(() => {
    const op = PRESET_OPERATIONAL_STATUS[preset] ?? "";
    const next = { ...EMPTY_INVENTORY_FILTERS, operationalStatus: op };
    setDraftFilters(next);
    setAppliedFilters(next);
    setQuickSearch("");
    setPage(1);
  }, [preset]);

  const onQuickSearchSubmit = useCallback(() => {
    const next = { ...appliedFilters, search: quickSearch.trim() };
    setDraftFilters((f) => ({ ...f, search: next.search }));
    setAppliedFilters(next);
    setPage(1);
  }, [appliedFilters, quickSearch]);

  const onToggleExpand = useCallback((rowId: string) => {
    setExpandedRowIds((prev) => {
      const next = new Set(prev);
      if (next.has(rowId)) next.delete(rowId);
      else next.add(rowId);
      return next;
    });
  }, []);

  const onViewRow = useCallback((row: InventoryRowViewModel) => {
    setDrawerRow(row);
    setDrawerData(mapInventoryRowToDrawerData(row));
    setDrawerOpen(true);
  }, []);

  const onMenuAction = useCallback(
    (action: InventoryMenuActionId, row: InventoryRowViewModel) => {
      if (action === "assign" || action === "return") {
        snapshotUiForWorkflow();
      }
      handleInventoryMenuWorkflow({
        action,
        assetId: row.id,
        navigation,
        closeDrawer,
      });
    },
    [closeDrawer, navigation, snapshotUiForWorkflow],
  );

  const onDrawerQuickLink = useCallback(
    (link: InventoryQuickLinkId, row: InventoryRowViewModel) => {
      dispatchInventoryQuickLink(navigation, link, row.id);
    },
    [navigation],
  );

  const runExport = useCallback(
    async (format: InventoryExportFormat) => {
      setExporting(true);
      setExportError(null);
      setExportSuccess(null);
      try {
        const result = await exportInventoryRegister({
          format,
          preset,
          filters: appliedFilters,
          headerBranchId,
          lookup: {
            branchLabels,
            departmentLabels,
            categoryLabels,
            locationLabels: branchLabels,
            employeeLabels,
          },
        });
        setExportSuccess(
          `Exported ${result.rowCount} row${result.rowCount === 1 ? "" : "s"} (${result.filename})`,
        );
      } catch (err) {
        const message =
          err instanceof InventoryExportError
            ? err.message
            : err instanceof ApiClientError
              ? err.message
              : "Export failed";
        setExportError(message);
      } finally {
        setExporting(false);
      }
    },
    [
      appliedFilters,
      branchLabels,
      categoryLabels,
      departmentLabels,
      employeeLabels,
      headerBranchId,
      preset,
    ],
  );

  return (
    <AssetInventoryWorkspace
      preset={preset}
      onPresetChange={onPresetChange}
      headerBranchId={headerBranchId}
      onHeaderBranchChange={(id) => {
        setHeaderBranchId(id);
        setPage(1);
      }}
      branches={branches}
      quickSearch={quickSearch}
      onQuickSearchChange={setQuickSearch}
      onQuickSearchSubmit={onQuickSearchSubmit}
      draftFilters={draftFilters}
      onDraftFiltersChange={(patch) => setDraftFilters((f) => ({ ...f, ...patch }))}
      onApplyFilters={onApplyFilters}
      onResetFilters={onResetFilters}
      categories={categories.map((c) => ({ value: c.id, label: c.category_name }))}
      departments={departments.map((d) => ({ value: d.id, label: d.label }))}
      locations={locationOptions}
      rows={rows}
      total={total}
      page={page}
      pageSize={PAGE_SIZE}
      onPageChange={setPage}
      loading={loading}
      errorMessage={errorMessage}
      onRetry={() => setReloadToken((t) => t + 1)}
      expandedRowIds={expandedRowIds}
      onToggleExpand={onToggleExpand}
      actionPermissions={actionPermissions}
      onViewRow={onViewRow}
      onMenuAction={onMenuAction}
      drawerOpen={drawerOpen}
      onDrawerOpenChange={setDrawerOpen}
      drawerData={drawerData}
      drawerRow={drawerRow}
      drawerQuickLinkEnabled={quickLinkPermissions}
      onDrawerQuickLink={onDrawerQuickLink}
      exportBusy={exporting}
      exportError={exportError}
      exportSuccess={exportSuccess}
      onExportExcel={() => void runExport("xlsx")}
      onExportCsv={() => void runExport("csv")}
    />
  );
}
