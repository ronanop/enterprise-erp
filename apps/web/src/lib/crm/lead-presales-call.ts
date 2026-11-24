/** Per-product-type PreSales call alignment helpers for CRM leads. */

export type PresalesCallProductEntry = {
  aligned: boolean | null;
  contact_name: string;
};

export type PresalesCallByProduct = Record<string, PresalesCallProductEntry>;

export function parsePresalesCallByProduct(
  raw: string | null | undefined,
): PresalesCallByProduct {
  if (!raw?.trim()) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: PresalesCallByProduct = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      const product = key.trim();
      if (!product) continue;
      if (!value || typeof value !== "object" || Array.isArray(value)) {
        out[product] = { aligned: null, contact_name: "" };
        continue;
      }
      const row = value as Record<string, unknown>;
      const alignedRaw = row.aligned;
      const aligned =
        alignedRaw === true ? true : alignedRaw === false ? false : null;
      out[product] = {
        aligned,
        contact_name: String(row.contact_name ?? "").trim(),
      };
    }
    return out;
  } catch {
    return {};
  }
}

export function formatPresalesCallByProduct(map: PresalesCallByProduct): string {
  return JSON.stringify(map);
}

export function emptyPresalesEntry(): PresalesCallProductEntry {
  return { aligned: null, contact_name: "" };
}

/** Seed rows for each selected product type, preserving saved answers. */
export function presalesRowsForProductTypes(
  productTypes: readonly string[],
  saved: PresalesCallByProduct,
): Array<{ productType: string; entry: PresalesCallProductEntry }> {
  return productTypes.map((productType) => ({
    productType,
    entry: saved[productType] ?? emptyPresalesEntry(),
  }));
}

export function isPresalesCallReadyForProducts(
  productTypes: readonly string[],
  map: PresalesCallByProduct,
): boolean {
  if (productTypes.length === 0) return false;
  return productTypes.every((productType) => {
    const entry = map[productType];
    return Boolean(entry?.aligned === true && entry.contact_name.trim());
  });
}

export function summarizePresalesCall(map: PresalesCallByProduct): {
  aligned: boolean | null;
  contact_name: string | null;
} {
  const entries = Object.values(map);
  if (entries.length === 0) return { aligned: null, contact_name: null };
  const allYes = entries.every((entry) => entry.aligned === true);
  const anyNo = entries.some((entry) => entry.aligned === false);
  const contacts = entries
    .filter((entry) => entry.aligned === true && entry.contact_name.trim())
    .map((entry) => entry.contact_name.trim());
  return {
    aligned: allYes ? true : anyNo ? false : null,
    contact_name: contacts.length > 0 ? contacts.join("; ") : null,
  };
}
