import writeXlsxFile from "write-excel-file/browser";

import {
  listOrderReceiptBatches,
  type ProcurementInventoryRow,
  type ScmReceiptBatch,
  type ScmVendorPo,
} from "@/services/procurement-service";
import { listGrnNumbersForPo } from "@/utils/procurement-po-grn-billing";

const HEADERS = [
  "S.No",
  "Company PO Number",
  "PO Date",
  "Vendor",
  "Customer name",
  "Customer PO number",
  "PO Status",
  "GRN Number",
  "GRN Date",
  "GRN Maker",
  "Items",
] as const;

export type GrnExportRow = Record<(typeof HEADERS)[number], string | number>;

export type BuildGrnExportOptions = {
  inventory?: ProcurementInventoryRow[];
  batchesByOrderId?: Record<string, ScmReceiptBatch[]>;
};

type ExcelCell =
  | string
  | number
  | null
  | {
      value: string | number | null;
      type?: typeof String | typeof Number;
      fontWeight?: "bold";
      wrap?: boolean;
      align?: "left" | "center" | "right";
      alignVertical?: "top" | "center" | "bottom";
      height?: number;
    };

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 10);
  return d.toISOString().slice(0, 10);
}

function formatPoCompletionStatus(order: ScmVendorPo): string {
  const grn = (order.grn_status || "").toLowerCase();
  const status = (order.status || "").toLowerCase();
  if (
    grn === "closed" ||
    grn === "delivered" ||
    status === "received" ||
    status === "closed"
  ) {
    return "Completed";
  }
  if (grn === "partial" || status === "partially_received") {
    return "Partial";
  }
  return "Not completed";
}

export function resolveGrnNumber(row: ScmVendorPo): string {
  const companyPo = row.company_po_number?.trim() || row.document_number;
  return row.current_grn_number?.trim() || (companyPo ? `${companyPo}/001` : "");
}

function parseGrnSequence(grnNumber: string): number {
  const tail = grnNumber.trim().split("/").pop() || "";
  const n = Number.parseInt(tail, 10);
  return Number.isFinite(n) ? n : 0;
}

function findBatchForGrn(
  batches: ScmReceiptBatch[] | undefined,
  grnNumber: string,
): ScmReceiptBatch | undefined {
  if (!batches?.length) return undefined;
  const exact = batches.find((b) => (b.grn_number || "").trim() === grnNumber);
  if (exact) return exact;
  const seq = parseGrnSequence(grnNumber);
  if (seq <= 0) return undefined;
  return batches.find((b) => Number(b.sequence) === seq);
}

/** One product per line — Excel shows these as separate rows inside the cell. */
function joinItemLines(lines: string[]): string {
  return lines.filter(Boolean).join("\n");
}

/** Line items for one GRN batch (received qty on that GRN). */
function formatBatchItemsCell(order: ScmVendorPo, batch: ScmReceiptBatch): string {
  const lines = batch.lines || [];
  if (lines.length === 0) return "";

  return joinItemLines(
    lines.map((line, index) => {
      const orderLine = (order.lines || []).find((ln) => ln.id === line.order_line_id);
      const name = (
        line.product_name ||
        orderLine?.product_name ||
        `Line ${line.line_number}`
      ).trim();
      const ordered = Number(orderLine?.quantity) || 0;
      const received = Number(line.quantity) || 0;
      return `${index + 1}. ${name} | Ordered: ${ordered} | Received: ${received}`;
    }),
  );
}

/** Fallback: aggregate inventory stock units for a GRN. */
function formatInventoryItemsCell(
  order: ScmVendorPo,
  grnNumber: string,
  inventory: ProcurementInventoryRow[],
): string {
  const matched = inventory.filter(
    (row) => row.order_id === order.id && (row.grn_number || "").trim() === grnNumber,
  );
  if (matched.length === 0) return "";

  const byProduct = new Map<string, number>();
  for (const row of matched) {
    const name = (row.product_name || `Line ${row.line_number}`).trim();
    byProduct.set(name, (byProduct.get(name) || 0) + (Number(row.received_quantity) || 1));
  }

  return joinItemLines(
    [...byProduct.entries()].map(([name, qty], index) => {
      const orderLine = (order.lines || []).find(
        (ln) => (ln.product_name || "").trim().toLowerCase() === name.toLowerCase(),
      );
      const ordered = Number(orderLine?.quantity) || 0;
      return `${index + 1}. ${name} | Ordered: ${ordered} | Received: ${qty}`;
    }),
  );
}

/** PO-level ordered vs received (used when only one provisional GRN row exists). */
function formatPoItemsCell(order: ScmVendorPo): string {
  const lines = order.lines || [];
  if (lines.length === 0) return "";

  return joinItemLines(
    lines.map((line, index) => {
      const itemNo = index + 1;
      const name = (line.product_name || `Line ${line.line_number}`).trim();
      const ordered = Number(line.quantity) || 0;
      const received = Number(line.quantity_received) || 0;
      return `${itemNo}. ${name} | Ordered: ${ordered} | Received: ${received}`;
    }),
  );
}

function grnNumbersForExport(
  order: ScmVendorPo,
  inventory: ProcurementInventoryRow[],
  batches: ScmReceiptBatch[] | undefined,
): string[] {
  const fromList = listGrnNumbersForPo(order, inventory);
  const fromBatches = (batches || [])
    .map((b) => (b.grn_number || "").trim())
    .filter(Boolean);

  const bySeq = new Map<number, string>();
  for (const grn of [...fromList, ...fromBatches]) {
    const seq = parseGrnSequence(grn);
    if (seq > 0) bySeq.set(seq, grn);
    else bySeq.set(bySeq.size + 1, grn);
  }

  if (bySeq.size > 0) {
    return [...bySeq.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([, number]) => number);
  }

  const provisional = resolveGrnNumber(order);
  return provisional ? [provisional] : [];
}

