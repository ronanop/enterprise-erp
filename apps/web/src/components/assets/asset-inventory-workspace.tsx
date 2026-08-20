"use client";

import { ChevronDown, ChevronRight } from "lucide-react";

import type { InventoryRowViewModel } from "@/components/assets/inventory.mapper";
import {
  AssetDetailDrawer,
  InventoryActionMenu,
  inventoryRowToAssetRef,
} from "@/components/assets/inventory/interaction";
import type {
  AssetDetailDrawerActionId,
  AssetDetailDrawerData,
  InventoryActionPermissions,
  InventoryMenuActionId,
  InventoryQuickLinkId,
} from "@/components/assets/inventory/interaction/inventory-interaction.types";
import {
  INVENTORY_PRESETS,
  PRESET_EMPTY_COPY,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  OPERATIONAL_STATUS_LABELS,
  OPERATIONAL_STATUS_VALUES,
  isOperationalStatus,
  type OperationalStatusValue,
} from "@/components/assets/shared/asset-status";

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
  successToastMessage?: string | null;
  highlightedRowId?: string | null;
  errorMessage?: string | null;
  onRetry?: () => void;
  expandedRowIds: Set<string>;
  onToggleExpand: (rowId: string) => void;
  actionPermissions?: Partial<InventoryActionPermissions>;
  onViewRow?: (row: InventoryRowViewModel) => void;
  onMenuAction?: (action: InventoryMenuActionId, row: InventoryRowViewModel) => void;
  /** IT Admin — set operational status from the register dropdown. */
  onOperationalStatusChange?: (
    row: InventoryRowViewModel,
    status: OperationalStatusValue,
  ) => void;
  drawerOpen?: boolean;
  onDrawerOpenChange?: (open: boolean) => void;
  drawerData?: AssetDetailDrawerData | null;
  drawerQuickLinkEnabled?: Partial<Record<InventoryQuickLinkId, boolean>>;
  onDrawerQuickLink?: (link: InventoryQuickLinkId, row: InventoryRowViewModel) => void;
  onDrawerAction?: (action: AssetDetailDrawerActionId, row: InventoryRowViewModel) => void;
  drawerRow?: InventoryRowViewModel | null;
  exportBusy?: boolean;
  exportError?: string | null;
  exportSuccess?: string | null;
  onExportExcel?: () => void;
  onExportCsv?: () => void;
  /** When true, section chrome (Asset Register) instead of page header. */
  embedded?: boolean;
  /** Hide local branch selector (unified branch lives on dashboard). */
  hideBranchSelector?: boolean;
  /** Hide inline quick search when sticky global search is used. */
  hideQuickSearch?: boolean;
  /** CTA when register is empty (e.g. Add Asset). */
  onAddAssetEmpty?: () => void;
};

