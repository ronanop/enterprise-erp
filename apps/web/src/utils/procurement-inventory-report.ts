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

/** How stock entered inventory - GRN/PO receipt vs Add stock / Excel import. */
export type InventoryAddedBy = "po" | "manual" | "mixed";

export type GrnStockByProductRow = {
  productKey: string;
  productName: string;
  stockQty: number;
  avgUnitCost: number;
  description: string;
  serialSummary: string;
  grnSummary: string;
  hasReversal: boolean;
  /** Origin of stock units for this product group. */
  addedBy: InventoryAddedBy;
  /** Earliest unit date added (receipt_at / created), ISO datetime or null. */
  dateAdded: string | null;
  /** Earliest warranty end date (YYYY-MM-DD), null if unset. */
  warrantyValidTill: string | null;
  /** True when warrantyValidTill is set and before today. */
  warrantyExpired: boolean;
  lines: ProcurementInventoryRow[];
};

/** Stock ledger row for Inventory list (invoice / commercial columns). */
export type InventoryStockLedgerRow = {
  rowKey: string;
  productKey: string;
  productName: string;
  invoiceDate: string | null;
  invoiceNumber: string;
  vendorName: string;
  paymentTerms: string;
  itemDescription: string;
  stockQty: number;
  unitRate: number;
  taxRate: number;
  totalWithTax: number;
  ageingDays: number | null;
  warrantyExpired: boolean;
  lines: ProcurementInventoryRow[];
};

export function inventoryTotalWithTax(qty: number, unitRate: number, taxRate: number): number {
  const base = qty * unitRate;
  const rate = Number.isFinite(taxRate) && taxRate > 0 ? taxRate : 0;
  return Math.round(base * (1 + rate / 100) * 100) / 100;
}

