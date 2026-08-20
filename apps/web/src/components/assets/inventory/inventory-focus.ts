const FOCUS_ASSET_KEY = "cr004.assignment.focusAssetId";

export function stashInventoryFocusAsset(assetId: string | undefined): void {
  if (typeof window === "undefined" || !assetId?.trim()) return;
  try {
    window.sessionStorage.setItem(FOCUS_ASSET_KEY, assetId.trim());
  } catch {
    /* ignore */
  }
}

export function consumeInventoryFocusAsset(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const id = window.sessionStorage.getItem(FOCUS_ASSET_KEY);
    window.sessionStorage.removeItem(FOCUS_ASSET_KEY);
    return id;
  } catch {
    return null;
  }
}
