/**
 * CR-004 Phase 7A — Inventory register export service.
 *
 * Workspace → Container → this service → inventory mapper → CSV/XLSX
 * Reuses existing listAssets / listAssignments read APIs (paginated; max page_size 200).
 */

import {
  buildInventoryListQuery,
  groupAssignmentsByAssetId,
  indexActiveAssignments,
  mapAssetsToInventoryRows,
  type InventoryLookupContext,
  type InventoryRowViewModel,
} from "@/components/assets/inventory.mapper";
import type { InventoryPresetId } from "@/components/assets/inventory.types";
import {
  buildInventoryExportFilename,
  triggerInventoryDownload,
  type DownloadBlobFn,
} from "@/components/assets/inventory/export/inventory-export.helpers";
import { mapInventoryRowsToExportRows } from "@/components/assets/inventory/export/inventory-export.mapper";
import {
  INVENTORY_EXPORT_API_PAGE_SIZE,
  InventoryExportError,
  type InventoryExportFormat,
  type InventoryExportResult,
} from "@/components/assets/inventory/export/inventory-export.types";
import type { InventoryFilterValues } from "@/components/assets/shared";
import type { AssetPaginatedListResult, AssetsRow } from "@/services/assets-service";
import { assetOperationsService } from "@/services/assets-service";

export type InventoryExportListAssets = (
  params: Parameters<typeof assetOperationsService.listAssets>[0],
) => Promise<AssetPaginatedListResult>;

export type InventoryExportListAssignments = (
  params: Parameters<typeof assetOperationsService.listAssignments>[0],
) => Promise<AssetPaginatedListResult>;

export type InventoryExportLookupContext = Omit<
  InventoryLookupContext,
  "assignmentsByAssetId" | "assignmentHistoryByAssetId"
>;

export type ExportInventoryRegisterInput = {
  format: InventoryExportFormat;
  preset: InventoryPresetId;
  filters: InventoryFilterValues;
  headerLocationId: string;
  lookup: InventoryExportLookupContext;
  /** Allow empty file with headers only (default true). */
  allowEmpty?: boolean;
  stamp?: Date;
  download?: DownloadBlobFn;
  deps?: {
    listAssets?: InventoryExportListAssets;
    listAssignments?: InventoryExportListAssignments;
  };
};

/** Paginate assignments within the API `page_size` cap (200). */
export async function fetchAllAssignmentPages(
  listAssignments: InventoryExportListAssignments,
  branch_id: string | undefined,
): Promise<AssetsRow[]> {
  const pageSize = INVENTORY_EXPORT_API_PAGE_SIZE;
  const all: AssetsRow[] = [];
  let page = 1;
  let total = Infinity;

  while (all.length < total) {
    const res = await listAssignments({
      page,
      page_size: pageSize,
      branch_id,
    });
    total = res.total;
    all.push(...res.items);
    if (res.items.length === 0 || res.items.length < pageSize) break;
    page += 1;
    if (page > 500) break;
  }
  return all;
}

/**
 * Fetches every asset page matching server-side inventory filters, then applies
 * Phase 5F: filters are applied server-side via GET /assets query params.
 * Pagination note: asset module caps `page_size` at 200 — no new API; we loop pages.
 */
export async function fetchAllInventoryRowsForExport(input: {
  preset: InventoryPresetId;
  filters: InventoryFilterValues;
  headerLocationId: string;
  lookup: InventoryExportLookupContext;
  deps?: {
    listAssets?: InventoryExportListAssets;
    listAssignments?: InventoryExportListAssignments;
  };
}): Promise<InventoryRowViewModel[]> {
  const listAssets =
    input.deps?.listAssets ?? assetOperationsService.listAssets.bind(assetOperationsService);
  const listAssignments =
    input.deps?.listAssignments ??
    assetOperationsService.listAssignments.bind(assetOperationsService);

  let assignmentItems: AssetsRow[];
  try {
    assignmentItems = await fetchAllAssignmentPages(listAssignments, undefined);
  } catch (err) {
    throw new InventoryExportError(
      "fetch_failed",
      err instanceof Error ? err.message : "Failed to load assignments for export",
    );
  }

  const assignmentsByAssetId = indexActiveAssignments(assignmentItems);
  const assignmentHistoryByAssetId = groupAssignmentsByAssetId(assignmentItems);
  const lookupCtx: InventoryLookupContext = {
    ...input.lookup,
    assignmentsByAssetId,
    assignmentHistoryByAssetId,
  };

  const pageSize = INVENTORY_EXPORT_API_PAGE_SIZE;
  const allAssets: AssetsRow[] = [];
  let page = 1;
  let total = Infinity;

  try {
    while (allAssets.length < total) {
      const query = buildInventoryListQuery({
        preset: input.preset,
        filters: input.filters,
        headerLocationId: input.headerLocationId,
        page,
        pageSize,
      });
      const res = await listAssets(query);
      total = res.total;
      allAssets.push(...res.items);
      if (res.items.length === 0 || res.items.length < pageSize) break;
      page += 1;
      if (page > 500) break;
    }
  } catch (err) {
    throw new InventoryExportError(
      "fetch_failed",
      err instanceof Error ? err.message : "Failed to load assets for export",
    );
  }

  const mapped = mapAssetsToInventoryRows(allAssets, lookupCtx);
  return mapped;
}

export async function exportInventoryRegister(
  input: ExportInventoryRegisterInput,
): Promise<InventoryExportResult> {
  const rows = await fetchAllInventoryRowsForExport({
    preset: input.preset,
    filters: input.filters,
    headerLocationId: input.headerLocationId,
    lookup: input.lookup,
    deps: input.deps,
  });

  const allowEmpty = input.allowEmpty !== false;
  if (rows.length === 0 && !allowEmpty) {
    throw new InventoryExportError("empty", "No inventory rows match the current filters");
  }

  const exportRows = mapInventoryRowsToExportRows(rows);
  const filename = buildInventoryExportFilename(input.format, input.stamp ?? new Date());

  triggerInventoryDownload(input.format, exportRows, filename, input.download);

  return {
    format: input.format,
    filename,
    rowCount: exportRows.length,
  };
}

export const inventoryExportService = {
  exportInventoryRegister,
  fetchAllInventoryRowsForExport,
  buildFilename: buildInventoryExportFilename,
};
