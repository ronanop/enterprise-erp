import { createElement } from "react";

import { StatusBadge } from "@/components/assets/shared";
import type { QueueCardRow } from "@/components/assets/shared";
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
};

export type AssetOperationsQueueModels = {
  readyRows: QueueCardRow[];
  disposalRows: QueueCardRow[];
  assignmentRows: QueueCardRow[];
};

export type RecentActivityKind =
  | "registered"
  | "assigned"
  | "returned"
  | "disposed"
  | "transfer";

export type RecentActivityItem = {
  id: string;
  kind: RecentActivityKind;
  label: string;
  asset: string;
  employee: string;
  date: string;
  status: string;
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
  };
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

function lifecycleStatus(row: AssetsRow): string {
  const status = row.status;
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
    const status = lifecycleStatus(row);
    return {
      id: assetRowId(row, index),
      cells: [
        assetTag(row),
        assetName(row),
        resolveBranchLabel(row.branch_id, branchLookup),
        createElement(StatusBadge, {
          key: `lifecycle-${assetRowId(row, index)}`,
          kind: "lifecycle",
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

export function mapAssignmentsToActivityRows(list: AssetPaginatedListResult): QueueCardRow[] {
  return list.items.map((row, index) => {
    const id = typeof row.id === "string" && row.id ? row.id : `assignment-${index}`;
    const when =
      formatAssignmentTimestamp(row.allocated_at) !== "—"
        ? formatAssignmentTimestamp(row.allocated_at)
        : formatAssignmentTimestamp(row.returned_at);
    const status = typeof row.status === "string" ? row.status : "Assignment";
    return {
      id,
      cells: [status, assignmentDoc(row) || assignmentAssetRef(row), when],
    };
  });
}

function asLower(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function employeeLabel(row: AssetsRow): string {
  const name = row["employee_name"] ?? row["assignee_name"] ?? row["current_holder"];
  if (typeof name === "string" && name.trim()) return name;
  const id = row["employee_id"];
  if (typeof id === "string" && id.trim()) return id.length > 10 ? `${id.slice(0, 8)}…` : id;
  return "—";
}

function activitySortKey(date: string): string {
  if (!date || date === "—") return "";
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime()) ? date : parsed.toISOString();
}

/**
 * Builds Recent Activity feed (max 10) from existing list APIs — no new backend.
 */
export function mapOperationsPayloadToRecentActivity(input: {
  recentAssets?: AssetPaginatedListResult | null;
  assignmentsList?: AssetPaginatedListResult | null;
  disposalList?: AssetPaginatedListResult | null;
  transferList?: AssetPaginatedListResult | null;
  limit?: number;
}): RecentActivityItem[] {
  const limit = input.limit ?? 10;
  const items: RecentActivityItem[] = [];

  for (const [index, row] of (input.recentAssets?.items ?? []).entries()) {
    const created = formatAssignmentTimestamp(row.created_at ?? row.updated_at);
    items.push({
      id: `reg-${assetRowId(row, index)}`,
      kind: "registered",
      label: "Asset Registered",
      asset: assetTag(row) !== "—" ? assetTag(row) : assetName(row),
      employee: "—",
      date: created,
      status: lifecycleStatus(row),
    });
  }

  for (const [index, row] of (input.assignmentsList?.items ?? []).entries()) {
    const st = asLower(row.status);
    const id = typeof row.id === "string" && row.id ? row.id : `asn-${index}`;
    if (st === "returned") {
      items.push({
        id: `ret-${id}`,
        kind: "returned",
        label: "Asset Returned",
        asset: assignmentDoc(row) || assignmentAssetRef(row),
        employee: employeeLabel(row),
        date: formatAssignmentTimestamp(row.returned_at ?? row.updated_at),
        status: typeof row.status === "string" ? row.status : "returned",
      });
    } else {
      items.push({
        id: `asn-${id}`,
        kind: "assigned",
        label: "Asset Assigned",
        asset: assignmentDoc(row) || assignmentAssetRef(row),
        employee: employeeLabel(row),
        date: formatAssignmentTimestamp(row.allocated_at ?? row.created_at),
        status: typeof row.status === "string" ? row.status : "assigned",
      });
    }
  }

  for (const [index, row] of (input.disposalList?.items ?? []).entries()) {
    const ops = asLower(row.operational_status);
    const life = asLower(row.status);
    const disposed = ops === "disposed" || life === "disposed";
    items.push({
      id: `disp-${assetRowId(row, index)}`,
      kind: "disposed",
      label: disposed ? "Asset Disposed" : "Asset Disposed",
      asset: assetTag(row) !== "—" ? assetTag(row) : assetName(row),
      employee: "—",
      date: formatAssignmentTimestamp(row.updated_at ?? row.created_at),
      status: disposed
        ? "disposed"
        : typeof row.operational_status === "string"
          ? row.operational_status
          : lifecycleStatus(row),
    });
  }

  for (const [index, row] of (input.transferList?.items ?? []).entries()) {
    const id = typeof row.id === "string" && row.id ? row.id : `xfer-${index}`;
    items.push({
      id: `xfer-${id}`,
      kind: "transfer",
      label: "Asset Transfer",
      asset:
        (typeof row.document_number === "string" && row.document_number) ||
        assignmentAssetRef(row) ||
        "—",
      employee: employeeLabel(row),
      date: formatAssignmentTimestamp(row.updated_at ?? row.created_at ?? row["transferred_at"]),
      status: typeof row.status === "string" ? row.status : "transfer",
    });
  }

  return items
    .sort((a, b) => activitySortKey(b.date).localeCompare(activitySortKey(a.date)))
    .slice(0, limit);
}

export function mapDashboardPayloadToViewModel(input: {
  summary: AssetDashboardSummaryDto;
  readyList: AssetPaginatedListResult;
  disposalList: AssetPaginatedListResult;
  assignmentsList: AssetPaginatedListResult;
  branchLookup: BranchLabelLookup;
}): {
  kpis: AssetOperationsKpiModel;
  queues: AssetOperationsQueueModels;
} {
  return {
    kpis: mapDashboardSummaryToKpis(input.summary),
    queues: {
      readyRows: mapAssetListToReadyQueueRows(input.readyList, input.branchLookup),
      disposalRows: mapAssetListToDisposalQueueRows(input.disposalList, input.branchLookup),
      assignmentRows: mapAssignmentsToActivityRows(input.assignmentsList),
    },
  };
}

export function branchLookupFromOptions(
  branches: Array<{ id: string; label: string }>,
): BranchLabelLookup {
  return Object.fromEntries(branches.map((b) => [b.id, b.label]));
}
