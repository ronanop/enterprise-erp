import { BRANCH_ALL_VALUE } from "@/components/assets/shared";
import {
  assetOperationsService,
  type AssetDashboardSummaryDto,
} from "@/services/assets-service";

export type AssetOperationsFetchResult = {
  summary: AssetDashboardSummaryDto | null;
  errors: {
    summary?: string;
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

/** Loads dashboard KPI summary for the Asset Operations home. */
export async function fetchAssetOperationsData(
  locationId: string,
  deps: {
    getDashboardSummary?: typeof assetOperationsService.getDashboardSummary;
  } = {},
): Promise<AssetOperationsFetchResult> {
  const getDashboardSummary =
    deps.getDashboardSummary ?? assetOperationsService.getDashboardSummary.bind(assetOperationsService);

  const location_id = locationQueryParam(locationId);
  const summaryRes = await settle(getDashboardSummary(location_id ? { location_id } : {}));

  return {
    summary: summaryRes.ok ? summaryRes.value : null,
    errors: summaryRes.ok ? {} : { summary: summaryRes.error },
  };
}
