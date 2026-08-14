"use client";

import { ChevronDown, ChevronRight } from "lucide-react";

import type { InventoryRowViewModel } from "@/components/assets/inventory.mapper";
import {
  InventoryRegisterGroups,
  inventoryRowToRegisterGroups,
} from "@/components/assets/inventory/inventory-register-groups";
import {
  AssetDetailDrawer,
  InventoryActionMenu,
  inventoryRowToAssetRef,
  type InventoryActionPermissions,
  type InventoryMenuActionId,
  type InventoryQuickLinkId,
} from "@/components/assets/inventory/interaction";
import type { AssetDetailDrawerData } from "@/components/assets/inventory/interaction/inventory-interaction.types";
import {
  INVENTORY_PRESETS,
  PRESET_EMPTY_COPY,
  PRESET_OPERATIONAL_STATUS,
  type InventoryPresetId,
} from "@/components/assets/inventory.types";
import {
  BranchSelector,
  EmptyState,
  InventoryFilterBar,
  StatusBadge,
  TableRowsSkeleton,
  type BranchOption,
  type InventoryFilterOption,
  type InventoryFilterValues,
} from "@/components/assets/shared";
import { InventoryExportToolbar } from "@/components/assets/inventory/export/inventory-export-toolbar";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { applyOperationalGatesToInventoryPermissions } from "@/components/assets/navigation/inventory-permissions";
import { isOperationalStatus } from "@/components/assets/shared/asset-status";
import { BRANCH_ALL_VALUE } from "@/components/assets/shared";

function hasActiveInventoryFilters(
  filters: InventoryFilterValues,
  quickSearch: string,
  preset: InventoryPresetId,
): boolean {
  if (quickSearch.trim() || filters.search.trim()) return true;
  if (filters.lifecycleStatus || filters.categoryId || filters.departmentId) return true;
  if (filters.assetType || filters.assignmentState) return true;
  if (filters.branchId && filters.branchId !== BRANCH_ALL_VALUE) return true;
  if (filters.locationId && filters.locationId !== BRANCH_ALL_VALUE) return true;
  const presetOps = PRESET_OPERATIONAL_STATUS[preset] ?? "";
  const effectiveOps = filters.operationalStatus || presetOps;
  return effectiveOps !== presetOps;
}

