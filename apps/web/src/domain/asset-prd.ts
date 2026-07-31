/**
 * PRD v1.0 presentation mapping over FP-ASSET backend statuses.
 */

import type { AssetsRow } from "@/services/assets-service";

export type PrdAssetStatus =
  | "available"
  | "assigned"
  | "reserved"
  | "under_maintenance"
  | "lost"
  | "disposed";

export const PRD_STATUS_LABELS: Record<PrdAssetStatus, string> = {
  available: "Available",
  assigned: "Assigned",
  reserved: "Reserved",
  under_maintenance: "Under Maintenance",
  lost: "Lost",
  disposed: "Disposed",
};

export type AssignmentLike = {
  asset_id?: string | null;
  status?: string | null;
};

function asLower(value: unknown): string {
  return typeof value === "string" ? value.toLowerCase() : "";
}

export function isActiveAssignment(row: AssignmentLike): boolean {
  const s = asLower(row.status);
  return s === "active" || s === "approved";
}

export function mapAssetToPrdStatus(
  asset: AssetsRow,
  assignments: AssignmentLike[] = [],
): PrdAssetStatus {
  const backend = asLower(asset.status);
  const assetId = String(asset.id ?? "");

  if (backend === "disposed" || backend === "written_off") {
    return "disposed";
  }
  if (backend === "in_maintenance") {
    return "under_maintenance";
  }
  if (backend === "cancelled") {
    return "lost";
  }
  if (backend === "submitted" || backend === "approved") {
    return "reserved";
  }

  const hasActive = assignments.some(
    (a) => String(a.asset_id ?? "") === assetId && isActiveAssignment(a),
  );
  if (hasActive) {
    return "assigned";
  }

  if (backend === "active" || backend === "transferred" || backend === "draft") {
    return backend === "draft" ? "reserved" : "available";
  }

  return "available";
}

export function prdStatusLabel(status: PrdAssetStatus): string {
  return PRD_STATUS_LABELS[status];
}

export function isItAssetCategory(
  categoryCode?: string | null,
  categoryName?: string | null,
): boolean {
  const code = (categoryCode ?? "").toUpperCase();
  const name = (categoryName ?? "").toLowerCase();
  return (
    code.startsWith("IT") ||
    code.includes("HW") ||
    name.includes("it ") ||
    name.includes("hardware") ||
    name.includes("computer")
  );
}

export type DiscoveryProfile = {
  hostname?: string;
  manufacturer?: string;
  model?: string;
  os_name?: string;
  cpu?: string;
  ram?: string;
  mac_address?: string;
};

export function parseDiscoveryProfile(asset: AssetsRow): DiscoveryProfile | null {
  const raw = asset.discovery_profile_json ?? asset.discovery_profile;
  if (!raw || typeof raw !== "object") return null;
  return raw as DiscoveryProfile;
}

export function brandModelLabel(asset: AssetsRow): string {
  const profile = parseDiscoveryProfile(asset);
  if (!profile) return "—";
  const parts = [profile.manufacturer, profile.model].filter(Boolean);
  return parts.length ? parts.join(" ") : "—";
}

export type PrdActivityItem = {
  id: string;
  kind: "created" | "assigned" | "returned" | "maintenance_completed";
  title: string;
  at: string;
  assetLabel?: string;
};

export function buildRecentActivity(
  assets: AssetsRow[],
  assignments: AssetsRow[],
  maintenances: AssetsRow[],
  limit = 8,
): PrdActivityItem[] {
  const items: PrdActivityItem[] = [];

  for (const a of assets) {
    const at = String(a.updated_at ?? a.created_at ?? "");
    if (!at) continue;
    items.push({
      id: `asset-${a.id}`,
      kind: "created",
      title: "Asset created",
      at,
      assetLabel: String(a.asset_name ?? a.asset_code ?? ""),
    });
  }

  for (const asn of assignments) {
    const at = String(asn.updated_at ?? asn.created_at ?? asn.allocated_at ?? "");
    const st = asLower(asn.status);
    if (!at) continue;
    if (st === "returned") {
      items.push({
        id: `asn-ret-${asn.id}`,
        kind: "returned",
        title: "Asset returned",
        at,
        assetLabel: String(asn.document_number ?? ""),
      });
    } else if (st === "active" || st === "approved") {
      items.push({
        id: `asn-${asn.id}`,
        kind: "assigned",
        title: "Asset assigned",
        at,
        assetLabel: String(asn.document_number ?? ""),
      });
    }
  }

  for (const m of maintenances) {
    const st = asLower(m.status);
    if (st !== "completed") continue;
    const at = String(m.updated_at ?? m.completed_at ?? m.scheduled_date ?? "");
    if (!at) continue;
    items.push({
      id: `maint-${m.id}`,
      kind: "maintenance_completed",
      title: "Maintenance completed",
      at,
      assetLabel: String(m.document_number ?? ""),
    });
  }

  return items
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, limit);
}

export const ASSET_MANAGEMENT_DASHBOARD_PATHS = [
  "/assets/asset-categories",
  "/assets/assets",
  "/assets/asset-assignments",
  "/assets/asset-maintenances",
] as const;
