import * as XLSX from "xlsx";

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
  "GRN Status",
  "GRN Number",
  "GRN Date",
  "Items",
] as const;

export type GrnExportRow = Record<(typeof HEADERS)[number], string | number>;

export type BuildGrnExportOptions = {
  inventory?: ProcurementInventoryRow[];
  batchesByOrderId?: Record<string, ScmReceiptBatch[]>;
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

function formatGrnStatusLabel(status: string): string {
  const value = (status || "").toLowerCase();
  if (value === "closed" || value === "delivered") return "Delivered";
  if (value === "partial") return "Partial";
  if (value === "pending") return "Open";
  return status
    ? status.charAt(0).toUpperCase() + status.slice(1).toLowerCase()
    : "";
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

/** Line items for one GRN batch (received qty on that GRN). */
function formatBatchItemsCell(order: ScmVendorPo, batch: ScmReceiptBatch): string {
  const lines = batch.lines || [];
  if (lines.length === 0) return "";

  return lines
    .map((line, index) => {
      const orderLine = (order.lines || []).find((ln) => ln.id === line.order_line_id);
      const name = (line.product_name || orderLine?.product_name || `Line ${line.line_number}`).trim();
      const ordered = Number(orderLine?.quantity) || 0;
      const received = Number(line.quantity) || 0;
      return `${index + 1}. ${name} | Ordered: ${ordered} | Received: ${received}`;
    })
    .join("\n");
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

  return [...byProduct.entries()]
    .map(([name, qty], index) => {
      const orderLine = (order.lines || []).find(
        (ln) => (ln.product_name || "").trim().toLowerCase() === name.toLowerCase(),
      );
      const ordered = Number(orderLine?.quantity) || 0;
      return `${index + 1}. ${name} | Ordered: ${ordered} | Received: ${qty}`;
    })
    .join("\n");
}

/** PO-level ordered vs received (used when only one provisional GRN row exists). */
function formatPoItemsCell(order: ScmVendorPo): string {
  const lines = order.lines || [];
  if (lines.length === 0) return "";

  return lines
    .map((line, index) => {
      const itemNo = index + 1;
      const name = (line.product_name || `Line ${line.line_number}`).trim();
      const ordered = Number(line.quantity) || 0;
      const received = Number(line.quantity_received) || 0;
      const status = formatGrnStatusLabel(line.grn_status || order.grn_status);
      return `${itemNo}. ${name} | Ordered: ${ordered} | Received: ${received} | ${status}`;
    })
    .join("\n");
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
    const poGrnStatus = formatGrnStatusLabel(order.grn_status);
    const batches = batchesByOrderId[order.id];
    const grnNumbers = grnNumbersForExport(order, inventory, batches);
    const singleProvisional = grnNumbers.length === 1 && !batches?.length;

    for (const grnNumber of grnNumbers) {
      serial += 1;
      const batch = findBatchForGrn(batches, grnNumber);
      const reversed = Boolean(batch?.reversed);
      const grnStatus = reversed ? `${poGrnStatus} (Reversed)` : poGrnStatus;
      const grnDate = formatDate(
        batch?.receipt_at ||
          (grnNumber === (order.current_grn_number || "").trim()
            ? order.receipt_saved_at || order.document_date
            : null),
      );

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
        "GRN Status": grnStatus,
        "GRN Number": grnNumber,
        "GRN Date": grnDate,
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

export function exportGrnsXlsx(filename: string, rows: GrnExportRow[]) {
  const data = rows.length
    ? rows
    : [Object.fromEntries(HEADERS.map((h) => [h, ""])) as GrnExportRow];

  const ws = XLSX.utils.json_to_sheet(data, { header: [...HEADERS] });
  const range = XLSX.utils.decode_range(ws["!ref"] || "A1");
  ws["!autofilter"] = { ref: XLSX.utils.encode_range(range) };
  ws["!views"] = [
    {
      state: "frozen",
      ySplit: 1,
      topLeftCell: "A2",
      activeCell: "A2",
    },
  ];
  ws["!cols"] = [
    { wch: 8 },
    { wch: 22 },
    { wch: 12 },
    { wch: 26 },
    { wch: 14 },
    { wch: 22 },
    { wch: 12 },
    { wch: 56 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "GRNs");
  const buffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  downloadBlob(
    filename,
    new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
  );
}
