import { COURIER_PROVIDER_OPTIONS } from "@/utils/delivery-status-storage";

const CUSTOM_COURIER_KEY = "erp.procurement.delivery-status.custom-couriers";

export const COURIER_ADD_OTHER = "__add_other__";

export function readCustomCourierProviders(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CUSTOM_COURIER_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => String(item ?? "").trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

export function addCustomCourierProvider(name: string): string[] {
  const trimmed = name.trim();
  if (!trimmed || typeof window === "undefined") return readCustomCourierProviders();
  const presets = COURIER_PROVIDER_OPTIONS as readonly string[];
  if (presets.some((p) => p.toLowerCase() === trimmed.toLowerCase())) {
    return readCustomCourierProviders();
  }
  const next = [...readCustomCourierProviders()];
  if (!next.some((item) => item.toLowerCase() === trimmed.toLowerCase())) {
    next.push(trimmed);
    window.localStorage.setItem(CUSTOM_COURIER_KEY, JSON.stringify(next));
  }
  return next;
}

export function allCourierProviderOptions(): string[] {
  const custom = readCustomCourierProviders();
  const presets = [...COURIER_PROVIDER_OPTIONS];
  const seen = new Set(presets.map((p) => p.toLowerCase()));
  for (const item of custom) {
    if (!seen.has(item.toLowerCase())) {
      presets.push(item);
      seen.add(item.toLowerCase());
    }
  }
  return presets;
}
