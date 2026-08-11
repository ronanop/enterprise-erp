import type { ProcurementInventoryRow } from "@/services/procurement-service";

export type InventoryGrnLineSummary = {
  productName: string;
  units: number;
  serials: string[];
};

export type InventoryGrnGroup = {
  grn_number: string;
  receipt_at: string | null;
  vendor_id: string | null;
  order_id: string | null;
  company_po_number: string;
  lines: InventoryGrnLineSummary[];
  totalUnits: number;
};

export type InventoryPoGroup = {
  company_po_number: string;
  order_id: string | null;
  grns: InventoryGrnGroup[];
};

function productName(row: ProcurementInventoryRow): string {
  return row.product_name?.trim() || "—";
}

export function groupInventoryByPoAndGrn(rows: ProcurementInventoryRow[]): InventoryPoGroup[] {
  const poMap = new Map<string, { po: InventoryPoGroup; grnMap: Map<string, InventoryGrnGroup> }>();

  for (const row of rows) {
    const poLabel = row.company_po_number?.trim() || "—";
    const poKey = `${poLabel}::${row.order_id ?? "none"}`;
    let bucket = poMap.get(poKey);
    if (!bucket) {
      bucket = {
        po: {
          company_po_number: poLabel,
          order_id: row.order_id,
          grns: [],
        },
        grnMap: new Map(),
      };
      poMap.set(poKey, bucket);
    }

    const grnKey = row.grn_number;
    let grn = bucket.grnMap.get(grnKey);
    if (!grn) {
      grn = {
        grn_number: row.grn_number,
        receipt_at: row.receipt_at,
        vendor_id: row.vendor_id,
        order_id: row.order_id,
        company_po_number: poLabel,
        lines: [],
        totalUnits: 0,
      };
      bucket.grnMap.set(grnKey, grn);
      bucket.po.grns.push(grn);
    }

    grn.totalUnits += 1;
    const name = productName(row);
    let line = grn.lines.find((l) => l.productName === name);
    if (!line) {
      line = { productName: name, units: 0, serials: [] };
      grn.lines.push(line);
    }
    line.units += 1;
    const serial = row.serial_number?.trim();
    if (serial) line.serials.push(serial);
  }

  const groups = Array.from(poMap.values()).map((b) => b.po);
  for (const po of groups) {
    po.grns.sort((a, b) => b.grn_number.localeCompare(a.grn_number));
    for (const grn of po.grns) {
      grn.lines.sort((a, b) => a.productName.localeCompare(b.productName));
    }
  }
  groups.sort((a, b) => b.company_po_number.localeCompare(a.company_po_number));
  return groups;
}

export function formatGrnProductSummary(lines: InventoryGrnLineSummary[]): string {
  if (lines.length === 0) return "—";
  return lines.map((l) => `${l.productName} (${l.units})`).join(", ");
}

export function formatGrnSerialSummary(lines: InventoryGrnLineSummary[]): string {
  const serials = lines.flatMap((l) => l.serials).filter(Boolean);
  if (serials.length === 0) return "—";
  const unique = [...new Set(serials)];
  const naOnly =
    unique.length > 0 && unique.every((s) => s.toUpperCase() === "NA");
  if (naOnly) return "NA";
  const tracked = unique.filter((s) => s.toUpperCase() !== "NA");
  if (tracked.length === 0) return "NA";
  if (tracked.length <= 4) return tracked.join(", ");
  return `${tracked.slice(0, 3).join(", ")} +${tracked.length - 3} more`;
}
