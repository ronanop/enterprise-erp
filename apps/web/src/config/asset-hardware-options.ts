/**
 * IT hardware option lists + helpers for Add Asset configuration string.
 * Visibility/required is driven by Asset Type.requires_hardware_config (API).
 */

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

/** Best-effort parse of stored configuration back into form fields. */
export function parseConfigurationString(configuration?: string | null): {
  processor: string;
  generation: string;
  ram: string;
  storage: string;
} {
  const empty = { processor: "", generation: "", ram: "", storage: "" };
  const text = (configuration ?? "").trim();
  if (!text) return empty;

  const labeled = {
    processor: text.match(/Processor:\s*([^;]+)/i)?.[1]?.trim() ?? "",
    generation: text.match(/Generation:\s*([^;]+)/i)?.[1]?.trim() ?? "",
    ram: text.match(/RAM:\s*([^;]+)/i)?.[1]?.trim() ?? "",
    storage: text.match(/Storage:\s*([^;]+)/i)?.[1]?.trim() ?? "",
  };
  if (labeled.processor || labeled.ram || labeled.storage || labeled.generation) {
    return labeled;
  }

  // Compact formats like "Apple M1 / 16 GB / 512 GB" or "Intel i5 / 16 GB / 512 GB"
  const parts = text
    .split(/[|/·•]/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length >= 3) {
    return {
      processor: parts[0] ?? "",
      generation: "",
      ram: parts[1] ?? "",
      storage: parts[2] ?? "",
    };
  }
  return empty;
}
