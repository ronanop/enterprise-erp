import type { VendorOption } from "@/services/procurement-service";

/** Rank OEM → vendor label. Higher is better (exact > first-word > token/prefix). */
export function scoreVendorLabelForOem(label: string, oem: string): number {
  const key = label.trim().toLowerCase();
  if (!key || !oem) return 0;
  if (key === oem) return 4;
  const words = key.split(/\s+/);
  const first = words[0] || "";
  if (first === oem) return 3;
  const oemTokens = new Set(oem.split(/\s+/).filter(Boolean));
  if (first && oemTokens.has(first)) return 2;
  if (key.startsWith(`${oem} `) || key.startsWith(oem)) return 1;
  for (const token of oemTokens) {
    if (token === first || key.startsWith(`${token} `) || key.startsWith(token)) return 1;
  }
  return 0;
}

/** Pick best vendor for an OVF OEM (e.g. pacific → Pacific Parts). */
export function matchVendorByOem(
  vendors: VendorOption[],
  oemName: string | null | undefined,
): VendorOption | null {
  const oem = (oemName || "").trim().toLowerCase();
  if (!oem) return null;

  const ranked = vendors
    .map((row) => {
      const score = scoreVendorLabelForOem(row.label, oem);
      return score > 0 ? { row, score } : null;
    })
    .filter((entry): entry is { row: VendorOption; score: number } => entry != null)
    .sort((a, b) => b.score - a.score || a.row.label.length - b.row.label.length);

  return ranked[0]?.row ?? null;
}
