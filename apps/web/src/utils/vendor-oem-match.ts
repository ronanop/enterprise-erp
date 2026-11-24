import type {
  VendorAddressEntry,
  VendorOption,
} from "@/services/procurement-service";

/** Unique supply states from a vendor's address book. */
export function vendorSupplyStates(
  vendor: VendorOption | null | undefined,
): string[] {
  if (!vendor?.addressEntries?.length) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const entry of vendor.addressEntries) {
    const state = (
      entry.sourceOfSupply ||
      entry.billing?.state ||
      entry.shipping?.state ||
      ""
    ).trim();
    if (!state) continue;
    const key = state.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(state);
  }
  return out.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}

/** Address entry matching a supply/billing state (falls back to first entry). */
export function findVendorAddressEntryByState(
  vendor: VendorOption | null | undefined,
  state: string | null | undefined,
): { entry: VendorAddressEntry; index: number } | null {
  if (!vendor?.addressEntries?.length) return null;
  const needle = (state || "").trim().toLowerCase();
  if (!needle) {
    return { entry: vendor.addressEntries[0], index: 0 };
  }
  const index = vendor.addressEntries.findIndex((entry) => {
    const candidates = [
      entry.sourceOfSupply,
      entry.billing?.state,
      entry.shipping?.state,
    ].map((value) => (value || "").trim().toLowerCase());
    return candidates.includes(needle);
  });
  if (index < 0) return null;
  return { entry: vendor.addressEntries[index], index };
}

/** Display address for a vendor + selected state. */
export function vendorAddressForState(
  vendor: VendorOption | null | undefined,
  state: string | null | undefined,
): string {
  const matched = findVendorAddressEntryByState(vendor, state);
  if (!matched) return (vendor?.address || "").trim();
  const billing = matched.entry.billing;
  if (billing && (billing.street || billing.city || billing.pincode)) {
    return [billing.street, billing.city, billing.state, billing.pincode, billing.country]
      .map((part) => (part || "").trim())
      .filter(Boolean)
      .join(", ");
  }
  return (matched.entry.address || vendor?.address || "").trim();
}

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

/** @deprecated OEM is brand, not vendor - use scoreVendorLabelForParty / matchVendorByDistributor. */
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

/** @deprecated Use matchVendorByDistributor - OEM is brand, not the buy-side vendor. */
export function matchVendorByOem(
  vendors: VendorOption[],
  _oemName: string | null | undefined,
  distributorName?: string | null,
): VendorOption | null {
  return matchVendorByDistributor(vendors, distributorName);
}

function normalizeDistributorDisplayName(raw: string | null | undefined): string | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;
  // Legacy placeholder when OVF vendor rows had no distributor filled in CRM.
  if (trimmed.toLowerCase() === "vendor") return null;
  return trimmed;
}

/** Display name for procurement vendor column: CRM distributor only (not PO/master vendor). */
export function resolveVendorDisplayName(input: {
  vendor_name?: string | null;
  distributor_name?: string | null;
  oem_name?: string | null;
  open_distributor_names?: string[] | null;
}): string {
  const distributor = normalizeDistributorDisplayName(input.distributor_name);
  if (distributor) return distributor;
  const open = (input.open_distributor_names || [])
    .map((name) => normalizeDistributorDisplayName(name))
    .filter((name): name is string => Boolean(name));
  if (open.length > 0) return open.join(", ");
  return "-";
}
