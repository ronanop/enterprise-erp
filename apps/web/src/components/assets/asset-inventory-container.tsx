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
import { isEmployeeAllocation } from "@/components/assets/navigation/dc-challan-navigation";
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
import { StartDisposalConfirmDialog } from "@/components/assets/start-disposal-confirm-dialog";
import { ReinstateConfirmDialog } from "@/components/assets/reinstate-confirm-dialog";
import {
  exportInventoryRegister,
  fetchAllAssignmentPages,
  InventoryExportError,
  type InventoryExportFormat,
} from "@/components/assets/inventory/export";
import { useUserPermissions } from "@/hooks/use-user-permissions";
import type { InventoryRowViewModel } from "@/components/assets/inventory.mapper";
import {
  branchLookupFromOrgOptions,
  buildInventoryListQuery,
  groupAssignmentsByAssetId,
  indexActiveAssignments,
  mapAssetsToInventoryRows,
  type InventoryAccessoryLine,
  type InventoryLookupContext,
} from "@/components/assets/inventory.mapper";
import type { InventorySearchSuggestion } from "@/components/assets/inventory/inventory-search-typeahead";
import type { InventoryPresetId } from "@/components/assets/inventory.types";
import { PRESET_OPERATIONAL_STATUS } from "@/components/assets/inventory.types";
import {
  BRANCH_ALL_VALUE,
  EMPTY_INVENTORY_FILTERS,
  type InventoryFilterValues,
} from "@/components/assets/shared";
import {
  listBranchOptions,
  listDepartmentOptions,
  listEmployeeDirectory,
  listLocationOptions,
  employeeDirectoryById,
  employeeLabelsFromDirectory,
  type EmployeeDirectoryEntry,
} from "@/lib/org-options";
import type { EmployeeLookup } from "@/components/assets/inventory/register-parity";
import {
  assetCategoryService,
  assetLocationService,
  assetOperationsService,
  assetRegisterService,
  componentService,
  componentTypeLabel,
  filterActiveCategories,
  type AssetPaginatedListResult,
} from "@/services/assets-service";
import { ApiClientError } from "@/services/api-client";

const PAGE_SIZE = 25;

