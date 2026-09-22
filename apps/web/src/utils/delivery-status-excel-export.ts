import * as XLSX from "xlsx";

import {
  aggregatePoDcBillStatus,
  challanDeliveredQuantity,
  formatDeliveryBillStatusLabel,
  resolveDeliveryBillStatus,
} from "@/utils/delivery-challan-bill";
import { getDeliveryChallan } from "@/utils/delivery-challan-storage";
import type { DeliveryStatusRow } from "@/utils/delivery-status-storage";

const HEADERS = [
  "S.No",
  "PO Number",
  "GRN Number",
  "Customer Name",
  "Customer PO Number",
  "Cache Invoice Number",
  "Delivery Status",
  "DC Bill Status",
  "PO Bill Status",
  "Billed Quantity",
  "Dispatch Mode",
  "Courier",
  "Docket Number",
  "Estimated Delivery Date",
  "Dispatch Date",
  "Delivered Date",
  "No. of Boxes",
  "Mode of Surface",
  "Delivery Person",
  "Item Type",
  "Vendor",
  "Challan Number",
  "Remarks",
  "Last Updated",
] as const;

export type DeliveryStatusExportRow = Record<(typeof HEADERS)[number], string | number>;

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function formatDate(value: string | null | undefined): string {
  const raw = (value ?? "").trim();
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw.slice(0, 10);
  return d.toISOString().slice(0, 10);
}

function formatDispatchMode(mode: string): string {
  if (mode === "hand") return "By hand";
  if (mode === "courier") return "Courier";
  return "";
}

function formatItemType(value: string): string {
  if (value === "hardware") return "Hardware";
  if (value === "software") return "Software";
  return "";
}

export function buildDeliveryStatusExportRows(rows: DeliveryStatusRow[]): DeliveryStatusExportRow[] {
  return rows.map((row, index) => {
    const challan = getDeliveryChallan(row.challanId);
    const qty = challan ? challanDeliveredQuantity(challan) : 0;
    const billKey = resolveDeliveryBillStatus(row, qty);
    return {
      "S.No": index + 1,
      "PO Number": row.purchaseOrderNumber || "",
      "GRN Number": row.grnSummary || "",
      "Customer Name": row.customerName || "",
      "Customer PO Number": row.customerPoNumber || "",
      "Cache Invoice Number": row.billInvoiceNumber || row.cacheInvoiceNumber || "",
      "Delivery Status": row.shipmentStatus || "",
      "DC Bill Status": formatDeliveryBillStatusLabel(billKey),
      "PO Bill Status": aggregatePoDcBillStatus(row.orderId),
      "Billed Quantity": row.billedQuantity || "",
      "Dispatch Mode": formatDispatchMode(row.deliveryMode),
      Courier: row.courierProvider || row.courierTransportDetails || "",
      "Docket Number": row.docketNumber || row.trackingNumber || "",
      "Estimated Delivery Date": formatDate(row.expectedDeliveryDate),
      "Dispatch Date": formatDate(row.dispatchDate),
      "Delivered Date": formatDate(row.actualDeliveryDate),
      "No. of Boxes": row.boxCount || "",
      "Mode of Surface": row.surfaceMode || "",
      "Delivery Person": row.deliveryBoyName || "",
      "Item Type": formatItemType(row.itemType),
      Vendor: row.vendorName || "",
      "Challan Number": row.challanNumber || "",
      Remarks: row.remarks || row.billRemarks || "",
      "Last Updated": formatDate(row.updatedAt),
    };
  });
}

export function exportDeliveryStatusXlsx(filename: string, rows: DeliveryStatusExportRow[]) {
  const data = rows.length
    ? rows
    : [Object.fromEntries(HEADERS.map((h) => [h, ""])) as DeliveryStatusExportRow];

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
    { wch: 18 },
    { wch: 20 },
    { wch: 24 },
    { wch: 20 },
    { wch: 20 },
    { wch: 16 },
    { wch: 14 },
    { wch: 16 },
    { wch: 18 },
    { wch: 18 },
    { wch: 14 },
    { wch: 14 },
    { wch: 12 },
    { wch: 16 },
    { wch: 18 },
    { wch: 12 },
    { wch: 22 },
    { wch: 18 },
    { wch: 32 },
    { wch: 14 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Delivery Status");
  const buffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  downloadBlob(
    filename,
    new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
  );
}
