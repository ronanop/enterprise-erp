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

function matchKnownOption(value: string, options: readonly string[]): string {
  const normalized = value.trim().toLowerCase().replace(/\s+/g, " ");
  const exact = options.find((o) => o.toLowerCase() === normalized);
  if (exact) return exact;
  const loose = options.find(
    (o) => o.toLowerCase() === normalized.replace(/\s*gb\s*$/i, " gb").trim(),
  );
  return loose ?? value.trim();
}

function detectProcessor(text: string): string {
  const lower = text.toLowerCase();
  if (/\bapple\s*m4\b|\bm4\b/.test(lower) && !/\bm4\d/.test(lower)) return "Apple M4";
  if (/\bapple\s*m3\b|\bm3\b/.test(lower)) return "Apple M3";
  if (/\bapple\s*m2\b|\bm2\b/.test(lower)) return "Apple M2";
  if (/\bapple\s*m1\b|\bm1\b/.test(lower)) return "Apple M1";
  if (/\bryzen\s*9\b/.test(lower)) return "AMD Ryzen 9";
  if (/\bryzen\s*7\b/.test(lower)) return "AMD Ryzen 7";
  if (/\bryzen\s*5\b/.test(lower)) return "AMD Ryzen 5";
  if (/\bryzen\s*3\b/.test(lower)) return "AMD Ryzen 3";
  if (/\b(intel\s*)?(core\s*)?i9\b|\bi9[-\s]?\d/.test(lower)) return "Intel i9";
  if (/\b(intel\s*)?(core\s*)?i7\b|\bi7[-\s]?\d/.test(lower)) return "Intel i7";
  if (/\b(intel\s*)?(core\s*)?i5\b|\bi5[-\s]?\d/.test(lower)) return "Intel i5";
  if (/\b(intel\s*)?(core\s*)?i3\b|\bi3[-\s]?\d/.test(lower)) return "Intel i3";
  if (/\bpentium\b/.test(lower)) return "Intel Pentium";
  if (/\bceleron\b/.test(lower)) return "Intel Celeron";
  return "";
}

function detectGeneration(text: string): string {
  const lower = text.toLowerCase();
  const labeled = lower.match(/\b(1[0-5])(th|nd|rd|st)?\s*gen(?:eration)?\b/);
  if (labeled) return `${labeled[1]}th`;
  // i5-10310U → 10th; i5-1135G7 → 11th
  const sku = lower.match(/\bi[3579][-\s]?(\d{2})\d{2}/);
  if (sku) {
    const gen = Number(sku[1]);
    if (gen >= 10 && gen <= 15) return `${gen}th`;
  }
  return "";
}

function detectRam(text: string): string {
  const lower = text.toLowerCase();
  // "16/512GB" or "16 / 512"
  const slash = lower.match(/\b(4|6|8|16|32|64|128)\s*\/\s*\d+/);
  if (slash) return matchKnownOption(`${slash[1]} GB`, RAM_OPTIONS);
  const labeled = lower.match(/\b(4|6|8|16|32|64|128)\s*gb(?:\s*ram)?\b/);
  if (labeled) return matchKnownOption(`${labeled[1]} GB`, RAM_OPTIONS);
  return "";
}

function detectStorage(text: string): string {
  const lower = text.toLowerCase();
  const tb = lower.match(/\b([1248])\s*tb\b/);
  if (tb) return matchKnownOption(`${tb[1]} TB`, STORAGE_OPTIONS);
  // Prefer storage side of "16/512GB"
  const slash = lower.match(/\b\d+\s*\/\s*(128|256|512|1024)\s*(?:gb)?\b/);
  if (slash) {
    const gb = slash[1] === "1024" ? "1 TB" : `${slash[1]} GB`;
    return matchKnownOption(gb, STORAGE_OPTIONS);
  }
  const ssd = lower.match(/\b(128|256|512|1024)\s*gb(?:\s*ssd)?\b/);
  if (ssd) {
    const gb = ssd[1] === "1024" ? "1 TB" : `${ssd[1]} GB`;
    return matchKnownOption(gb, STORAGE_OPTIONS);
  }
  return "";
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
    return {
      processor: labeled.processor
        ? matchKnownOption(labeled.processor, PROCESSOR_OPTIONS)
        : "",
      generation: labeled.generation
        ? matchKnownOption(labeled.generation, INTEL_GENERATION_OPTIONS)
        : "",
      ram: labeled.ram ? matchKnownOption(labeled.ram, RAM_OPTIONS) : "",
      storage: labeled.storage ? matchKnownOption(labeled.storage, STORAGE_OPTIONS) : "",
    };
  }

  // Compact formats like "Apple M1 / 16 GB / 512 GB" or "Intel i5 / 16 GB / 512 GB"
  const parts = text
    .split(/[|/·•]/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length >= 3) {
    const processor = detectProcessor(parts[0]!) || matchKnownOption(parts[0]!, PROCESSOR_OPTIONS);
    const ram = detectRam(parts[1]!) || matchKnownOption(parts[1]!, RAM_OPTIONS);
    const storage = detectStorage(parts[2]!) || matchKnownOption(parts[2]!, STORAGE_OPTIONS);
    return {
      processor,
      generation: detectGeneration(text),
      ram,
      storage,
    };
  }

  // Free-text IT inventory styles: "i5 10th GEN 16/512GB", "Intel Core i5(11th gen) 16 GB Ram, 512GB SSD"
  const processor = detectProcessor(text);
  const generation = detectGeneration(text);
  const ram = detectRam(text);
  const storage = detectStorage(text);
  if (processor || generation || ram || storage) {
    return { processor, generation, ram, storage };
  }

  return empty;
}
