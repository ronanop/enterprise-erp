import type { ProcurementInventoryRow } from "@/services/procurement-service";

export type ProcurementInventoryProductStock = {
  productName: string;
  units: number;
  grnCount: number;
  serialsRecorded: number;
};

export type ProcurementInventoryStockSummary = {
  totalUnits: number;
  productCount: number;
  grnCount: number;
  byProduct: ProcurementInventoryProductStock[];
};

function productLabel(row: ProcurementInventoryRow): string {
  const name = row.product_name?.trim();
  return name || "Unnamed product";
}

function hasTrackedSerial(serial: string | null | undefined): boolean {
  const value = serial?.trim();
  if (!value) return false;
  return value.toUpperCase() !== "NA";
}

export function buildProcurementInventoryStockSummary(
  rows: ProcurementInventoryRow[],
): ProcurementInventoryStockSummary {
  const productMap = new Map<
    string,
    { units: number; grns: Set<string>; serials: number }
  >();
  const allGrns = new Set<string>();

  for (const row of rows) {
    const name = productLabel(row);
    const entry = productMap.get(name) ?? {
      units: 0,
      grns: new Set<string>(),
      serials: 0,
    };
    entry.units += 1;
    entry.grns.add(row.grn_number);
    if (hasTrackedSerial(row.serial_number)) {
      entry.serials += 1;
    }
    productMap.set(name, entry);
    allGrns.add(row.grn_number);
  }

  const byProduct = Array.from(productMap.entries())
    .map(([productName, data]) => ({
      productName,
      units: data.units,
      grnCount: data.grns.size,
      serialsRecorded: data.serials,
    }))
    .sort((a, b) => b.units - a.units || a.productName.localeCompare(b.productName));

  return {
    totalUnits: rows.length,
    productCount: byProduct.length,
    grnCount: allGrns.size,
    byProduct,
  };
}
