const FLASH_KEY = "erp.procurement.delivery-status-flash";

export type DeliveryStatusFlash = {
  variant: "success" | "warning";
  message: string;
};

export function setDeliveryStatusFlash(flash: DeliveryStatusFlash): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(FLASH_KEY, JSON.stringify(flash));
}

export function consumeDeliveryStatusFlash(): DeliveryStatusFlash | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(FLASH_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(FLASH_KEY);
    return JSON.parse(raw) as DeliveryStatusFlash;
  } catch {
    return null;
  }
}
