/**
 * Extensible IT hardware configuration visibility/required rules by PRD asset type.
 * Generation is shown only when an Intel processor is selected (UI concern).
 */

export type AssetItConfigRule = {
  showProcessor: boolean;
  showRam: boolean;
  showStorage: boolean;
  /** When true, Processor/RAM/Storage are required (Generation required only for Intel). */
  requireHardware: boolean;
};

const COMPUTER: AssetItConfigRule = {
  showProcessor: true,
  showRam: true,
  showStorage: true,
  requireHardware: true,
};

const PERIPHERAL: AssetItConfigRule = {
  showProcessor: false,
  showRam: false,
  showStorage: false,
  requireHardware: false,
};

/** Rules keyed by PRD type id — add future types here without rewriting form JSX. */
export const ASSET_IT_CONFIG_RULES: Record<string, AssetItConfigRule> = {
  laptop: COMPUTER,
  desktop: COMPUTER,
  mobile: COMPUTER,
  monitor: PERIPHERAL,
  keyboard: PERIPHERAL,
  mouse: PERIPHERAL,
  furniture: PERIPHERAL,
  vehicle: PERIPHERAL,
  other: PERIPHERAL,
};

export const DEFAULT_IT_CONFIG_RULE: AssetItConfigRule = PERIPHERAL;

export function getItConfigRule(prdTypeId: string | undefined | null): AssetItConfigRule {
  if (!prdTypeId) return DEFAULT_IT_CONFIG_RULE;
  return ASSET_IT_CONFIG_RULES[prdTypeId] ?? DEFAULT_IT_CONFIG_RULE;
}

export const PROCESSOR_OPTIONS = [
  "Intel Celeron",
  "Intel Pentium",
  "Intel i3",
  "Intel i5",
  "Intel i7",
  "Intel i9",
  "Apple M1",
  "Apple M2",
  "Apple M3",
  "Apple M4",
  "AMD Ryzen 3",
  "AMD Ryzen 5",
  "AMD Ryzen 7",
  "AMD Ryzen 9",
  "Other",
] as const;

export const INTEL_GENERATION_OPTIONS = [
  "10th",
  "11th",
  "12th",
  "13th",
  "14th",
  "15th",
  "Other",
] as const;

export const RAM_OPTIONS = [
  "4 GB",
  "6 GB",
  "8 GB",
  "16 GB",
  "32 GB",
  "64 GB",
  "128 GB",
  "Other",
] as const;

export const STORAGE_OPTIONS = [
  "128 GB",
  "256 GB",
  "512 GB",
  "1 TB",
  "2 TB",
  "4 TB",
  "8 TB",
  "Other",
] as const;

export function isIntelProcessor(processor: string): boolean {
  return processor.trim().toLowerCase().startsWith("intel");
}

/** Compose IT hardware fields into existing `configuration` API string. */
export function buildConfigurationString(parts: {
  processor?: string;
  generation?: string;
  ram?: string;
  storage?: string;
}): string | undefined {
  const chunks: string[] = [];
  if (parts.processor?.trim()) chunks.push(`Processor: ${parts.processor.trim()}`);
  if (parts.generation?.trim()) chunks.push(`Generation: ${parts.generation.trim()}`);
  if (parts.ram?.trim()) chunks.push(`RAM: ${parts.ram.trim()}`);
  if (parts.storage?.trim()) chunks.push(`Storage: ${parts.storage.trim()}`);
  return chunks.length > 0 ? chunks.join("; ") : undefined;
}
