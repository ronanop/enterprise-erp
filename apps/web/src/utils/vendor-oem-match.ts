import type { VendorOption } from "@/services/procurement-service";

/** Split CRM multi-select party names (comma / semicolon). */
export function splitPartyNames(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .replace(/;/g, ",")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

/** Rank party→vendor label. Higher is better (exact > first-word > token/prefix). */
export function scoreVendorLabelForParty(label: string, party: string): number {
  const key = label.trim().toLowerCase();
  const needle = party.trim().toLowerCase();
  if (!key || !needle) return 0;
  if (key === needle) return 4;
  const words = key.split(/\s+/);
  const first = words[0] || "";
  if (first === needle) return 3;
  const tokens = new Set(needle.split(/\s+/).filter(Boolean));
  if (first && tokens.has(first)) return 2;
  if (key.startsWith(`${needle} `) || key.startsWith(needle)) return 1;
  for (const token of tokens) {
    if (token === first || key.startsWith(`${token} `) || key.startsWith(token)) return 1;
  }
  return 0;
}

/** @deprecated OEM is brand, not vendor — use scoreVendorLabelForParty / matchVendorByDistributor. */
export function scoreVendorLabelForOem(label: string, oem: string): number {
  return scoreVendorLabelForParty(label, oem);
}

/**
 * Pick best procurement vendor for a CRM distributor name.
 * Distributor ≡ vendor. OEM / brand must not be passed here.
 */
export function matchVendorByDistributor(
  vendors: VendorOption[],
  distributorName: string | null | undefined,
): VendorOption | null {
  const parties = splitPartyNames(distributorName).map((name) => name.toLowerCase());
  if (parties.length === 0) return null;

  const ranked = vendors
    .map((row) => {
      const score = Math.max(
        ...parties.map((party) => scoreVendorLabelForParty(row.label, party)),
        0,
      );
      return score > 0 ? { row, score } : null;
    })
    .filter((entry): entry is { row: VendorOption; score: number } => entry != null)
    .sort((a, b) => b.score - a.score || a.row.label.length - b.row.label.length);

  return ranked[0]?.row ?? null;
}

/** @deprecated Use matchVendorByDistributor — OEM is brand, not the buy-side vendor. */
export function matchVendorByOem(
  vendors: VendorOption[],
  _oemName: string | null | undefined,
  distributorName?: string | null,
): VendorOption | null {
  return matchVendorByDistributor(vendors, distributorName);
}

/** Display name for procurement vendor column: CRM distributor only (not PO/master vendor). */
export function resolveVendorDisplayName(input: {
  vendor_name?: string | null;
  distributor_name?: string | null;
  oem_name?: string | null;
}): string {
  const distributor = input.distributor_name?.trim();
  if (distributor) return distributor;
  return "—";
}
