const INVENTORY_ARRIVAL_KEY = "cr006.inventory.arrival";

export type InventoryArrivalReason = "register" | "issue" | "return";

export type InventoryArrivalPayload = {
  reason: InventoryArrivalReason;
  assetId: string;
  toastMessage: string;
  at: number;
};

function canUseSessionStorage(): boolean {
  return typeof window !== "undefined" && typeof window.sessionStorage !== "undefined";
}

export function buildAllocationSuccessToast(employeeLabel?: string | null): string {
  const name = employeeLabel?.trim();
  if (name) return `Asset successfully allocated to ${name}.`;
  return "Asset successfully allocated.";
}

export function buildReturnSuccessToast(assetName?: string | null): string {
  const name = assetName?.trim();
  if (name && name !== "—") return `${name} returned successfully.`;
  return "Asset returned successfully.";
}

export function stashInventoryArrival(
  payload: Omit<InventoryArrivalPayload, "at">,
): void {
  if (!canUseSessionStorage()) return;
  try {
    window.sessionStorage.setItem(
      INVENTORY_ARRIVAL_KEY,
      JSON.stringify({ ...payload, at: Date.now() } satisfies InventoryArrivalPayload),
    );
  } catch {
    /* ignore */
  }
}

export function consumeInventoryArrival(): InventoryArrivalPayload | null {
  if (!canUseSessionStorage()) return null;
  try {
    const raw = window.sessionStorage.getItem(INVENTORY_ARRIVAL_KEY);
    if (!raw) return null;
    window.sessionStorage.removeItem(INVENTORY_ARRIVAL_KEY);
    const parsed = JSON.parse(raw) as Partial<InventoryArrivalPayload> | null;
    if (
      !parsed ||
      (parsed.reason !== "register" &&
        parsed.reason !== "issue" &&
        parsed.reason !== "return") ||
      typeof parsed.assetId !== "string" ||
      !parsed.assetId.trim() ||
      typeof parsed.toastMessage !== "string" ||
      !parsed.toastMessage.trim()
    ) {
      return null;
    }
    return {
      reason: parsed.reason,
      assetId: parsed.assetId.trim(),
      toastMessage: parsed.toastMessage.trim(),
      at: typeof parsed.at === "number" ? parsed.at : Date.now(),
    };
  } catch {
    try {
      window.sessionStorage.removeItem(INVENTORY_ARRIVAL_KEY);
    } catch {
      /* ignore */
    }
    return null;
  }
}

export const inventoryArrivalKeys = {
  arrival: INVENTORY_ARRIVAL_KEY,
} as const;
