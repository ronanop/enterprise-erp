"use client";

import { useEffect, useState } from "react";
import type { InventoryRowViewModel } from "@/components/assets/inventory.mapper";
import { InventoryActiveFilterChips } from "@/components/assets/inventory/inventory-filter-chips";
import {
  InventorySearchTypeahead,
  type InventorySearchSuggestion,
} from "@/components/assets/inventory/inventory-search-typeahead";
import {
  AssetDetailDrawer,
  InventoryActionMenu,
  inventoryRowToAssetRef,
  type InventoryActionPermissions,
  type InventoryMenuActionId,
  type InventoryQuickLinkId,
} from "@/components/assets/inventory/interaction";
import type { AssetDetailDrawerData } from "@/components/assets/inventory/interaction/inventory-interaction.types";
import { canCreateDcChallanFromInventory, isOpenDcChallanStatus } from "@/components/assets/navigation/dc-challan-navigation";
import { pickLinkedDcChallan } from "@/components/assets/dc-challan/dc-challan-document";
import { dcChallanService, type DcChallanRow } from "@/services/assets-service";
import {
  INVENTORY_PRESETS,
  PRESET_EMPTY_COPY,
  PRESET_OPERATIONAL_STATUS,
  type InventoryPresetId,
} from "@/components/assets/inventory.types";
import {
  BranchSelector,
  EmptyState,
  StatusBadge,
  TABLE_SERIAL_HEADER_LABEL,
  TableRowsSkeleton,
  tableRowSerial,
  tableSerialCellClassName,
  tableSerialHeaderClassName,
  type BranchOption,
  type InventoryFilterOption,
  type InventoryFilterValues,
} from "@/components/assets/shared";
import {
  ASSETS_ACCENT_BTN,
  ASSETS_SURFACE_CARD,
  AssetsPremiumPage,
} from "@/components/assets/shared/premium-surface";
import { InventoryExportToolbar } from "@/components/assets/inventory/export/inventory-export-toolbar";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { applyOperationalGatesToInventoryPermissions } from "@/components/assets/navigation/inventory-permissions";
import { isOperationalStatus } from "@/components/assets/shared/asset-status";
import { BRANCH_ALL_VALUE } from "@/components/assets/shared";
import { Plus } from "lucide-react";
import Link from "next/link";

function hasActiveInventoryFilters(
  filters: InventoryFilterValues,
  quickSearch: string,
  _preset: InventoryPresetId,
): boolean {
  return Boolean(quickSearch.trim() || filters.search.trim());
}

export type AssetInventoryWorkspaceProps = {
  preset: InventoryPresetId;
  onPresetChange: (preset: InventoryPresetId) => void;
  headerLocationId: string;
  onHeaderLocationChange: (locationId: string) => void;
  siteLocations: BranchOption[];
  branches: BranchOption[];
  quickSearch: string;
  onQuickSearchChange: (value: string) => void;
  onQuickSearchSubmit: () => void;
  draftFilters: InventoryFilterValues;
  appliedFilters?: InventoryFilterValues;
  onDraftFiltersChange: (patch: Partial<InventoryFilterValues>) => void;
  onApplyFilters: () => void;
  onResetFilters: () => void;
  onDismissFilter?: (key: keyof InventoryFilterValues) => void;
  onSelectSearchSuggestion?: (suggestion: InventorySearchSuggestion) => void;
  categories: InventoryFilterOption[];
  departments: InventoryFilterOption[];
  locations: InventoryFilterOption[];
  assetTypes?: InventoryFilterOption[];
  rows: InventoryRowViewModel[];
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  loading: boolean;
  errorMessage?: string | null;
  onRetry?: () => void;
  actionPermissions?: Partial<InventoryActionPermissions>;
  onViewRow?: (row: InventoryRowViewModel) => void;
  onMenuAction?: (action: InventoryMenuActionId, row: InventoryRowViewModel) => void;
  drawerOpen?: boolean;
  onDrawerOpenChange?: (open: boolean) => void;
  drawerData?: AssetDetailDrawerData | null;
  drawerQuickLinkEnabled?: Partial<Record<InventoryQuickLinkId, boolean>>;
  onDrawerQuickLink?: (link: InventoryQuickLinkId, row: InventoryRowViewModel) => void;
  onCreateDcChallan?: (row: InventoryRowViewModel) => void;
  drawerRow?: InventoryRowViewModel | null;
  exportBusy?: boolean;
  exportError?: string | null;
  exportSuccess?: string | null;
  onExportExcel?: () => void;
  onExportCsv?: () => void;
};