const TABLE_COLUMNS = [
  "Asset Tag",
  "Laptop Name",
  "Manufacturer",
  "Model",
  "Configuration",
  "Current Holder",
  "Employee ID",
  "Department",
  "Branch",
  "Operational Status",
  "Lifecycle Status",
  "Issue Date",
  "Location",
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
  successToastMessage,
  highlightedRowId,
  errorMessage,
  onRetry,
  expandedRowIds,
  onToggleExpand,
  actionPermissions,
  onViewRow,
  onMenuAction,
  onOperationalStatusChange,
  drawerOpen = false,
  onDrawerOpenChange,
  drawerData = null,
  drawerQuickLinkEnabled,
  onDrawerQuickLink,
  onDrawerAction,
  drawerRow = null,
  exportBusy,
  exportError,
  exportSuccess,
  onExportExcel,
  onExportCsv,
  embedded = false,
  hideBranchSelector = false,
  hideQuickSearch = false,
  onAddAssetEmpty,
}: AssetInventoryWorkspaceProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const emptyCopy = PRESET_EMPTY_COPY[preset];
  const hasActiveSearch = Boolean(quickSearch.trim() || draftFilters.search.trim());
  const emptyVariant = hasActiveSearch
    ? "no-search"
    : preset === "all"
      ? "no-assets"
      : "no-results";

  const emptyState = (
    <EmptyState
      variant={emptyVariant}
      title={hasActiveSearch ? undefined : emptyCopy.title}
      description={hasActiveSearch ? undefined : emptyCopy.description}
      action={
        !errorMessage && !hasActiveSearch && preset === "all" && onAddAssetEmpty ? (
          <Button
            type="button"
            size="sm"
            className="cursor-pointer"
            onClick={onAddAssetEmpty}
            data-testid="empty-add-asset"
          >
            Add Asset
          </Button>
        ) : null
      }
    />
  );

  const searchAndExport = (
    <div className="flex w-full flex-col gap-3 sm:w-auto sm:min-w-[280px]">
      {!hideQuickSearch ? (
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
      ) : null}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        {!hideBranchSelector ? (
          <BranchSelector
            value={headerBranchId}
            onChange={onHeaderBranchChange}
            branches={branches}
            aria-label="Branch"
          />
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          {onAddAssetEmpty ? (
            <Button
              type="button"
              size="sm"
              className="cursor-pointer"
              onClick={onAddAssetEmpty}
              data-testid="register-add-asset"
            >
              Add Asset
            </Button>
          ) : null}
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
    </div>
  );

  return (
    <div
      className={cn(
        "space-y-4 transition-opacity duration-200 motion-reduce:transition-none md:space-y-5",
        embedded && "space-y-4",
        loading && "opacity-90",
      )}
      data-testid="asset-inventory-workspace"
      data-embedded={embedded ? "true" : "false"}
    >
      {successToastMessage ? (
        <div
          className="fixed top-4 right-4 z-50 rounded-lg border border-primary/20 bg-background px-4 py-3 shadow-lg"
          role="status"
          aria-live="polite"
          data-testid="inventory-success-toast"
        >
          <p className="text-sm font-medium text-foreground">{successToastMessage}</p>
        </div>
      ) : null}
      {embedded ? (
        <div
          className="flex flex-col gap-3 border-b border-border/50 pb-4 sm:flex-row sm:items-end sm:justify-between"
          data-testid="asset-register-section-header"
        >
          <div className="min-w-0 space-y-1">
            <h2 className="text-base font-medium tracking-tight text-foreground">Asset Register</h2>
            <p className="text-xs text-muted-foreground">
              Search, filter, and manage assets in this workspace.
            </p>
          </div>
          {searchAndExport}
        </div>
      ) : (
        <PageHeader
          title="Asset Register"
          description="Manage enterprise asset inventory"
          actions={searchAndExport}
        />
      )}

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
                  {emptyState}
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const expanded = expandedRowIds.has(row.id);
                return (
                  <InventoryTableRow
                    key={row.id}
                    row={row}
                    highlighted={highlightedRowId === row.id}
                    expanded={expanded}
                    onToggleExpand={() => onToggleExpand(row.id)}
                    actionPermissions={actionPermissions}
                    onViewRow={onViewRow}
                    onMenuAction={onMenuAction}
                    onOperationalStatusChange={onOperationalStatusChange}
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
          emptyState
        ) : (
          rows.map((row) => (
            <InventoryMobileCard
              key={row.id}
              row={row}
              highlighted={highlightedRowId === row.id}
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
        actionPermissions={actionPermissions}
        quickLinkEnabled={drawerQuickLinkEnabled}
        onQuickLink={
          drawerRow && onDrawerQuickLink
            ? (link) => onDrawerQuickLink(link, drawerRow)
            : undefined
        }
        onAction={
          drawerRow && onDrawerAction
            ? (action) => onDrawerAction(action, drawerRow)
            : undefined
        }
      />
    </div>
  );
}

function InventoryTableRow({
  row,
  highlighted,
  expanded,
  onToggleExpand,
  actionPermissions,
  onViewRow,
  onMenuAction,
  onOperationalStatusChange,
}: {
  row: InventoryRowViewModel;
  highlighted: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
  actionPermissions?: Partial<InventoryActionPermissions>;
  onViewRow?: (row: InventoryRowViewModel) => void;
  onMenuAction?: (action: InventoryMenuActionId, row: InventoryRowViewModel) => void;
  onOperationalStatusChange?: (
    row: InventoryRowViewModel,
    status: OperationalStatusValue,
  ) => void;
}) {
  const asset = inventoryRowToAssetRef(row);
  const statusValue = isOperationalStatus(row.operationalStatus)
    ? row.operationalStatus
    : undefined;

  return (
    <>
      <tr
        className={cn(
          "cursor-pointer border-t border-border/50 transition-colors duration-200 hover:bg-muted/20",
          highlighted &&
            "border-primary/50 bg-primary/5 shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.18)] motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-300",
        )}
        data-testid="inventory-table-row"
        data-asset-row-id={row.id}
        data-highlighted={highlighted ? "true" : "false"}
        onClick={() => onViewRow?.(row)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onViewRow?.(row);
          }
        }}
        tabIndex={0}
        role="row"
        aria-label={`Open details for ${row.laptopName}`}
      >
        <td className="px-2 py-2">
          <button
            type="button"
            className="cursor-pointer rounded p-1 text-muted-foreground hover:bg-muted"
            aria-expanded={expanded}
            aria-label={expanded ? "Collapse row" : "Expand row"}
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand();
            }}
          >
            {expanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
          </button>
        </td>
        <td className="px-2 py-2 font-mono text-xs">{row.assetTag}</td>
        <td className="px-2 py-2 font-medium">{row.laptopName}</td>
        <td className="px-2 py-2">{row.manufacturer}</td>
        <td className="px-2 py-2">{row.model}</td>
        <td className="max-w-[160px] truncate px-2 py-2 text-muted-foreground" title={row.configuration}>
          {row.configuration}
        </td>
        <td className="px-2 py-2">{row.currentHolder}</td>
        <td className="px-2 py-2 font-mono text-xs">{row.employeeId}</td>
        <td className="px-2 py-2">{row.department}</td>
        <td className="px-2 py-2">{row.branch}</td>
        <td
          className="px-2 py-2"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          {onOperationalStatusChange && statusValue ? (
            <Select
              value={statusValue}
              onValueChange={(value) => {
                if (isOperationalStatus(value)) {
                  onOperationalStatusChange(row, value);
                }
              }}
            >
              <SelectTrigger
                className="h-8 min-w-[9.5rem] cursor-pointer"
                data-testid="inventory-ops-status-select"
                aria-label={`Operational status for ${row.assetTag}`}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OPERATIONAL_STATUS_VALUES.map((status) => (
                  <SelectItem key={status} value={status} className="cursor-pointer">
                    {OPERATIONAL_STATUS_LABELS[status]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : statusValue ? (
            <StatusBadge kind="operational" status={statusValue} />
          ) : (
            row.operationalStatus
          )}
        </td>
        <td className="px-2 py-2">
          <StatusBadge kind="lifecycle" status={row.lifecycleStatus} />
        </td>
        <td className="px-2 py-2 whitespace-nowrap">{row.issueDate}</td>
        <td className="px-2 py-2">{row.location}</td>
        <td
          className="px-2 py-2 text-right"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <InventoryActionMenu
            asset={asset}
            permissions={actionPermissions}
            onView={() => onViewRow?.(row)}
            onMenuAction={(action) => onMenuAction?.(action, row)}
          />
        </td>
      </tr>
      {expanded ? (
        <tr className="border-t border-border/40 bg-muted/10">
          <td colSpan={TABLE_COLUMNS.length + 2} className="px-4 py-3 text-xs text-muted-foreground">
            <dl className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3" data-testid="inventory-expandable-register">
              <div>
                <dt className="font-medium text-foreground">Earlier Used By</dt>
                <dd>{row.expandable.earlierUsedBy}</dd>
              </div>
              <div>
                <dt className="font-medium text-foreground">Delivery Reference</dt>
                <dd>{row.expandable.deliveryChallan}</dd>
              </div>
              <div>
                <dt className="font-medium text-foreground">Delivery Status</dt>
                <dd>{row.expandable.deliveryReferenceStatus}</dd>
              </div>
              <div>
                <dt className="font-medium text-foreground">Phone Number</dt>
                <dd>{row.expandable.phoneNumber}</dd>
              </div>
              <div>
                <dt className="font-medium text-foreground">Assignment Remarks</dt>
                <dd className="whitespace-pre-wrap">{row.expandable.assignmentRemarks}</dd>
              </div>
              <div>
                <dt className="font-medium text-foreground">Return Remarks</dt>
                <dd className="whitespace-pre-wrap">{row.expandable.returnRemarks}</dd>
              </div>
            </dl>
          </td>
        </tr>
      ) : null}
    </>
  );
}

function InventoryMobileCard({
  row,
  highlighted,
  actionPermissions,
  onViewRow,
  onMenuAction,
}: {
  row: InventoryRowViewModel;
  highlighted: boolean;
  actionPermissions?: Partial<InventoryActionPermissions>;
  onViewRow?: (row: InventoryRowViewModel) => void;
  onMenuAction?: (action: InventoryMenuActionId, row: InventoryRowViewModel) => void;
}) {
  const asset = inventoryRowToAssetRef(row);
  return (
    <Card
      className={cn(
        "cursor-pointer border-border/80 shadow-sm transition-colors duration-200 hover:border-primary/25",
        highlighted &&
          "border-primary/50 bg-primary/5 shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.18)] motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-300",
      )}
      data-testid="inventory-mobile-card"
      data-asset-row-id={row.id}
      data-highlighted={highlighted ? "true" : "false"}
      onClick={() => onViewRow?.(row)}
    >
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
          Holder: {row.currentHolder} · {row.branch}
        </p>
        <div
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <InventoryActionMenu
            asset={asset}
            permissions={actionPermissions}
            onView={() => onViewRow?.(row)}
            onMenuAction={(action) => onMenuAction?.(action, row)}
            className="w-full justify-end"
          />
        </div>
      </CardContent>
    </Card>
  );
}