function pickMostCommon(values: string[]): string {
  const counts = new Map<string, number>();
  for (const value of values) {
    const key = value.trim();
    if (!key) continue;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  let best = "";
  let bestCount = 0;
  for (const [value, count] of counts) {
    if (count > bestCount) {
      best = value;
      bestCount = count;
    }
  }
  return best;
}

/** One row per product + vendor invoice (falls back to product + vendor + GRN). */
export function groupInventoryStockLedgerRows(
  rows: ProcurementInventoryRow[],
  vendorLabels: Record<string, string> = {},
): InventoryStockLedgerRow[] {
  const map = new Map<string, ProcurementInventoryRow[]>();
  for (const row of rows) {
    const productKey = inventoryProductKey(row.product_name);
    if (!productKey) continue;
    const invoice = (row.vendor_invoice_number || "").trim().toLowerCase() || "-";
    const vendor =
      (row.vendor_id || "").trim().toLowerCase() ||
      (row.vendor_name || "").trim().toLowerCase() ||
      "-";
    const grn = (row.grn_number || "").trim().toLowerCase() || "-";
    const key =
      invoice !== "-"
        ? `${productKey}\0${vendor}\0inv:${invoice}`
        : `${productKey}\0${vendor}\0grn:${grn}`;
    const list = map.get(key) ?? [];
    list.push(row);
    map.set(key, list);
  }

  return Array.from(map.entries())
    .map(([rowKey, lines]) => {
      const stockQty = lines.reduce((sum, row) => sum + nonBilledStockQuantity(row), 0);
      const stockValue = lines.reduce(
        (sum, row) => sum + unitCostOf(row) * nonBilledStockQuantity(row),
        0,
      );
      const roundedQty = Math.round(stockQty * 1e6) / 1e6;
      const unitRate = roundedQty > 0 ? stockValue / roundedQty : 0;
      const taxRates = lines
        .map((row) => Number(row.tax_rate))
        .filter((n) => Number.isFinite(n) && n >= 0);
      const taxRate = taxRates.length > 0 ? taxRates[0]! : 0;
      const descriptions = lines
        .map((row) => (row.description || row.product_name || "").trim())
        .filter(Boolean);
      const invoiceDates = lines
        .map((row) => (row.vendor_invoice_date || "").trim().slice(0, 10))
        .filter(Boolean)
        .sort();
      const ageingValues = lines
        .map((row) => row.ageing_days)
        .filter((n): n is number => typeof n === "number" && Number.isFinite(n));
      const vendorFromApi = pickMostCommon(
        lines.map((row) => (row.vendor_name || "").trim()).filter(Boolean),
      );
      const vendorId = lines.map((row) => row.vendor_id).find(Boolean) || null;
      const vendorName =
        vendorFromApi ||
        (vendorId ? vendorLabels[vendorId] : "") ||
        "-";
      const warranty = resolveProductWarranty(lines);
      return {
        rowKey,
        productKey: inventoryProductKey(lines[0]?.product_name),
        productName: productLabel(lines[0]!),
        invoiceDate: invoiceDates[0] || null,
        invoiceNumber:
          pickMostCommon(
            lines.map((row) => (row.vendor_invoice_number || "").trim()).filter(Boolean),
          ) || "-",
        vendorName,
        paymentTerms:
          pickMostCommon(
            lines.map((row) => (row.payment_terms || "").trim()).filter(Boolean),
          ) || "-",
        itemDescription: pickMostCommon(descriptions) || productLabel(lines[0]!),
        stockQty: roundedQty,
        unitRate,
        taxRate,
        totalWithTax: inventoryTotalWithTax(roundedQty, unitRate, taxRate),
        ageingDays: ageingValues.length > 0 ? Math.max(...ageingValues) : null,
        warrantyExpired: warranty.warrantyExpired,
        lines,
      };
    })
    .filter((row) => Math.abs(row.stockQty) > 1e-9)
    .sort((a, b) => {
      const byDate = (b.invoiceDate || "").localeCompare(a.invoiceDate || "");
      if (byDate !== 0) return byDate;
      return a.itemDescription.localeCompare(b.itemDescription, undefined, {
        sensitivity: "base",
      });
    });
}

export function inventoryRowAddedBy(row: ProcurementInventoryRow): "po" | "manual" {
  return row.source === "import" ? "manual" : "po";
}

export function inventoryAddedByLabel(addedBy: InventoryAddedBy): string {
  if (addedBy === "manual") return "Added manually";
  if (addedBy === "mixed") return "PO + Manual";
  return "Added by PO";
}

function resolveProductAddedBy(lines: ProcurementInventoryRow[]): InventoryAddedBy {
  let hasPo = false;
  let hasManual = false;
  for (const row of lines) {
    if (inventoryRowAddedBy(row) === "manual") hasManual = true;
    else hasPo = true;
    if (hasPo && hasManual) return "mixed";
  }
  return hasManual ? "manual" : "po";
}

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

/** Case-insensitive product key - same item from different POs/GRNs merges in stock views. */
export function inventoryProductKey(name: string | null | undefined): string {
  return (name || "").trim().toLowerCase();
}

function formatSerialSummaryFromRows(rows: ProcurementInventoryRow[]): string {
  const serials = rows
    .map((row) => (row.serial_number ?? "").trim())
    .filter((serial) => serial && serial.toUpperCase() !== "NA" && serial !== "-" && serial !== "-");
  if (serials.length === 0) return "-";
  const unique = [...new Set(serials)];
  if (unique.length <= 3) return unique.join(", ");
  return `${unique.slice(0, 3).join(", ")} +${unique.length - 3} more`;
}

function formatGrnSummaryFromRows(rows: ProcurementInventoryRow[]): string {
  const grns = [...new Set(rows.map((row) => row.grn_number?.trim()).filter(Boolean))] as string[];
  if (grns.length === 0) return "-";
  if (grns.length <= 2) return grns.join(", ");
  return `${grns.slice(0, 2).join(", ")} +${grns.length - 2} more`;
}

function todayIsoDate(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/** Normalize API warranty date to YYYY-MM-DD. */
export function inventoryWarrantyDate(value: string | null | undefined): string | null {
  const text = (value ?? "").trim();
  if (!text) return null;
  return text.slice(0, 10);
}

export function isInventoryWarrantyExpired(value: string | null | undefined, today = todayIsoDate()): boolean {
  const end = inventoryWarrantyDate(value);
  if (!end) return false;
  return end < today;
}

export function formatInventoryDateAdded(value: string | null | undefined): string {
  const text = (value ?? "").trim();
  if (!text) return "-";
  // Date-only (YYYY-MM-DD) — parse as local calendar day to avoid UTC shift.
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text.slice(0, 10));
  const date = dateOnly
    ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
    : new Date(text);
  if (Number.isNaN(date.getTime())) return text.slice(0, 10);
  return new Intl.DateTimeFormat(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function formatInventoryWarrantyLabel(value: string | null | undefined): string {
  const end = inventoryWarrantyDate(value);
  if (!end) return "-";
  if (isInventoryWarrantyExpired(end)) return "Expired";
  return new Intl.DateTimeFormat(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${end}T00:00:00`));
}

function resolveProductDateAdded(lines: ProcurementInventoryRow[]): string | null {
  const stamps = lines
    .map((row) => (row.receipt_at ?? "").trim())
    .filter(Boolean)
    .sort();
  return stamps[0] ?? null;
}

function resolveProductWarranty(lines: ProcurementInventoryRow[]): {
  warrantyValidTill: string | null;
  warrantyExpired: boolean;
} {
  const ends = lines
    .map((row) => inventoryWarrantyDate(row.warranty_valid_till))
    .filter((value): value is string => Boolean(value))
    .sort();
  if (ends.length === 0) {
    return { warrantyValidTill: null, warrantyExpired: false };
  }
  const earliest = ends[0]!;
  return {
    warrantyValidTill: earliest,
    warrantyExpired: isInventoryWarrantyExpired(earliest),
  };
}

/** One row per product - aggregates units from all POs/GRNs for the same product name. */
export function groupGrnStockByProduct(rows: ProcurementInventoryRow[]): GrnStockByProductRow[] {
  const map = new Map<string, { displayName: string; lines: ProcurementInventoryRow[] }>();
  for (const row of rows) {
    const key = inventoryProductKey(row.product_name);
    if (!key) continue;
    const entry = map.get(key) ?? { displayName: productLabel(row), lines: [] };
    if (!map.has(key)) {
      entry.displayName = productLabel(row);
    }
    entry.lines.push(row);
    map.set(key, entry);
  }

  return Array.from(map.entries())
    .map(([productKey, { displayName, lines }]) => {
      const stockQty = lines.reduce((sum, row) => sum + nonBilledStockQuantity(row), 0);
      const stockValue = lines.reduce(
        (sum, row) => sum + unitCostOf(row) * nonBilledStockQuantity(row),
        0,
      );
      const roundedQty = Math.round(stockQty * 1e6) / 1e6;
      const descriptions = [
        ...new Set(lines.map((row) => (row.description ?? "").trim()).filter(Boolean)),
      ];
      const warranty = resolveProductWarranty(lines);
      return {
        productKey,
        productName: displayName,
        stockQty: roundedQty,
        avgUnitCost: roundedQty > 0 ? stockValue / roundedQty : 0,
        description:
          descriptions.length === 1
            ? descriptions[0]!
            : descriptions.length > 1
              ? "Multiple"
              : "-",
        serialSummary: formatSerialSummaryFromRows(lines),
        grnSummary: formatGrnSummaryFromRows(lines),
        hasReversal: lines.some((row) => row.source === "grn_reversal"),
        addedBy: resolveProductAddedBy(lines),
        dateAdded: resolveProductDateAdded(lines),
        warrantyValidTill: warranty.warrantyValidTill,
        warrantyExpired: warranty.warrantyExpired,
        lines,
      };
    })
    .sort((a, b) =>
      a.productName.localeCompare(b.productName, undefined, { sensitivity: "base" }),
    );
}

function unitCostOf(row: ProcurementInventoryRow): number {
  const n = Number(row.unit_cost);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Stock on hand from GRN receipts only - units received but not yet billed. */
export function isGrnNonBilledStockRow(row: ProcurementInventoryRow): boolean {
  return row.source === "grn";
}

/** GRN units, imported / manual stock, plus reversal ledger rows for net available stock. */
export function isInventoryLedgerRow(row: ProcurementInventoryRow): boolean {
  return row.source === "grn" || row.source === "grn_reversal" || row.source === "import";
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
  if (hasTrackedSerial(serial) && serial.toUpperCase() !== "-" && serial !== "-") {
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
    {
      displayName: string;
      units: number;
      grns: Set<string>;
      serials: number;
      stockValue: number;
    }
  >();
  const vendorMap = new Map<
    string,
    { vendorId: string | null; units: number; stockValue: number }
  >();
  const allGrns = new Set<string>();
  let totalStockValue = 0;

  for (const row of rows) {
    const name = productLabel(row);
    const productKey = inventoryProductKey(row.product_name) || name;
    const qty = nonBilledStockQuantity(row);
    const cost = unitCostOf(row) * qty;
    totalStockValue += cost;

    const entry = productMap.get(productKey) ?? {
      displayName: name,
      units: 0,
      grns: new Set<string>(),
      serials: 0,
      stockValue: 0,
    };
    if (!productMap.has(productKey)) {
      entry.displayName = name;
    }
    entry.units = Math.round((entry.units + qty) * 1e6) / 1e6;
    entry.stockValue += cost;
    if (row.grn_number && row.grn_number !== "Imported") {
      entry.grns.add(row.grn_number);
    }
    if (hasTrackedSerial(row.serial_number)) {
      entry.serials += 1;
    }
    productMap.set(productKey, entry);

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
    .map(([, data]) => ({
      productName: data.displayName,
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
    const companyPoNumber = row.company_po_number?.trim() || "-";
    const grnNumber = row.grn_number?.trim() || "-";
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