const TABLE_COLUMNS = [
  "Asset Code",
  "Asset Name",
  "S/N",
  "Make",
  "Model",
  "Assignee",
  "Employee ID",
  "Operational Status",
  "Location",
  "Issue Date",
] as const;

export function AssetInventoryWorkspace({
  preset,
  onPresetChange,
  headerLocationId,
  onHeaderLocationChange,
  siteLocations,
  branches,
  quickSearch,
  onQuickSearchChange,
  onQuickSearchSubmit,
  draftFilters,
  appliedFilters,
  onDraftFiltersChange: _onDraftFiltersChange,
  onApplyFilters: _onApplyFilters,
  onResetFilters,
  onDismissFilter,
  onSelectSearchSuggestion,
  categories,
  departments,
  locations,
  assetTypes = [],
  rows,
  total,
  page,
  pageSize,
  onPageChange,
  loading,
  errorMessage,
  onRetry,
  actionPermissions,
  onViewRow,
  onMenuAction,
  drawerOpen = false,
  onDrawerOpenChange,
  drawerData = null,
  drawerQuickLinkEnabled,
  onDrawerQuickLink,
  onCreateDcChallan,
  drawerRow = null,
  exportBusy,
  exportError,
  exportSuccess,
  onExportExcel,
  onExportCsv,
}: AssetInventoryWorkspaceProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const emptyCopy = PRESET_EMPTY_COPY[preset];
  const [linkedDc, setLinkedDc] = useState<DcChallanRow | null>(null);
  const [linkedDcLoading, setLinkedDcLoading] = useState(false);

  useEffect(() => {
    if (!drawerOpen || !drawerRow?.id) {
      setLinkedDc(null);
      setLinkedDcLoading(false);
      return;
    }
    let cancelled = false;
    setLinkedDc(null);
    setLinkedDcLoading(true);
    void dcChallanService
      .search({ asset_id: drawerRow.id, page_size: 25 })
      .then((result) => {
        if (!cancelled) setLinkedDc(pickLinkedDcChallan(result.items));
      })
      .catch(() => {
        if (!cancelled) setLinkedDc(null);
      })
      .finally(() => {
        if (!cancelled) setLinkedDcLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [drawerOpen, drawerRow?.id]);

  const allowCreateDc =
    Boolean(drawerRow && onCreateDcChallan && canCreateDcChallanFromInventory(drawerRow)) &&
    !isOpenDcChallanStatus(linkedDc?.status);
  const currentApplied = appliedFilters ?? draftFilters;
  const filtersActive = hasActiveInventoryFilters(currentApplied, quickSearch, preset);
  const presetOperationalStatus = PRESET_OPERATIONAL_STATUS[preset];
  const emptyTitle =
    filtersActive || total === 0
      ? filtersActive
        ? "No assets match your current search or filters."
        : emptyCopy.title
      : emptyCopy.title;
  const emptyDescription = filtersActive
    ? "Try clearing filters or adjusting your search."
    : emptyCopy.description;

  return (
    <AssetsPremiumPage testId="asset-inventory-workspace">
      <PageHeader
        title="IT Asset Inventory"
        description="Search, filter, and manage the enterprise IT asset register."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <BranchSelector
              value={headerLocationId}
              onChange={onHeaderLocationChange}
              branches={siteLocations}
              aria-label="Location"
              allLabel="All"
            />
            {onExportExcel && onExportCsv ? (
              <InventoryExportToolbar
                exporting={exportBusy}
                exportError={exportError}
                exportSuccess={exportSuccess}
                onExportExcel={onExportExcel}
                onExportCsv={onExportCsv}
                disabled={loading}
              />
            ) : null}
            <Button asChild className={ASSETS_ACCENT_BTN}>
              <Link href="/assets/assets/new">
                <Plus className="size-4" aria-hidden />
                Add asset
              </Link>
            </Button>
          </div>
        }
      />

      <Card className={ASSETS_SURFACE_CARD}>
        <div className="space-y-3 border-b border-border/50 p-4">
          <div
            className="flex flex-col gap-2 sm:flex-row sm:items-center"
            data-testid="inventory-search-filter-row"
          >
            <InventorySearchTypeahead
              value={quickSearch}
              onValueChange={onQuickSearchChange}
              onSubmit={onQuickSearchSubmit}
              onSelectSuggestion={(suggestion) => onSelectSearchSuggestion?.(suggestion)}
              className="w-full min-w-0 sm:max-w-md lg:max-w-lg sm:flex-none"
              locationId={
                headerLocationId !== BRANCH_ALL_VALUE ? headerLocationId : undefined
              }
              operationalStatuses={
                presetOperationalStatus ? [presetOperationalStatus] : undefined
              }
              placeholder="Asset tag, name, serial, make, model, employee, status…"
            />
            <select
              aria-label="Filter by operational status"
              data-testid="inventory-status-filter"
              className="flex h-9 w-full cursor-pointer rounded-md border border-input bg-background px-3 text-sm transition-colors duration-200 sm:w-[13.5rem] sm:shrink-0"
              value={preset}
              onChange={(e) => onPresetChange(e.target.value as InventoryPresetId)}
            >
              {INVENTORY_PRESETS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <InventoryActiveFilterChips
            filters={currentApplied}
            branches={branches}
            categories={categories}
            departments={departments}
            locations={locations}
            assetTypes={assetTypes}
            onDismiss={onDismissFilter ?? (() => undefined)}
          />
        </div>

      {errorMessage ? (
        <div className="border-b border-destructive/20 bg-destructive/5 px-4 py-3" role="alert" data-testid="inventory-error-card">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-destructive">{errorMessage}</p>
            {onRetry ? (
              <Button type="button" variant="outline" className="cursor-pointer" onClick={onRetry}>
                Retry
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="hidden overflow-x-auto md:block">
        <table
          className="w-full min-w-[1100px] text-sm lg:min-w-[1280px]"
          data-testid="inventory-table"
        >
          <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
            <tr>
              <th className={tableSerialHeaderClassName()} scope="col">
                {TABLE_SERIAL_HEADER_LABEL}
              </th>
              {TABLE_COLUMNS.map((col) => (
                <th
                  key={col}
                  className={cn(
                    "px-3 py-2.5 font-medium whitespace-nowrap",
                    col === "Operational Status" && "text-center",
                    col === "Issue Date" && "text-right",
                  )}
                >
                  {col}
                </th>
              ))}
              <th className="px-3 py-2.5 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={TABLE_COLUMNS.length + 2} className="p-4">
                  <TableRowsSkeleton rows={6} />
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={TABLE_COLUMNS.length + 2} className="p-6">
                  <div className="space-y-3">
                    <EmptyState
                      variant="no-results"
                      title={emptyTitle}
                      description={emptyDescription}
                    />
                    {filtersActive ? (
                      <div className="flex justify-center">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="cursor-pointer"
                          onClick={onResetFilters}
                        >
                          Clear filters
                        </Button>
                      </div>
                    ) : null}
                  </div>
                </td>
              </tr>
            ) : (
              rows.map((row, index) => (
                <InventoryTableRow
                  key={row.id}
                  row={row}
                  serial={tableRowSerial(page, pageSize, index)}
                  actionPermissions={actionPermissions}
                  onViewRow={onViewRow}
                  onMenuAction={onMenuAction}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 border-t border-border/50 p-4 md:hidden" data-testid="inventory-mobile-cards">
        {loading ? (
          <TableRowsSkeleton rows={4} />
        ) : rows.length === 0 ? (
          <div className="space-y-3">
            <EmptyState
              variant="no-results"
              title={emptyTitle}
              description={emptyDescription}
            />
            {filtersActive ? (
              <div className="flex justify-center">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="cursor-pointer"
                  onClick={onResetFilters}
                >
                  Clear filters
                </Button>
              </div>
            ) : null}
          </div>
        ) : (
          rows.map((row) => (
            <InventoryMobileCard
              key={row.id}
              row={row}
              actionPermissions={actionPermissions}
              onViewRow={onViewRow}
              onMenuAction={onMenuAction}
            />
          ))
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/50 px-4 py-3">
        <p className="text-xs text-muted-foreground">
          Showing {rows.length} of {total} assets
          {totalPages > 1 ? ` · page ${page} of ${totalPages}` : null}
        </p>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="cursor-pointer"
            disabled={page <= 1 || loading}
            onClick={() => onPageChange(page - 1)}
          >
            Previous
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="cursor-pointer"
            disabled={page >= totalPages || loading}
            onClick={() => onPageChange(page + 1)}
          >
            Next
          </Button>
        </div>
      </div>
      </Card>

      <AssetDetailDrawer
        open={drawerOpen}
        onOpenChange={(open) => onDrawerOpenChange?.(open)}
        asset={drawerRow ? inventoryRowToAssetRef(drawerRow) : null}
        data={drawerData}
        quickLinkEnabled={drawerQuickLinkEnabled}
        onQuickLink={
          drawerRow && onDrawerQuickLink
            ? (link) => onDrawerQuickLink(link, drawerRow)
            : undefined
        }
        onCreateDcChallan={
          allowCreateDc && drawerRow && onCreateDcChallan
            ? () => onCreateDcChallan(drawerRow)
            : undefined
        }
        dcChallan={drawerOpen ? linkedDc : undefined}
        dcChallanLoading={linkedDcLoading}
      />
    </AssetsPremiumPage>
  );
}

function InventoryTableRow({
  row,
  serial,
  actionPermissions,
  onViewRow,
  onMenuAction,
}: {
  row: InventoryRowViewModel;
  serial: number;
  actionPermissions?: Partial<InventoryActionPermissions>;
  onViewRow?: (row: InventoryRowViewModel) => void;
  onMenuAction?: (action: InventoryMenuActionId, row: InventoryRowViewModel) => void;
}) {
  const asset = inventoryRowToAssetRef(row);
  const rowPermissions = applyOperationalGatesToInventoryPermissions(
    {
      viewDetails: true,
      assign: true,
      return: true,
      portal: true,
      discovery: true,
      qr: true,
      transfer: true,
      maintenance: true,
      startDisposal: true,
      reinstate: true,
      history: true,
      ...actionPermissions,
    },
    row.operationalStatus,
  );
  const opsBadge = isOperationalStatus(row.operationalStatus) ? (
    <StatusBadge kind="operational" status={row.operationalStatus} />
  ) : (
    row.operationalStatus
  );

  return (
    <tr className="border-t border-border/50 transition-colors duration-200 hover:bg-muted/20 motion-reduce:transition-none">
      <td className={tableSerialCellClassName()}>{serial}</td>
      <td className="px-3 py-2.5 font-mono text-xs">{row.assetTag}</td>
      <td className="px-3 py-2.5 font-medium">{row.laptopName}</td>
      <td className="px-3 py-2.5 font-mono text-xs">{row.serialNumber}</td>
      <td className="px-3 py-2.5">{row.manufacturer}</td>
      <td className="px-3 py-2.5">{row.model}</td>
      <td className="px-3 py-2.5">{row.currentHolder}</td>
      <td className="px-3 py-2.5 font-mono text-xs">{row.employeeId}</td>
      <td className="px-3 py-2.5 text-center">{opsBadge}</td>
      <td className="px-3 py-2.5">{row.location}</td>
      <td className="px-3 py-2.5 whitespace-nowrap text-right">{row.issueDate}</td>
      <td className="px-3 py-2.5 text-right">
        <InventoryActionMenu
          asset={asset}
          permissions={rowPermissions}
          onView={() => onViewRow?.(row)}
          onMenuAction={(action) => onMenuAction?.(action, row)}
        />
      </td>
    </tr>
  );
}

function InventoryMobileCard({
  row,
  actionPermissions,
  onViewRow,
  onMenuAction,
}: {
  row: InventoryRowViewModel;
  actionPermissions?: Partial<InventoryActionPermissions>;
  onViewRow?: (row: InventoryRowViewModel) => void;
  onMenuAction?: (action: InventoryMenuActionId, row: InventoryRowViewModel) => void;
}) {
  const asset = inventoryRowToAssetRef(row);
  const rowPermissions = applyOperationalGatesToInventoryPermissions(
    {
      viewDetails: true,
      assign: true,
      return: true,
      portal: true,
      discovery: true,
      qr: true,
      transfer: true,
      maintenance: true,
      startDisposal: true,
      reinstate: true,
      history: true,
      ...actionPermissions,
    },
    row.operationalStatus,
  );
  return (
    <Card className="border-border/80 shadow-sm">
      <CardContent className="space-y-2 pt-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-medium">{row.laptopName}</p>
            <p className="font-mono text-xs text-muted-foreground">{row.assetTag}</p>
          </div>
          {isOperationalStatus(row.operationalStatus) ? (
            <StatusBadge kind="operational" status={row.operationalStatus} />
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground">
          {row.manufacturer} · {row.model}
        </p>
        <p className="text-xs">
          Assignee: {row.currentHolder} · {row.employeeId}
        </p>
        <p className="text-xs text-muted-foreground">
          Location: {row.location} · Issued: {row.issueDate}
        </p>
        <InventoryActionMenu
          asset={asset}
          permissions={rowPermissions}
          onView={() => onViewRow?.(row)}
          onMenuAction={(action) => onMenuAction?.(action, row)}
          className="w-full justify-end"
        />
      </CardContent>
    </Card>
  );
}