export type AssetInventoryWorkspaceProps = {
  preset: InventoryPresetId;
  onPresetChange: (preset: InventoryPresetId) => void;
  headerBranchId: string;
  onHeaderBranchChange: (branchId: string) => void;
  branches: BranchOption[];
  quickSearch: string;
  onQuickSearchChange: (value: string) => void;
  onQuickSearchSubmit: () => void;
  draftFilters: InventoryFilterValues;
  appliedFilters?: InventoryFilterValues;
  onDraftFiltersChange: (patch: Partial<InventoryFilterValues>) => void;
  onApplyFilters: () => void;
  onResetFilters: () => void;
  categories: InventoryFilterOption[];
  departments: InventoryFilterOption[];
  locations: InventoryFilterOption[];
  rows: InventoryRowViewModel[];
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  loading: boolean;
  errorMessage?: string | null;
  onRetry?: () => void;
  expandedRowIds: Set<string>;
  onToggleExpand: (rowId: string) => void;
  actionPermissions?: Partial<InventoryActionPermissions>;
  onViewRow?: (row: InventoryRowViewModel) => void;
  onMenuAction?: (action: InventoryMenuActionId, row: InventoryRowViewModel) => void;
  drawerOpen?: boolean;
  onDrawerOpenChange?: (open: boolean) => void;
  drawerData?: AssetDetailDrawerData | null;
  drawerQuickLinkEnabled?: Partial<Record<InventoryQuickLinkId, boolean>>;
  onDrawerQuickLink?: (link: InventoryQuickLinkId, row: InventoryRowViewModel) => void;
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
  headerBranchId,
  onHeaderBranchChange,
  branches,
  quickSearch,
  onQuickSearchChange,
  onQuickSearchSubmit,
  draftFilters,
  appliedFilters,
  onDraftFiltersChange,
  onApplyFilters,
  onResetFilters,
  categories,
  departments,
  locations,
  rows,
  total,
  page,
  pageSize,
  onPageChange,
  loading,
  errorMessage,
  onRetry,
  expandedRowIds,
  onToggleExpand,
  actionPermissions,
  onViewRow,
  onMenuAction,
  drawerOpen = false,
  onDrawerOpenChange,
  drawerData = null,
  drawerQuickLinkEnabled,
  onDrawerQuickLink,
  drawerRow = null,
  exportBusy,
  exportError,
  exportSuccess,
  onExportExcel,
  onExportCsv,
}: AssetInventoryWorkspaceProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const emptyCopy = PRESET_EMPTY_COPY[preset];
  const filtersActive = hasActiveInventoryFilters(
    appliedFilters ?? draftFilters,
    quickSearch,
    preset,
  );
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
    <div className="space-y-6" data-testid="asset-inventory-workspace">
      <PageHeader
        title="IT Asset Inventory"
        description="Manage enterprise asset inventory"
        actions={
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:min-w-[280px]">
            <div className="flex gap-2">
              <Input
                value={quickSearch}
                onChange={(e) => onQuickSearchChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") onQuickSearchSubmit();
                }}
                placeholder="Quick search…"
                aria-label="Quick search"
                className="flex-1"
              />
              <Button
                type="button"
                variant="secondary"
                className="cursor-pointer shrink-0"
                onClick={onQuickSearchSubmit}
              >
                Search
              </Button>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <BranchSelector
                value={headerBranchId}
                onChange={onHeaderBranchChange}
                branches={branches}
                aria-label="Branch"
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
            </div>
          </div>
        }
      />

      <div
        className="flex flex-wrap gap-1.5"
        role="tablist"
        aria-label="Inventory presets"
        data-testid="inventory-preset-tabs"
      >
        {INVENTORY_PRESETS.map((tab) => {
          const selected = preset === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={selected}
              className={cn(
                "cursor-pointer rounded-md border px-3 py-1.5 text-sm font-medium transition-colors duration-200",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                selected
                  ? "border-primary bg-primary text-primary-foreground shadow-sm"
                  : "border-border bg-background text-foreground hover:bg-muted/80",
              )}
              onClick={() => onPresetChange(tab.id)}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <InventoryFilterBar
        values={draftFilters}
        onChange={onDraftFiltersChange}
        onApply={onApplyFilters}
        onReset={onResetFilters}
        branches={branches}
        categories={categories}
        departments={departments}
        locations={locations}
      />

      {errorMessage ? (
        <Card className="border-destructive/30 bg-destructive/5" role="alert" data-testid="inventory-error-card">
          <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-destructive">{errorMessage}</p>
            {onRetry ? (
              <Button type="button" variant="outline" className="cursor-pointer" onClick={onRetry}>
                Retry
              </Button>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {/* Desktop / tablet table */}
      <div className="hidden overflow-x-auto rounded-lg border border-border/70 md:block">
        <table
          className="w-full min-w-[1200px] text-sm lg:min-w-[1400px]"
          data-testid="inventory-table"
        >
          <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
            <tr>
              <th className="w-8 px-2 py-2" />
              {TABLE_COLUMNS.map((col) => (
                <th key={col} className="px-2 py-2 font-medium whitespace-nowrap">
                  {col}
                </th>
              ))}
              <th className="px-2 py-2 text-right">Actions</th>
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
              rows.map((row) => {
                const expanded = expandedRowIds.has(row.id);
                return (
                  <InventoryTableRow
                    key={row.id}
                    row={row}
                    expanded={expanded}
                    onToggleExpand={() => onToggleExpand(row.id)}
                    actionPermissions={actionPermissions}
                    onViewRow={onViewRow}
                    onMenuAction={onMenuAction}
                  />
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="space-y-3 md:hidden" data-testid="inventory-mobile-cards">
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

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Showing {rows.length} of {total} assets (page {page} of {totalPages})
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

      <AssetDetailDrawer
        open={drawerOpen}
        onOpenChange={(open) => onDrawerOpenChange?.(open)}
        asset={drawerRow ? inventoryRowToAssetRef(drawerRow) : null}
        data={drawerData}
        quickLinkEnabled={drawerQuickLinkEnabled}
        onQuickLink={
          drawerRow && onDrawerQuickLink
            ? (link, asset) => onDrawerQuickLink(link, drawerRow)
            : undefined
        }
      />
    </div>
  );
}

function InventoryTableRow({
  row,
  expanded,
  onToggleExpand,
  actionPermissions,
  onViewRow,
  onMenuAction,
}: {
  row: InventoryRowViewModel;
  expanded: boolean;
  onToggleExpand: () => void;
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
    <>
      <tr className="border-t border-border/50 hover:bg-muted/20">
        <td className="px-2 py-2">
          <button
            type="button"
            className="cursor-pointer rounded p-1 text-muted-foreground hover:bg-muted"
            aria-expanded={expanded}
            aria-label={expanded ? "Collapse row" : "Expand row"}
            onClick={onToggleExpand}
          >
            {expanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
          </button>
        </td>
        <td className="px-2 py-2 font-mono text-xs">{row.assetTag}</td>
        <td className="px-2 py-2 font-medium">{row.laptopName}</td>
        <td className="px-2 py-2 font-mono text-xs">{row.serialNumber}</td>
        <td className="px-2 py-2">{row.manufacturer}</td>
        <td className="px-2 py-2">{row.model}</td>
        <td className="px-2 py-2">{row.currentHolder}</td>
        <td className="px-2 py-2 font-mono text-xs">{row.employeeId}</td>
        <td className="px-2 py-2">{opsBadge}</td>
        <td className="px-2 py-2">{row.location}</td>
        <td className="px-2 py-2 whitespace-nowrap">{row.issueDate}</td>
        <td className="px-2 py-2 text-right">
          <InventoryActionMenu
            asset={asset}
            permissions={rowPermissions}
            onView={() => onViewRow?.(row)}
            onMenuAction={(action, a) => onMenuAction?.(action, row)}
          />
        </td>
      </tr>
      {expanded ? (
        <tr className="border-t border-border/40 bg-muted/10">
          <td colSpan={TABLE_COLUMNS.length + 2} className="px-4 py-3">
            <InventoryRegisterGroups model={inventoryRowToRegisterGroups(row)} />
          </td>
        </tr>
      ) : null}
    </>
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
          <div>
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
