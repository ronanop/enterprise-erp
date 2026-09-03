import type { ProcurementInventoryRow } from "@/services/procurement-service";
import type { DeliveryChallanRecord } from "@/utils/delivery-challan-storage";

/** True when value is a real generated GRN (e.g. PO/CDT/017/001), not a placeholder. */
export function isGeneratedGrnNumber(value: string | null | undefined): boolean {
  const v = String(value ?? "").trim();
  if (!v || v === "—" || v === "-" || v === "Full PO") return false;
  if (v.startsWith("ovf-") || v.startsWith("saved:")) return false;
  if (v === "GRN warehouse stock" || v === "OVF inventory") return false;
  return true;
}

function grnTokensFromValue(raw: string | null | undefined): string[] {
  const text = String(raw ?? "").trim();
  if (!text) return [];
  return text
    .split(/[,;]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function uniqueGeneratedGrnNumbers(
  ...groups: Array<ReadonlyArray<string | null | undefined> | string | null | undefined>
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const group of groups) {
    if (group == null) continue;
    const list = Array.isArray(group) ? group : [group];
    for (const raw of list) {
      for (const v of grnTokensFromValue(raw == null ? "" : String(raw))) {
        if (!isGeneratedGrnNumber(v) || seen.has(v)) continue;
        seen.add(v);
        out.push(v);
      }
    }
  }
  return out;
}

export function formatGeneratedGrnNumbers(numbers: string[]): string {
  const unique = uniqueGeneratedGrnNumbers(numbers);
  return unique.length > 0 ? unique.join(", ") : "—";
}

/** GRN numbers recorded on warehouse inventory for a purchase order. */
export function grnNumbersFromInventoryForOrder(
  inventory: ProcurementInventoryRow[],
  orderId: string | null | undefined,
): string[] {
  const id = (orderId || "").trim();
  if (!id) return [];
  return uniqueGeneratedGrnNumbers(
    inventory
      .filter((row) => row.source === "grn" && row.order_id === id)
      .map((row) => row.grn_number),
  );
}

/**
 * Resolve display GRN number(s) the same way GrnPdfPickDialog shows them —
 * prefer stored values, then inventory GRNs for the linked PO.
 */
export function resolveDisplayGrnNumbers(input: {
  stored?: string | ReadonlyArray<string | null | undefined> | null;
  orderId?: string | null;
  inventory?: ProcurementInventoryRow[];
}): string[] {
  const storedList = Array.isArray(input.stored)
    ? input.stored
    : input.stored
      ? [input.stored]
      : [];
  const fromStored = uniqueGeneratedGrnNumbers(storedList);
  if (fromStored.length > 0) return fromStored;
  return grnNumbersFromInventoryForOrder(input.inventory || [], input.orderId);
}

export function resolveDisplayGrnNumberLabel(input: {
  stored?: string | ReadonlyArray<string | null | undefined> | null;
  orderId?: string | null;
  inventory?: ProcurementInventoryRow[];
}): string {
  return formatGeneratedGrnNumbers(resolveDisplayGrnNumbers(input));
}

export function resolveChallanDisplayGrnNumbers(
  record: DeliveryChallanRecord,
  inventory?: ProcurementInventoryRow[],
): string[] {
  return resolveDisplayGrnNumbers({
    stored: record.selectedGrnNumbers,
    orderId: record.orderId,
    inventory,
  });
}
