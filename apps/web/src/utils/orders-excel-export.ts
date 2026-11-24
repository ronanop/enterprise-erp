import type { ProcOrder } from "@/services/procurement-service";
import { resolveCompanyEntity } from "@/config/company-entities";
import { buildOrdersExcelBuffer } from "@/utils/orders-excel-buffer";
import {
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

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function formatPayTerms(
  paymentTerms: string | null | undefined,
  paymentDays: number | null | undefined,
): string {
  const terms = (paymentTerms || "").trim();
  if (terms) return terms;
  const days = Number(paymentDays);
  if (Number.isFinite(days) && days > 0) return `${days} days`;
  return "";
}

export function buildOrderExportRows(
  orders: ProcOrder[],
  vendors: Record<string, { label: string }>,
): OrderExportRow[] {
  return orders.map((order) => {
    const vendor = vendors[order.vendor_id]?.label || order.vendor_id;
    const customerTotal = Number(order.customer_total) || 0;
    const vendorTotal =
      Number(order.vendor_total) || Number(order.total_amount) || 0;
    const margin = Number(order.margin_amount) || 0;
    const marginPct =
      Number(order.margin_pct) ||
      (customerTotal ? (margin / customerTotal) * 100 : 0);
    const companyPo =
      order.company_po_number?.trim() || order.document_number || "";
    const entity = resolveCompanyEntity(order.entity_code, companyPo);
    return {
      "PO number": companyPo,
      "Company entity name": entity.displayName,
      "Customer name":
        order.customer_name?.trim() ||
        order.approved_by_name?.trim() ||
        "",
      "Customer pay terms": formatPayTerms(
        null,
        order.customer_payment_days,
      ),
      "Vendor name": vendor,
      "Vendor payment terms": formatPayTerms(order.payment_terms, null),
      "Customer amt": roundMoney(customerTotal),
      "Vendor amt": roundMoney(vendorTotal),
      Margin: roundMoney(margin),
      "Margin perc": roundMoney(marginPct),
      Status: formatPoStatusForExport(order.status),
    };
  });
}

/** Build and download PO Excel in the browser (nginx routes /api/* to FastAPI). */
export async function exportOrdersXlsx(filename: string, rows: OrderExportRow[]) {
  const buffer = await buildOrdersExcelBuffer(rows);
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  downloadBlob(filename, blob);
}
