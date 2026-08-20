import { BRANCH_ALL_VALUE } from "@/components/assets/shared";
import { resourceService } from "@/services/api-client";
import {
  assetOperationsService,
  type AssetDashboardSummaryDto,
  type AssetPaginatedListResult,
  type AssetsRow,
} from "@/services/assets-service";

export type AssetOperationsFetchResult = {
  summary: AssetDashboardSummaryDto | null;
  readyList: AssetPaginatedListResult | null;
  disposalList: AssetPaginatedListResult | null;
  assignmentsList: AssetPaginatedListResult | null;
  recentAssets: AssetPaginatedListResult | null;
  transferList: AssetPaginatedListResult | null;
  errors: {
    summary?: string;
    ready?: string;
    disposal?: string;
    assignments?: string;
    recentAssets?: string;
    transfers?: string;
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

function normalizeTransferList(data: unknown): AssetPaginatedListResult {
  if (data && typeof data === "object" && Array.isArray((data as AssetPaginatedListResult).items)) {
    const list = data as AssetPaginatedListResult;
    return {
      items: list.items,
      total: list.total ?? list.items.length,
      page: list.page ?? 1,
      page_size: list.page_size ?? list.items.length,
    };
  }
  if (Array.isArray(data)) {
    return { items: data as AssetsRow[], total: data.length, page: 1, page_size: data.length };
  }
  return { items: [], total: 0, page: 1, page_size: 10 };
}

async function listTransfers(params: {
  page?: number;
  page_size?: number;
  branch_id?: string;
}): Promise<AssetPaginatedListResult> {
  const query: Record<string, string | number> = {
    page: params.page ?? 1,
    page_size: params.page_size ?? 10,
  };
  if (params.branch_id) query.branch_id = params.branch_id;
  const res = await resourceService.list("/assets/asset-transfers", query);
  return normalizeTransferList(res.data);
}

/**
 * Loads dashboard summary, queues, recent assets/assignments/transfers in parallel.
 */
export async function fetchAssetOperationsData(
  branchId: string,
  deps: {
    getDashboardSummary?: typeof assetOperationsService.getDashboardSummary;
    listAssets?: typeof assetOperationsService.listAssets;
    listAssignments?: typeof assetOperationsService.listAssignments;
    listTransfers?: typeof listTransfers;
  } = {},
): Promise<AssetOperationsFetchResult> {
  const getDashboardSummary =
    deps.getDashboardSummary ?? assetOperationsService.getDashboardSummary.bind(assetOperationsService);
  const listAssets =
    deps.listAssets ?? assetOperationsService.listAssets.bind(assetOperationsService);
  const listAssignments =
    deps.listAssignments ?? assetOperationsService.listAssignments.bind(assetOperationsService);
  const transfers = deps.listTransfers ?? listTransfers;

  const branch_id = branchQueryParam(branchId);

  const [summaryRes, readyRes, disposalRes, assignmentsRes, recentRes, transferRes] =
    await Promise.all([
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
          page_size: 10,
          page: 1,
          branch_id,
        }),
      ),
      settle(
        listAssets({
          page_size: 10,
          page: 1,
          branch_id,
        }),
      ),
      settle(
        transfers({
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
  if (!recentRes.ok) errors.recentAssets = recentRes.error;
  if (!transferRes.ok) errors.transfers = transferRes.error;

  return {
    summary: summaryRes.ok ? summaryRes.value : null,
    readyList: readyRes.ok ? readyRes.value : null,
    disposalList: disposalRes.ok ? disposalRes.value : null,
    assignmentsList: assignmentsRes.ok ? assignmentsRes.value : null,
    recentAssets: recentRes.ok ? recentRes.value : null,
    transferList: transferRes.ok ? transferRes.value : null,
    errors,
  };
}
