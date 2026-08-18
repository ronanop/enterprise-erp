import type { ProcurementInventoryRow } from "@/services/procurement-service";

export type ProcurementInventoryProductStock = {
  productName: string;
  units: number;
  grnCount: number;
  serialsRecorded: number;
  stockValue: number;
  avgUnitCost: number;
};

export type ProcurementInventoryVendorStock = {
  vendorId: string | null;
  vendorLabel: string;
  units: number;
  stockValue: number;
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
  totalStockValue: number;
  avgUnitCost: number;
  byProduct: ProcurementInventoryProductStock[];
  byVendor: ProcurementInventoryVendorStock[];
  byPoGrn: ProcurementInventoryStockTableRow[];
};

function productLabel(row: ProcurementInventoryRow): string {
  const name = row.product_name?.trim();
  return name || "Unnamed product";
}

function unitCostOf(row: ProcurementInventoryRow): number {
  const n = Number(row.unit_cost);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Stock on hand from GRN receipts only — units received but not yet billed. */
export function isGrnNonBilledStockRow(row: ProcurementInventoryRow): boolean {
  return row.source === "grn";
}

/** GRN units plus reversal ledger rows used for net available stock. */
export function isInventoryLedgerRow(row: ProcurementInventoryRow): boolean {
  return row.source === "grn" || row.source === "grn_reversal";
}

function hasTrackedSerial(serial: string | null | undefined): boolean {
  const value = serial?.trim();
  if (!value) return false;
  return value.toUpperCase() !== "NA";
}

/** Quantity received on GRN but not yet billed (stock on hand), including negative reversals. */
export function nonBilledStockQuantity(row: ProcurementInventoryRow): number {
  const received = Number(row.received_quantity);
  const billing = Number(row.billing_quantity);
  if (Number.isFinite(received)) {
    if (row.source === "grn_reversal" || received < 0) {
      return Math.round(received * 1e6) / 1e6;
    }
    if (received > 0) {
      const billed = Number.isFinite(billing) ? billing : 0;
      return Math.max(0, Math.round((received - billed) * 1e6) / 1e6);
    }
  }
  return 1;
}

function inventoryUnitGroupKey(row: ProcurementInventoryRow): string {
  return [
    row.order_line_id ?? row.grn_number,
    row.grn_number,
    productLabel(row),
  ].join("\0");
}

/** Label for one stocked unit row (position within product + GRN). */
export function formatInventoryUnitLabel(
  row: ProcurementInventoryRow,
  position: number,
  totalInGroup: number,
): string {
  const serial = (row.serial_number ?? "").trim();
  if (hasTrackedSerial(serial) && serial.toUpperCase() !== "—" && serial !== "-") {
    return serial;
  }
  const index = row.unit_index > 0 ? row.unit_index : position;
  if (totalInGroup > 1) {
    return `Unit ${position} of ${totalInGroup}`;
  }
  return `Unit ${index}`;
}

export function buildInventoryUnitLabels(
  rows: ProcurementInventoryRow[],
): Map<string, string> {
  const groups = new Map<string, ProcurementInventoryRow[]>();
  for (const row of rows) {
    const key = inventoryUnitGroupKey(row);
    const list = groups.get(key) ?? [];
    list.push(row);
    groups.set(key, list);
  }

  const labels = new Map<string, string>();
  for (const groupRows of groups.values()) {
    const total = groupRows.length;
    groupRows.forEach((row, index) => {
      const rowKey = inventoryRowStableKey(row, index);
      labels.set(rowKey, formatInventoryUnitLabel(row, index + 1, total));
    });
  }
  return labels;
}

export function inventoryRowStableKey(row: ProcurementInventoryRow, index: number): string {
  return (
    row.stock_unit_id ??
    row.import_line_id ??
    `${row.grn_number}-${row.unit_index}-${index}`
  );
}

export function buildProcurementInventoryStockSummary(
  rows: ProcurementInventoryRow[],
  options?: { vendorLabels?: Record<string, string> },
): ProcurementInventoryStockSummary {
  const vendorLabels = options?.vendorLabels ?? {};
  const productMap = new Map<
    string,
    { units: number; grns: Set<string>; serials: number; stockValue: number }
  >();
  const vendorMap = new Map<
    string,
    { vendorId: string | null; units: number; stockValue: number }
  >();
  const allGrns = new Set<string>();
  let totalStockValue = 0;

  for (const row of rows) {
    const name = productLabel(row);
    const qty = nonBilledStockQuantity(row);
    const cost = unitCostOf(row) * qty;
    totalStockValue += cost;

    const entry = productMap.get(name) ?? {
      units: 0,
      grns: new Set<string>(),
      serials: 0,
      stockValue: 0,
    };
    entry.units = Math.round((entry.units + qty) * 1e6) / 1e6;
    entry.stockValue += cost;
    if (row.grn_number && row.grn_number !== "Imported") {
      entry.grns.add(row.grn_number);
    }
    if (hasTrackedSerial(row.serial_number)) {
      entry.serials += 1;
    }
    productMap.set(name, entry);

    const vendorId = (row.vendor_id || "").trim() || null;
    const vendorKey = vendorId || "__unassigned__";
    const vendorEntry = vendorMap.get(vendorKey) ?? {
      vendorId,
      units: 0,
      stockValue: 0,
    };
    vendorEntry.units = Math.round((vendorEntry.units + qty) * 1e6) / 1e6;
    vendorEntry.stockValue += cost;
    vendorMap.set(vendorKey, vendorEntry);

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
      stockValue: data.stockValue,
      avgUnitCost: data.units > 0 ? data.stockValue / data.units : 0,
    }))
    .sort(
      (a, b) =>
        b.stockValue - a.stockValue ||
        b.units - a.units ||
        a.productName.localeCompare(b.productName),
    );

  const byVendor = Array.from(vendorMap.entries())
    .map(([key, data]) => {
      const labeled =
        (data.vendorId && vendorLabels[data.vendorId]?.trim()) ||
        (data.vendorId ? `OEM ${data.vendorId.slice(0, 8)}` : "Unassigned OEM");
      return {
        vendorId: data.vendorId,
        vendorLabel: key === "__unassigned__" ? "Unassigned OEM" : labeled,
        units: data.units,
        stockValue: data.stockValue,
      };
    })
    .sort(
      (a, b) =>
        b.stockValue - a.stockValue ||
        b.units - a.units ||
        a.vendorLabel.localeCompare(b.vendorLabel),
    );

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
    entry.units = Math.round((entry.units + nonBilledStockQuantity(row)) * 1e6) / 1e6;
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

  const totalUnits = Math.round(
    rows.reduce((sum, row) => sum + nonBilledStockQuantity(row), 0) * 1e6,
  ) / 1e6;
  return {
    totalUnits,
    productCount: byProduct.length,
    grnCount: allGrns.size,
    totalStockValue,
    avgUnitCost: totalUnits > 0 ? totalStockValue / totalUnits : 0,
    byProduct,
    byVendor,
    byPoGrn,
  };
}
