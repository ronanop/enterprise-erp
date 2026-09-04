import { createElement } from "react";

import { StatusBadge } from "@/components/assets/shared";
import type { QueueCardRow, StatCardTrend } from "@/components/assets/shared";
import type {
  AssetDashboardSummaryDto,
  AssetPaginatedListResult,
  AssetsRow,
} from "@/services/assets-service";

export type AssetOperationsKpiModel = {
  totalAssets: number;
  readyToMove: number;
  assigned: number;
  retired: number;
  pendingDisposal: number;
  disposed: number;
  inUseAsComponent: number;
};

export type AssetOperationsKpiTrends = {
  readyToMove?: StatCardTrend;
  assigned?: StatCardTrend;
  retired?: StatCardTrend;
  pendingDisposal?: StatCardTrend;
  disposed?: StatCardTrend;
  inUseAsComponent?: StatCardTrend;
};

export type AssetOperationsQueueModels = {
  readyRows: QueueCardRow[];
  disposalRows: QueueCardRow[];
  assignmentRows: QueueCardRow[];
};

export type AssetOperationsQueueTotals = {
  ready: number;
  disposal: number;
  assignments: number;
};

export type BranchBreakdownRow = {
  branchId: string;
  label: string;
  totalAssets: number;
  readyToMove: number;
  assigned: number;
  retired: number;
  pendingDisposal: number;
  disposed: number;
  inUseAsComponent: number;
};

export type LocationBreakdownRow = {
  locationId: string;
  label: string;
  totalAssets: number;
  readyToMove: number;
  assigned: number;
  retired: number;
  pendingDisposal: number;
  disposed: number;
  inUseAsComponent: number;
};

export type DashboardTransferRow = {
  id: string;
  documentNumber: string;
  assetId: string;
  assetCode: string;
  assetName: string;
  fromLocation: string;
  toLocation: string;
  fromBranchId: string | null;
  toBranchId: string | null;
  effectiveDate: string | null;
  reason: string | null;
  status: string;
  workflowStatus: string | null;
};

export type BranchLabelLookup = Record<string, string>;

export function resolveBranchLabel(
  branchId: unknown,
  lookup: BranchLabelLookup,
): string {
  if (branchId == null || branchId === "") return "—";
  const key = String(branchId);
  return lookup[key] ?? key.slice(0, 8);
}

/** Client-side share of fleet total — does not change KPI count calculations. */
export function kpiShareOfTotal(count: number, total: number): StatCardTrend | undefined {
  if (total <= 0) return undefined;
  const pct = Math.round((count / total) * 100);
  return {
    label: `${pct}% of total`,
    direction: "neutral",
  };
}

export function mapDashboardSummaryToKpis(
  summary: AssetDashboardSummaryDto,
): AssetOperationsKpiModel {
  return {
    totalAssets: summary.total_assets ?? 0,
    readyToMove: summary.ready_to_move ?? 0,
    assigned: summary.assigned ?? 0,
    retired: summary.retired ?? 0,
    pendingDisposal: summary.pending_disposal ?? 0,
    disposed: summary.disposed ?? 0,
    inUseAsComponent: summary.in_use_as_component ?? 0,
  };
}

export function mapDashboardSummaryToKpiTrends(
  kpis: AssetOperationsKpiModel,
): AssetOperationsKpiTrends {
  const total = kpis.totalAssets;
  return {
    readyToMove: kpiShareOfTotal(kpis.readyToMove, total),
    assigned: kpiShareOfTotal(kpis.assigned, total),
    retired: kpiShareOfTotal(kpis.retired, total),
    pendingDisposal: kpiShareOfTotal(kpis.pendingDisposal, total),
    disposed: kpiShareOfTotal(kpis.disposed, total),
    inUseAsComponent: kpiShareOfTotal(kpis.inUseAsComponent, total),
  };
}

export function mapByBranchBreakdown(
  summary: AssetDashboardSummaryDto,
  lookup: BranchLabelLookup,
): BranchBreakdownRow[] {
  const rows = summary.by_branch ?? [];
  return rows.map((b) => ({
    branchId: String(b.branch_id),
    label: resolveBranchLabel(b.branch_id, lookup),
    totalAssets: b.total_assets ?? 0,
    readyToMove: b.ready_to_move ?? 0,
    assigned: b.assigned ?? 0,
    retired: b.retired ?? 0,
    pendingDisposal: b.pending_disposal ?? 0,
    disposed: b.disposed ?? 0,
    inUseAsComponent: b.in_use_as_component ?? 0,
  }));
}

export function mapByLocationBreakdown(
  summary: AssetDashboardSummaryDto,
): LocationBreakdownRow[] {
  const rows = summary.by_location ?? [];
  return rows.map((row) => ({
    locationId: String(row.location_id),
    label: row.label || String(row.location_id).slice(0, 8),
    totalAssets: row.total_assets ?? 0,
    readyToMove: row.ready_to_move ?? 0,
    assigned: row.assigned ?? 0,
    retired: row.retired ?? 0,
    pendingDisposal: row.pending_disposal ?? 0,
    disposed: row.disposed ?? 0,
    inUseAsComponent: row.in_use_as_component ?? 0,
  }));
}

function assetRowId(row: AssetsRow, index: number): string {
  const id = row.id;
  if (typeof id === "string" && id) return id;
  return `asset-row-${index}`;
}

function assetTag(row: AssetsRow): string {
  const code = row.asset_code;
  if (typeof code === "string" && code.trim()) return code;
  const doc = row.document_number;
  if (typeof doc === "string" && doc.trim()) return doc;
  return "—";
}

function assetName(row: AssetsRow): string {
  const name = row.asset_name;
  return typeof name === "string" && name.trim() ? name : "—";
}

