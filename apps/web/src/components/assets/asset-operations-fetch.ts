import { BRANCH_ALL_VALUE } from "@/components/assets/shared";
import {
  assetOperationsService,
  type AssetDashboardSummaryDto,
  type AssetPaginatedListResult,
  type AssetTransferPaginatedListResult,
} from "@/services/assets-service";

export type AssetOperationsFetchResult = {
  summary: AssetDashboardSummaryDto | null;
  transfersList: AssetTransferPaginatedListResult | null;
  assetsList: AssetPaginatedListResult | null;
  errors: {
    summary?: string;
    transfers?: string;
    assets?: string;
  };
};

export type AssetOperationsFetcher = typeof fetchAssetOperationsData;

function locationQueryParam(locationId: string): string | undefined {
  return locationId === BRANCH_ALL_VALUE ? undefined : locationId;
}

function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

async function settle<T>(
  promise: Promise<T>,
): Promise<{ ok: true; value: T } | { ok: false; error: string }> {
  try {
    return { ok: true, value: await promise };
  } catch (err) {
    return { ok: false, error: errorMessage(err, "Request failed") };
  }
}

/**
 * Loads dashboard summary and transfer list in parallel.
 * UI filter uses location_id for summary KPIs; transfer list is company-scoped
 * (branch RBAC still applied server-side via ctx).
 */
export async function fetchAssetOperationsData(
  locationId: string,
  deps: {
    getDashboardSummary?: typeof assetOperationsService.getDashboardSummary;
    listTransfers?: typeof assetOperationsService.listTransfers;
    listAssets?: typeof assetOperationsService.listAssets;
  } = {},
): Promise<AssetOperationsFetchResult> {
  const getDashboardSummary =
    deps.getDashboardSummary ?? assetOperationsService.getDashboardSummary.bind(assetOperationsService);
  const listTransfers =
    deps.listTransfers ?? assetOperationsService.listTransfers.bind(assetOperationsService);
  const listAssets =
    deps.listAssets ?? assetOperationsService.listAssets.bind(assetOperationsService);

  const location_id = locationQueryParam(locationId);

  const [summaryRes, transfersRes, assetsRes] = await Promise.all([
    settle(getDashboardSummary(location_id ? { location_id } : {})),
    settle(listTransfers({ page: 1, page_size: 50 })),
    settle(listAssets({ page: 1, page_size: 200 })),
  ]);

  const errors: AssetOperationsFetchResult["errors"] = {};
  if (!summaryRes.ok) errors.summary = summaryRes.error;
  if (!transfersRes.ok) errors.transfers = transfersRes.error;
  if (!assetsRes.ok) errors.assets = assetsRes.error;

  return {
    summary: summaryRes.ok ? summaryRes.value : null,
    transfersList: transfersRes.ok ? transfersRes.value : null,
    assetsList: assetsRes.ok ? assetsRes.value : null,
    errors,
  };
}
