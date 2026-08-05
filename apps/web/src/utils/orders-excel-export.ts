import type { ProcOrder } from "@/services/procurement-service";
import {
  ORDER_EXPORT_HEADERS,
  formatPoStatusForExport,
  type OrderExportRow,
} from "@/utils/order-export-shared";

export type { OrderExportRow } from "@/utils/order-export-shared";

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
  return value;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function buildOrderExportRows(
  orders: ProcOrder[],
  vendors: Record<string, { label: string }>,
): OrderExportRow[] {
  return orders.map((order) => {
    const vendor = vendors[order.vendor_id]?.label || order.vendor_id;
    const customerTotal = Number(order.customer_total) || 0;
    const margin = Number(order.margin_amount) || 0;
    const marginPct =
      Number(order.margin_pct) ||
      (customerTotal ? (margin / customerTotal) * 100 : 0);
    const paymentTerm = (order.payment_terms || "").trim();
    return {
      "Customer name": order.customer_name?.trim() || "",
      "Customer PO": order.customer_po_number?.trim() || "",
      "Customer PO date": formatDate(order.ovf_date),
      "Customer PO amount": roundMoney(customerTotal),
      "Tax amount": roundMoney(Number(order.customer_tax_amount) || 0),
      "Total amount with tax": roundMoney(Number(order.customer_total_with_tax) || 0),
      Description: order.description?.trim() || "",
      "Vendor name": vendor,
      "Payment term": paymentTerm,
      "Cache PO": order.company_po_number?.trim() || order.document_number || "",
      "Cache PO date": formatDate(order.document_date),
      Amount: roundMoney(Number(order.vendor_total) || Number(order.total_amount) || 0),
      Tax: roundMoney(Number(order.vendor_tax_amount) || 0),
      "Total with tax": roundMoney(Number(order.vendor_total_with_tax) || 0),
      Margin: roundMoney(margin),
      "Margin %": roundMoney(marginPct),
      "PO status": formatPoStatusForExport(order.status),
    };
  });
}

export async function exportOrdersXlsx(filename: string, rows: OrderExportRow[]) {
  const response = await fetch("/api/procurement/orders/export", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "*/*" },
    body: JSON.stringify({ filename, rows }),
    cache: "no-store",
  });

  if (!response.ok) {
    let detail = `Export failed (${response.status})`;
    try {
      const payload = (await response.json()) as { error?: string };
      if (payload.error?.trim()) detail = payload.error.trim();
    } catch {
      /* ignore */
    }
    throw new Error(detail);
  }

  const blob = await response.blob();
  downloadBlob(filename, blob);
}
