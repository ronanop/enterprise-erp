/**
 * CR-004 Phase 5B-2B Task 4 — Inventory soft-refresh bridge.
 *
 * Wizards mark inventory stale on success; inventory consumes the flag and
 * reloads list data without a full browser reload.
 *
 * Dashboard KPI cache: none exists — refresh deferred (see Task 4 doc).
 */

const INVENTORY_STALE_KEY = "cr004.inventory.stale";

export type InventoryStalePayload = {
  reason: "issue" | "return";
  assetId?: string;
  at: number;
};

function canUseSessionStorage(): boolean {
  return typeof window !== "undefined" && typeof window.sessionStorage !== "undefined";
}

/** Call from Issue/Return wizard success before navigating to inventory. */
export function markInventoryStale(payload: Omit<InventoryStalePayload, "at">): void {
  if (!canUseSessionStorage()) return;
  const full: InventoryStalePayload = { ...payload, at: Date.now() };
  try {
    window.sessionStorage.setItem(INVENTORY_STALE_KEY, JSON.stringify(full));
  } catch {
    /* private mode / quota — ignore */
  }
}

/** Inventory reads once on mount/focus; clears the flag. */
export function consumeInventoryStale(): InventoryStalePayload | null {
  if (!canUseSessionStorage()) return null;
  try {
    const raw = window.sessionStorage.getItem(INVENTORY_STALE_KEY);
    if (!raw) return null;
    window.sessionStorage.removeItem(INVENTORY_STALE_KEY);
    const parsed = JSON.parse(raw) as InventoryStalePayload;
    if (!parsed || (parsed.reason !== "issue" && parsed.reason !== "return")) return null;
    return parsed;
  } catch {
    try {
      window.sessionStorage.removeItem(INVENTORY_STALE_KEY);
    } catch {
      /* ignore */
    }
    return null;
  }
}

export function peekInventoryStale(): boolean {
  if (!canUseSessionStorage()) return false;
  try {
    return Boolean(window.sessionStorage.getItem(INVENTORY_STALE_KEY));
  } catch {
    return false;
  }
}

export function clearInventoryStale(): void {
  if (!canUseSessionStorage()) return;
  try {
    window.sessionStorage.removeItem(INVENTORY_STALE_KEY);
  } catch {
    /* ignore */
  }
}

export const inventoryRefreshKeys = {
  stale: INVENTORY_STALE_KEY,
} as const;