/**
 * One Excel row per GRN document for each PO (not one row per PO).
 * Pass receipt batches and/or inventory so older GRNs get dates and line detail.
 */
export function buildGrnExportRows(
  orders: ScmVendorPo[],
  vendors: Record<string, { label: string }>,
  options: BuildGrnExportOptions = {},
): GrnExportRow[] {
  const inventory = options.inventory ?? [];
  const batchesByOrderId = options.batchesByOrderId ?? {};
  const rows: GrnExportRow[] = [];
  let serial = 0;

  for (const order of orders) {
    const vendor = vendors[order.vendor_id]?.label || order.vendor_id;
    const poNumber = order.company_po_number?.trim() || order.document_number;
    const poDate = formatDate(order.created_at || order.document_date);
    const poStatus = formatPoCompletionStatus(order);
    const batches = batchesByOrderId[order.id];
    const grnNumbers = grnNumbersForExport(order, inventory, batches);
    const singleProvisional = grnNumbers.length === 1 && !batches?.length;

    for (const grnNumber of grnNumbers) {
      serial += 1;
      const batch = findBatchForGrn(batches, grnNumber);
      const grnDate = formatDate(
        batch?.receipt_at ||
          (grnNumber === (order.current_grn_number || "").trim()
            ? order.receipt_saved_at || order.document_date
            : null),
      );
      const grnMaker = (batch?.created_by_name || "").trim();

      let items = "";
      if (batch && (batch.lines?.length ?? 0) > 0) {
        items = formatBatchItemsCell(order, batch);
      } else {
        items = formatInventoryItemsCell(order, grnNumber, inventory);
        if (!items && singleProvisional) {
          items = formatPoItemsCell(order);
        }
      }

      rows.push({
        "S.No": serial,
        "Company PO Number": poNumber,
        "PO Date": poDate,
        Vendor: vendor,
        "Customer name": (order.customer_name || "").trim(),
        "Customer PO number": (order.customer_po_number || "").trim(),
        "PO Status": batch?.reversed ? "Partial" : poStatus,
        "GRN Number": grnNumber,
        "GRN Date": grnDate,
        "GRN Maker": grnMaker,
        Items: items,
      });
    }
  }

  return rows;
}

/** Load receipt batches then build one export row per GRN. */
export async function buildGrnExportRowsWithBatches(
  orders: ScmVendorPo[],
  vendors: Record<string, { label: string }>,
  inventory: ProcurementInventoryRow[] = [],
): Promise<GrnExportRow[]> {
  const batchesByOrderId: Record<string, ScmReceiptBatch[]> = {};
  await Promise.all(
    orders.map(async (order) => {
      try {
        batchesByOrderId[order.id] = await listOrderReceiptBatches(order.id);
      } catch {
        batchesByOrderId[order.id] = [];
      }
    }),
  );
  return buildGrnExportRows(orders, vendors, { inventory, batchesByOrderId });
}

function toExcelCell(key: (typeof HEADERS)[number], value: string | number): ExcelCell {
  if (typeof value === "number") {
    return { type: Number, value };
  }
  return { type: String, value: String(value ?? "") };
}

function splitItemLines(items: string): string[] {
  const lines = String(items || "")
    .split(/\r\n|\n|\r/)
    .map((line) => line.trim())
    .filter(Boolean);
  return lines.length > 0 ? lines : [""];
}

/**
 * Expand each GRN into one Excel row per product line so items never collapse
 * onto a single line (Excel shared-string whitespace stripping).
 */
function expandRowsForExcel(rows: GrnExportRow[]): GrnExportRow[] {
  const out: GrnExportRow[] = [];
  for (const row of rows) {
    const itemLines = splitItemLines(String(row.Items ?? ""));
    itemLines.forEach((itemLine, index) => {
      if (index === 0) {
        out.push({ ...row, Items: itemLine });
        return;
      }
      out.push({
        "S.No": "",
        "Company PO Number": "",
        "PO Date": "",
        Vendor: "",
        "Customer name": "",
        "Customer PO number": "",
        "PO Status": "",
        "GRN Number": "",
        "GRN Date": "",
        "GRN Maker": "",
        Items: itemLine,
      });
    });
  }
  return out;
}

/** Build and download GRN Excel with one product line per row. */
export async function exportGrnsXlsx(filename: string, rows: GrnExportRow[]) {
  const source = rows.length
    ? rows
    : [Object.fromEntries(HEADERS.map((h) => [h, ""])) as GrnExportRow];
  const data = expandRowsForExcel(source);

  const headerRow: ExcelCell[] = HEADERS.map((h) => ({
    type: String,
    value: h,
    fontWeight: "bold",
  }));

  const body: ExcelCell[][] = data.map((row) =>
    HEADERS.map((key) => toExcelCell(key, row[key] ?? "")),
  );

  const result = await writeXlsxFile([
    {
      sheet: "GRNs",
      stickyRowsCount: 1,
      data: [headerRow, ...body],
      columns: [
        { width: 8 },
        { width: 22 },
        { width: 12 },
        { width: 26 },
        { width: 24 },
        { width: 20 },
        { width: 14 },
        { width: 22 },
        { width: 12 },
        { width: 22 },
        { width: 56 },
      ],
    },
  ]);
  const blob = await result.toBlob();
  downloadBlob(filename, blob);
}

