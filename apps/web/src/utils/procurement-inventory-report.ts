import type { ProcurementInventoryRow } from "@/services/procurement-service";

export type ProcurementInventoryProductStock = {
  productName: string;
  units: number;
  grnCount: number;
  serialsRecorded: number;
};

export type ProcurementInventoryStockTableRow = {
  productName: string;
  companyPoNumber: string;
  grnNumber: string;
  orderId: string | null;
  units: number;
};

export type ProcurementInventoryStockSummary = {
  totalUnits: number;
  productCount: number;
  grnCount: number;
  byProduct: ProcurementInventoryProductStock[];
  byPoGrn: ProcurementInventoryStockTableRow[];
};

function productLabel(row: ProcurementInventoryRow): string {
  const name = row.product_name?.trim();
  return name || "Unnamed product";
}

/** Stock on hand from GRN receipts only — units received but not yet billed. */
export function isGrnNonBilledStockRow(row: ProcurementInventoryRow): boolean {
  return row.source === "grn";
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
    if (row.grn_number && row.grn_number !== "Imported") {
      entry.grns.add(row.grn_number);
    }
    if (hasTrackedSerial(row.serial_number)) {
      entry.serials += 1;
    }
    productMap.set(name, entry);
    if (row.grn_number && row.grn_number !== "Imported") {
      allGrns.add(row.grn_number);
    }
  }

  const byProduct = Array.from(productMap.entries())
    .map(([productName, data]) => ({
      productName,
      units: data.units,
      grnCount: data.grns.size,
      serialsRecorded: data.serials,
    }))
    .sort((a, b) => b.units - a.units || a.productName.localeCompare(b.productName));

  const poGrnMap = new Map<string, ProcurementInventoryStockTableRow>();
  for (const row of rows) {
    const productName = productLabel(row);
    const companyPoNumber = row.company_po_number?.trim() || "—";
    const grnNumber = row.grn_number?.trim() || "—";
    const key = `${productName}\0${companyPoNumber}\0${grnNumber}`;
    const entry = poGrnMap.get(key) ?? {
      productName,
      companyPoNumber,
      grnNumber,
      orderId: row.order_id,
      units: 0,
    };
    entry.units += 1;
    if (!entry.orderId && row.order_id) {
      entry.orderId = row.order_id;
    }
    poGrnMap.set(key, entry);
  }
  const byPoGrn = Array.from(poGrnMap.values()).sort(
    (a, b) =>
      b.units - a.units ||
      a.companyPoNumber.localeCompare(b.companyPoNumber) ||
      a.grnNumber.localeCompare(b.grnNumber) ||
      a.productName.localeCompare(b.productName),
  );

  return {
    totalUnits: rows.length,
    productCount: byProduct.length,
    grnCount: allGrns.size,
    byProduct,
    byPoGrn,
  };
}
