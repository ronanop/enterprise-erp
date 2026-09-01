import type { CrmApprovalInboxItem } from "@/services/sales-crm-service";

const SURFACE_DISMISSED_KEY = "crm_approval_surface_dismissed";
const LEGACY_DISMISSED_KEY = "crm_approval_notifications_dismissed";
const POPUP_SEEN_KEY = "crm_approval_popup_seen";

export const CRM_APPROVAL_SURFACE_DISMISS_EVENT = "erp:crm-approval-surface-dismiss";

export type CrmApprovalSurfaceDismissDetail = {
  id: string;
  entityType?: string;
  entityId?: string;
};

function readIdSet(key: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(key);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

function writeIdSet(key: string, ids: Set<string>) {
  try {
    localStorage.setItem(key, JSON.stringify([...ids].slice(-500)));
  } catch {
    /* Storage is optional; in-memory UI still updates. */
  }
}

function entityFromRow(row: CrmApprovalInboxItem): { type: string; id: string } {
  return {
    type: String(row.payload_json?.entity_type ?? ""),
    id: String(row.payload_json?.entity_id ?? ""),
  };
}

/** IDs hidden from banner/toast surfaces (still visible in the bell until marked read). */
export function readSurfaceDismissedCrmApprovalIds(): Set<string> {
  const surface = readIdSet(SURFACE_DISMISSED_KEY);
  for (const id of readIdSet(LEGACY_DISMISSED_KEY)) surface.add(id);
  return surface;
}

export function readCrmApprovalPopupSeenIds(): Set<string> {
  return readIdSet(POPUP_SEEN_KEY);
}

export function markCrmApprovalPopupSeen(ids: Iterable<string>): void {
  const seen = readCrmApprovalPopupSeenIds();
  for (const id of ids) seen.add(id);
  writeIdSet(POPUP_SEEN_KEY, seen);
}

export function isCrmApprovalSurfaceDismissed(row: CrmApprovalInboxItem): boolean {
  return readSurfaceDismissedCrmApprovalIds().has(row.id);
}

/** Hide all unread rejection alerts for the same CRM record (prevents duplicate re-popup). */
export function dismissCrmApprovalSurface(
  row: CrmApprovalInboxItem,
  relatedRows: CrmApprovalInboxItem[] = [],
): void {
  const dismissed = readSurfaceDismissedCrmApprovalIds();
  const entity = entityFromRow(row);
  const toDismiss = new Set<string>([row.id]);

  for (const candidate of relatedRows) {
    if (candidate.event_type !== "crm.approval.rejected") continue;
    if (candidate.id === row.id) {
      toDismiss.add(candidate.id);
      continue;
    }
    if (!entity.type || !entity.id) continue;
    const other = entityFromRow(candidate);
    if (other.type === entity.type && other.id === entity.id && !candidate.read_at) {
      toDismiss.add(candidate.id);
    }
  }

  let changed = false;
  for (const id of toDismiss) {
    if (!dismissed.has(id)) {
      dismissed.add(id);
      changed = true;
    }
  }
  if (!changed) return;

  writeIdSet(SURFACE_DISMISSED_KEY, dismissed);
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent<CrmApprovalSurfaceDismissDetail>(CRM_APPROVAL_SURFACE_DISMISS_EVENT, {
        detail: {
          id: row.id,
          entityType: entity.type || undefined,
          entityId: entity.id || undefined,
        },
      }),
    );
  }
}

/** Keep only the latest rejection per CRM entity for banner/toast display. */
export function dedupeCrmRejectionsByEntity(rows: CrmApprovalInboxItem[]): CrmApprovalInboxItem[] {
  const latest = new Map<string, CrmApprovalInboxItem>();
  const orphans: CrmApprovalInboxItem[] = [];

  for (const row of rows) {
    const entity = entityFromRow(row);
    if (!entity.type || !entity.id) {
      orphans.push(row);
      continue;
    }
    const key = `${entity.type}:${entity.id}`;
    const existing = latest.get(key);
    if (!existing) {
      latest.set(key, row);
      continue;
    }
    const a = existing.created_at ?? "";
    const b = row.created_at ?? "";
    if (b >= a) latest.set(key, row);
  }

  return [...latest.values(), ...orphans];
}

/** @deprecated Use dismissCrmApprovalSurface */
export function dismissCrmApproval(id: string): void {
  dismissCrmApprovalSurface({
    id,
    event_type: "crm.approval.rejected",
    status: "",
    created_at: null,
    payload_json: null,
  });
}

/** @deprecated Use readSurfaceDismissedCrmApprovalIds */
export function readDismissedCrmApprovalIds(): Set<string> {
  return readSurfaceDismissedCrmApprovalIds();
}

/** Repair legacy UTF-8 text decoded with a Windows code page. */
export function normalizeNotificationText(value: string): string {
  return value
    .replaceAll("ΓÇö", "—")
    .replaceAll("â€”", "—")
    .replaceAll("Â", "");
}