function operationalStatus(row: AssetsRow): string {
  const status = row.operational_status;
  return typeof status === "string" && status.trim() ? status : "unknown";
}

export function mapAssetListToReadyQueueRows(
  list: AssetPaginatedListResult,
  branchLookup: BranchLabelLookup,
): QueueCardRow[] {
  return list.items.map((row, index) => ({
    id: assetRowId(row, index),
    cells: [
      assetTag(row),
      assetName(row),
      resolveBranchLabel(row.branch_id, branchLookup),
    ],
  }));
}

export function mapAssetListToDisposalQueueRows(
  list: AssetPaginatedListResult,
  branchLookup: BranchLabelLookup,
): QueueCardRow[] {
  return list.items.map((row, index) => {
    const status = operationalStatus(row);
    return {
      id: assetRowId(row, index),
      cells: [
        assetTag(row),
        assetName(row),
        resolveBranchLabel(row.branch_id, branchLookup),
        createElement(StatusBadge, {
          key: `ops-${assetRowId(row, index)}`,
          kind: "operational",
          status,
        }),
      ],
    };
  });
}

export function formatAssignmentTimestamp(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function assignmentDoc(row: AssetsRow): string {
  const doc = row.document_number;
  if (typeof doc === "string" && doc.trim()) return doc;
  return "—";
}

function assignmentAssetRef(row: AssetsRow): string {
  const assetId = row.asset_id;
  if (typeof assetId === "string" && assetId) {
    return assetId.length > 12 ? `${assetId.slice(0, 8)}…` : assetId;
  }
  return "—";
}

/** Prefer allocation time for active assignments; return time for returned; else fall back. */
export function resolveAssignmentActivityWhen(row: AssetsRow): string {
  const status = typeof row.status === "string" ? row.status : "";
  if (status === "returned") {
    const returned = formatAssignmentTimestamp(row.returned_at);
    if (returned !== "—") return returned;
  }
  const allocated = formatAssignmentTimestamp(row.allocated_at);
  if (allocated !== "—") return allocated;
  if (status !== "returned") {
    const returned = formatAssignmentTimestamp(row.returned_at);
    if (returned !== "—") return returned;
  }
  return formatAssignmentTimestamp(row.created_at);
}

export function mapAssignmentsToActivityRows(list: AssetPaginatedListResult): QueueCardRow[] {
  return list.items.map((row, index) => {
    const id = typeof row.id === "string" && row.id ? row.id : `assignment-${index}`;
    const status = typeof row.status === "string" ? row.status : "Assignment";
    return {
      id,
      cells: [status, assignmentDoc(row) || assignmentAssetRef(row), resolveAssignmentActivityWhen(row)],
    };
  });
}

export function mapTransfersToDashboardRows(
  transfers: { items: Array<Record<string, unknown>> },
  assets: AssetPaginatedListResult,
): DashboardTransferRow[] {
  const assetMap = new Map(
    assets.items.map((row) => [
      String(row.id ?? ""),
      {
        code: String(row.asset_code ?? ""),
        name: String(row.asset_name ?? ""),
      },
    ]),
  );

  return transfers.items.map((row, index) => {
    const assetId = String(row.asset_id ?? "");
    const asset = assetMap.get(assetId);
    return {
      id: typeof row.id === "string" && row.id ? row.id : `transfer-${index}`,
      documentNumber: String(row.document_number ?? "—"),
      assetId,
      assetCode: asset?.code || "—",
      assetName: asset?.name || assetId.slice(0, 8) || "Unresolved asset",
      fromLocation: String(row.from_location_label ?? "—"),
      toLocation: String(row.to_location_label ?? "—"),
      fromBranchId: row.from_branch_id != null ? String(row.from_branch_id) : null,
      toBranchId: row.to_branch_id != null ? String(row.to_branch_id) : null,
      effectiveDate: row.effective_date != null ? String(row.effective_date) : null,
      reason: row.reason != null ? String(row.reason) : null,
      status: String(row.status ?? "draft"),
      workflowStatus: row.workflow_status != null ? String(row.workflow_status) : null,
    };
  });
}

export function mapDashboardPayloadToViewModel(input: {
  summary: AssetDashboardSummaryDto;
  readyList: AssetPaginatedListResult;
  disposalList: AssetPaginatedListResult;
  assignmentsList: AssetPaginatedListResult;
  branchLookup: BranchLabelLookup;
}): {
  kpis: AssetOperationsKpiModel;
  kpiTrends: AssetOperationsKpiTrends;
  queues: AssetOperationsQueueModels;
  queueTotals: AssetOperationsQueueTotals;
  byBranch: BranchBreakdownRow[];
  byLocation: LocationBreakdownRow[];
} {
  const kpis = mapDashboardSummaryToKpis(input.summary);
  return {
    kpis,
    kpiTrends: mapDashboardSummaryToKpiTrends(kpis),
    queues: {
      readyRows: mapAssetListToReadyQueueRows(input.readyList, input.branchLookup),
      disposalRows: mapAssetListToDisposalQueueRows(input.disposalList, input.branchLookup),
      assignmentRows: mapAssignmentsToActivityRows(input.assignmentsList),
    },
    queueTotals: {
      ready: input.readyList.total ?? input.readyList.items.length,
      disposal: input.disposalList.total ?? input.disposalList.items.length,
      assignments: input.assignmentsList.total ?? input.assignmentsList.items.length,
    },
    byBranch: mapByBranchBreakdown(input.summary, input.branchLookup),
    byLocation: mapByLocationBreakdown(input.summary),
  };
}

export function branchLookupFromOptions(
  branches: Array<{ id: string; label: string }>,
): BranchLabelLookup {
  return Object.fromEntries(branches.map((b) => [b.id, b.label]));
}
