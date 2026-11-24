import { listVendorOptions } from "@/services/procurement-service";

/** @deprecated Prefer loadCrmDistributorOptions — kept for any stray imports. */
export const LEAD_DISTRIBUTOR_OPTIONS: readonly string[] = ["IN STOCK"];

export const LEAD_DISTRIBUTOR_SEPARATOR = ", ";

export function parseLeadDistributorNames(value: string | null | undefined): string[] {
  if (!value?.trim()) return [];
  return value
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);
}

export function formatLeadDistributorNames(names: readonly string[]): string {
  return names.join(LEAD_DISTRIBUTOR_SEPARATOR);
}

function mergeDistributorNames(...groups: readonly (readonly string[])[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const group of groups) {
    for (const raw of group) {
      const name = raw.trim();
      if (!name) continue;
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(name);
    }
  }
  return out;
}

/**
 * Distributor dropdown options: Procurement → Vendors only (+ IN STOCK).
 * Names already on the lead/OVF are kept so edits do not drop unknown values.
 */
export function buildLeadDistributorDropdownOptions(
  leadDistributorField: string | null | undefined,
  scmVendorNames: readonly string[] = [],
): string[] {
  return mergeDistributorNames(
    ["IN STOCK"],
    scmVendorNames,
    parseLeadDistributorNames(leadDistributorField),
  );
}

/** Load Procurement Vendors master list (same source as /procurement/vendors). */
export async function loadCrmDistributorOptions(
  leadDistributorField?: string | null,
): Promise<string[]> {
  const scmNames = await listVendorOptions()
    .then((rows) =>
      rows
        .filter((vendor) => (vendor.status || "active").toLowerCase() !== "inactive")
        .map((vendor) => vendor.label.trim())
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" })),
    )
    .catch(() => [] as string[]);
  return buildLeadDistributorDropdownOptions(leadDistributorField, scmNames);
}
