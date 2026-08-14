import { BRANCH_ALL_VALUE } from "@/components/assets/shared";
import {
  assetOperationsService,
  type AssetDashboardSummaryDto,
  type AssetPaginatedListResult,
} from "@/services/assets-service";

export type AssetOperationsFetchResult = {
  summary: AssetDashboardSummaryDto | null;
  readyList: AssetPaginatedListResult | null;
  disposalList: AssetPaginatedListResult | null;
  assignmentsList: AssetPaginatedListResult | null;
  errors: {
    summary?: string;
    ready?: string;
    disposal?: string;
    assignments?: string;
  };
};

export type AssetOperationsFetcher = typeof fetchAssetOperationsData;

function branchQueryParam(branchId: string): string | undefined {
  return branchId === BRANCH_ALL_VALUE ? undefined : branchId;
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
 * Loads dashboard summary, asset queues, and recent assignments in parallel.
 */
export async function fetchAssetOperationsData(
  branchId: string,
  deps: {
    getDashboardSummary?: typeof assetOperationsService.getDashboardSummary;
    listAssets?: typeof assetOperationsService.listAssets;
    listAssignments?: typeof assetOperationsService.listAssignments;
  } = {},
): Promise<AssetOperationsFetchResult> {
  const getDashboardSummary =
    deps.getDashboardSummary ?? assetOperationsService.getDashboardSummary.bind(assetOperationsService);
  const listAssets =
    deps.listAssets ?? assetOperationsService.listAssets.bind(assetOperationsService);
  const listAssignments =
    deps.listAssignments ?? assetOperationsService.listAssignments.bind(assetOperationsService);

  const branch_id = branchQueryParam(branchId);

  const [summaryRes, readyRes, disposalRes, assignmentsRes] = await Promise.all([
    settle(getDashboardSummary(branch_id ? { branch_id } : {})),
    settle(
      listAssets({
        operational_status: "READY_TO_MOVE",
        page_size: 10,
        page: 1,
        branch_id,
      }),
    ),
    settle(
      listAssets({
        operational_status: "PENDING_DISPOSAL",
        page_size: 10,
        page: 1,
        branch_id,
      }),
    ),
    settle(
      listAssignments({
        status: "active",
        page_size: 10,
        page: 1,
        branch_id,
      }),
    ),
  ]);

  const errors: AssetOperationsFetchResult["errors"] = {};
  if (!summaryRes.ok) errors.summary = summaryRes.error;
  if (!readyRes.ok) errors.ready = readyRes.error;
  if (!disposalRes.ok) errors.disposal = disposalRes.error;
  if (!assignmentsRes.ok) errors.assignments = assignmentsRes.error;

  return {
    summary: summaryRes.ok ? summaryRes.value : null,
    readyList: readyRes.ok ? readyRes.value : null,
    disposalList: disposalRes.ok ? disposalRes.value : null,
    assignmentsList: assignmentsRes.ok ? assignmentsRes.value : null,
    errors,
  };
}