async function fetchCurrentAssetLocationLabels(): Promise<Record<string, string>> {
  const labels: Record<string, string> = {};
  let page = 1;
  let total = 0;
  const pageSize = 200;
  do {
    const res = await assetLocationService.search({
      page,
      page_size: pageSize,
      is_current: true,
      status: "active",
    });
    total = res.total;
    for (const loc of res.items) {
      if (loc.asset_id && loc.location_label) {
        labels[String(loc.asset_id)] = loc.location_label;
      }
    }
    if (res.items.length === 0) break;
    page += 1;
  } while ((page - 1) * pageSize < total);
  return labels;
}

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

  // Assignments API caps page_size at 200 — paginate instead of requesting 500 (422).
  const [assetList, assignmentItems] = await Promise.all([
    listAssets(query),
    fetchAllAssignmentPages(listAssignments, branch_id),
  ]);

  const assignmentList: AssetPaginatedListResult = {
    items: assignmentItems,
    total: assignmentItems.length,
    page: 1,
    page_size: assignmentItems.length,
  };

  const assetIds = (assetList.items ?? [])
    .map((a) => String(a.id ?? ""))
    .filter(Boolean);
  const accessoriesByAssetId = new Map<string, InventoryAccessoryLine[]>();
  if (assetIds.length) {
    try {
      const components = await componentService.search({
        asset_ids: assetIds,
        status: "active",
        page: 1,
        page_size: Math.max(assetIds.length * 10, 100),
      });
      for (const row of components.items) {
        const assetId = String(row.asset_id);
        const list = accessoriesByAssetId.get(assetId) ?? [];
        list.push({
          typeLabel: componentTypeLabel(row.component_type),
          serialDisplay: row.serial_number?.trim() || "—",
          componentName: row.component_name?.trim() || undefined,
          status: row.status,
        });
        accessoriesByAssetId.set(assetId, list);
      }
    } catch {
      // Accessories are optional enrichment — inventory still loads.
    }
  }

  return { assetList, assignmentList, accessoriesByAssetId };
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
  const [reloadToken, setReloadToken] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportSuccess, setExportSuccess] = useState<string | null>(null);
  const [startDisposalRow, setStartDisposalRow] = useState<InventoryRowViewModel | null>(null);
  const [startDisposalSubmitting, setStartDisposalSubmitting] = useState(false);
  const [startDisposalError, setStartDisposalError] = useState<string | null>(null);
  const [reinstateRow, setReinstateRow] = useState<InventoryRowViewModel | null>(null);
  const [reinstateSubmitting, setReinstateSubmitting] = useState(false);
  const [reinstateError, setReinstateError] = useState<string | null>(null);

  const [branches, setBranches] = useState<Array<{ id: string; label: string }>>([]);
  const [departments, setDepartments] = useState<Array<{ id: string; label: string }>>([]);
  const [locations, setLocations] = useState<Array<{ id: string; label: string }>>([]);
  const [categories, setCategories] = useState<Array<{ id: string; category_name: string }>>([]);
  const [employeeLabels, setEmployeeLabels] = useState<Record<string, string>>({});
  const [employeeLookup, setEmployeeLookup] = useState<EmployeeLookup>({});

  useEffect(() => {
    void (async () => {
      const [branchOpts, deptOpts, locOpts, empDir, catRes] = await Promise.all([
        listBranchOptions().catch(() => []),
        listDepartmentOptions().catch(() => []),
        listLocationOptions().catch(() => []),
        listEmployeeDirectory().catch(() => [] as EmployeeDirectoryEntry[]),
        assetCategoryService
          .search({ page: 1, page_size: 200, status: "active" })
          .catch(() => ({ items: [] })),
      ]);
      setBranches(branchOpts);
      setDepartments(deptOpts);
      setLocations(locOpts);
      setEmployeeLabels(employeeLabelsFromDirectory(empDir));
      const byId = employeeDirectoryById(empDir);
      const lookup: EmployeeLookup = {};
      for (const [id, e] of Object.entries(byId)) {
        lookup[id] = {
          label: e.label,
          displayName: e.displayName,
          employeeCode: e.employeeCode,
          mobile: e.mobile,
        };
      }
      setEmployeeLookup(lookup);
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
    () => locations.map((l) => ({ value: l.id, label: l.label })),
    [locations],
  );

  const lookupRef = useRef<InventoryLookupContext | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const { assetList, assignmentList, accessoriesByAssetId } = await fetchInventoryPage({
        preset,
        filters: appliedFilters,
        headerBranchId,
        page,
      });

      let locationLabels: Record<string, string> = {};
      try {
        locationLabels = await fetchCurrentAssetLocationLabels();
      } catch {
        locationLabels = {};
      }
      const assignmentsByAssetId = indexActiveAssignments(assignmentList.items);
      const assignmentHistoryByAssetId = groupAssignmentsByAssetId(assignmentList.items);
      const mapped = mapAssetsToInventoryRows(assetList.items, {
        branchLabels,
        departmentLabels,
        categoryLabels,
        locationLabels,
        assignmentsByAssetId,
        assignmentHistoryByAssetId,
        accessoriesByAssetId,
        employeeLabels,
        employeeLookup,
      });
      lookupRef.current = {
        branchLabels,
        departmentLabels,
        categoryLabels,
        locationLabels,
        assignmentsByAssetId,
        assignmentHistoryByAssetId,
        accessoriesByAssetId,
        employeeLabels,
        employeeLookup,
      };

      setRows(mapped);
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
    employeeLookup,
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

  const onDismissFilter = useCallback((key: keyof InventoryFilterValues) => {
    const emptyValue = EMPTY_INVENTORY_FILTERS[key];
    setAppliedFilters((prev) => ({ ...prev, [key]: emptyValue }));
    setDraftFilters((prev) => ({ ...prev, [key]: emptyValue }));
    if (key === "search") setQuickSearch("");
    setPage(1);
  }, []);

  const onViewRow = useCallback((row: InventoryRowViewModel) => {
    setDrawerRow(row);
    setDrawerData(mapInventoryRowToDrawerData(row));
    setDrawerOpen(true);
  }, []);

  const onSelectSearchSuggestion = useCallback(
    (suggestion: InventorySearchSuggestion) => {
      const existing = rows.find((row) => row.id === suggestion.id);
      if (existing) {
        onViewRow(existing);
        return;
      }
      const ctx = lookupRef.current ?? {
        branchLabels,
        departmentLabels,
        categoryLabels,
        locationLabels: {},
        assignmentsByAssetId: new Map(),
        employeeLabels,
        employeeLookup,
      };
      const mapped = mapAssetsToInventoryRows([suggestion.raw], ctx);
      if (mapped[0]) onViewRow(mapped[0]);
    },
    [branchLabels, categoryLabels, departmentLabels, employeeLabels, employeeLookup, onViewRow, rows],
  );

  const onMenuAction = useCallback(
    (action: InventoryMenuActionId, row: InventoryRowViewModel) => {
      if (action === "startDisposal") {
        closeDrawer();
        setStartDisposalError(null);
        setStartDisposalRow(row);
        return;
      }
      if (action === "reinstate") {
        closeDrawer();
        setReinstateError(null);
        setReinstateRow(row);
        return;
      }
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

  const confirmStartDisposal = useCallback(async () => {
    if (!startDisposalRow) return;
    setStartDisposalSubmitting(true);
    setStartDisposalError(null);
    try {
      await assetRegisterService.startDisposal(startDisposalRow.id);
      setStartDisposalRow(null);
      setReloadToken((t) => t + 1);
      navigation.openDisposal(startDisposalRow.id);
    } catch (err) {
      setStartDisposalError(
        err instanceof ApiClientError ? err.message : "Could not start disposal",
      );
    } finally {
      setStartDisposalSubmitting(false);
    }
  }, [navigation, startDisposalRow]);

  const confirmReinstate = useCallback(async () => {
    if (!reinstateRow) return;
    setReinstateSubmitting(true);
    setReinstateError(null);
    try {
      await assetRegisterService.reinstate(reinstateRow.id);
      setReinstateRow(null);
      setExportSuccess("Asset reinstated and is Ready to Move.");
      setReloadToken((t) => t + 1);
    } catch (err) {
      setReinstateError(
        err instanceof ApiClientError ? err.message : "Could not reinstate asset",
      );
    } finally {
      setReinstateSubmitting(false);
    }
  }, [reinstateRow]);

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
        let locationLabels: Record<string, string> = {};
        try {
          locationLabels = await fetchCurrentAssetLocationLabels();
        } catch {
          locationLabels = {};
        }
        const result = await exportInventoryRegister({
          format,
          preset,
          filters: appliedFilters,
          headerBranchId,
          lookup: {
            branchLabels,
            departmentLabels,
            categoryLabels,
            locationLabels,
            employeeLabels,
            employeeLookup,
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
      employeeLookup,
      headerBranchId,
      preset,
    ],
  );

  return (
    <>
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
        appliedFilters={appliedFilters}
        onDraftFiltersChange={(patch) => setDraftFilters((f) => ({ ...f, ...patch }))}
        onApplyFilters={onApplyFilters}
        onResetFilters={onResetFilters}
        onDismissFilter={onDismissFilter}
        onSelectSearchSuggestion={onSelectSearchSuggestion}
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
        actionPermissions={actionPermissions}
        onViewRow={onViewRow}
        onMenuAction={onMenuAction}
        drawerOpen={drawerOpen}
        onDrawerOpenChange={setDrawerOpen}
        drawerData={drawerData}
        drawerRow={drawerRow}
        drawerQuickLinkEnabled={quickLinkPermissions}
        onDrawerQuickLink={onDrawerQuickLink}
        onCreateDcChallan={(row) =>
          navigation.openDcChallan(
            row.id,
            isEmployeeAllocation(row.assignmentAllocationType)
              ? (row.activeAssignmentId ?? undefined)
              : undefined,
          )
        }
        exportBusy={exporting}
        exportError={exportError}
        exportSuccess={exportSuccess}
        onExportExcel={() => void runExport("xlsx")}
        onExportCsv={() => void runExport("csv")}
      />
      <StartDisposalConfirmDialog
        open={startDisposalRow != null}
        asset={
          startDisposalRow
            ? {
                id: startDisposalRow.id,
                assetCode: startDisposalRow.assetTag,
                assetName: startDisposalRow.laptopName,
                serialNumber: startDisposalRow.serialNumber,
                lifecycleStatus: startDisposalRow.lifecycleStatus,
                operationalStatus: startDisposalRow.operationalStatus,
              }
            : null
        }
        submitting={startDisposalSubmitting}
        error={startDisposalError}
        onCancel={() => {
          if (startDisposalSubmitting) return;
          setStartDisposalRow(null);
          setStartDisposalError(null);
        }}
        onConfirm={() => void confirmStartDisposal()}
      />
      <ReinstateConfirmDialog
        open={reinstateRow != null}
        asset={
          reinstateRow
            ? {
                id: reinstateRow.id,
                assetCode: reinstateRow.assetTag,
                assetName: reinstateRow.laptopName,
                serialNumber: reinstateRow.serialNumber,
                lifecycleStatus: reinstateRow.lifecycleStatus,
                operationalStatus: reinstateRow.operationalStatus,
              }
            : null
        }
        submitting={reinstateSubmitting}
        error={reinstateError}
        onCancel={() => {
          if (reinstateSubmitting) return;
          setReinstateRow(null);
          setReinstateError(null);
        }}
        onConfirm={() => void confirmReinstate()}
      />
    </>
  );
}
