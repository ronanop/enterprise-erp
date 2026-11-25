import type { ProcOrder } from "@/services/procurement-service";
import { resolveCompanyEntity } from "@/config/company-entities";
import { buildOrdersExcelBuffer } from "@/utils/orders-excel-buffer";
import {
  formatPoStatusForExport,
  type OrderExportRow,
} from "@/utils/order-export-shared";
import {
  deriveGrnStatus,
  poOverviewBucketForOrder,
} from "@/utils/procurement-po-buckets";

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
  if (Number.isFinite(days) && days > 0) return `Net ${days} days`;
  return "";
}

/** Inventory / manual POs have no CRM OVF customer commercial pack. */
function hasOvfCommercial(order: ProcOrder): boolean {
  if (order.ovf_no?.trim()) return true;
  return (
    (order.source_module || "").toLowerCase() === "crm" &&
    (order.source_document_type || "").toLowerCase() === "ovf" &&
    Boolean(order.source_document_id)
  );
}

/** Open / partial report: issued POs still awaiting full GRN (no draft / received / closed). */
export function filterOpenPartialExportOrders(orders: ProcOrder[]): ProcOrder[] {
  return orders.filter((order) => {
    const status = (order.status || "").toLowerCase();
    if (
      status === "draft" ||
      status === "submitted" ||
      status === "cancelled" ||
      status === "canceled" ||
      status === "closed" ||
      status === "received"
    ) {
      return false;
    }
    const bucket = poOverviewBucketForOrder(order, deriveGrnStatus(order));
    return bucket === "open" || bucket === "partial";
  });
}

export function buildOrderExportRows(
  orders: ProcOrder[],
  vendors: Record<string, { label: string }>,
): OrderExportRow[] {
  return orders.map((order) => {
    const vendor = vendors[order.vendor_id]?.label || order.vendor_id;
    const vendorTotal =
      Number(order.vendor_total) || Number(order.total_amount) || 0;
    const companyPo =
      order.company_po_number?.trim() || order.document_number || "";
    const entity = resolveCompanyEntity(order.entity_code, companyPo);
    const ovfLinked = hasOvfCommercial(order);
    const customerTotal = ovfLinked ? Number(order.customer_total) || 0 : 0;
    const apiMargin = Number(order.margin_amount);
    const hasApiMargin =
      order.margin_amount != null && Number.isFinite(apiMargin);
    const apiPct = Number(order.margin_pct);

    // Always show margin for every PO (customer − vendor). Prefer API margin when present.
    const margin =
      hasApiMargin && (Math.abs(apiMargin) > 0.0001 || customerTotal > 0)
        ? roundMoney(apiMargin)
        : roundMoney(customerTotal - vendorTotal);
    const marginPct =
      customerTotal > 0
        ? Number.isFinite(apiPct) && Math.abs(apiPct) > 0.0001
          ? roundMoney(apiPct)
          : roundMoney((margin / customerTotal) * 100)
        : "";

    return {
      "PO number": companyPo,
      "Company entity name": entity.displayName,
      "OVF number": order.ovf_no?.trim() || "",
      "Customer PO number": order.customer_po_number?.trim() || "",
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
      "Customer amt": ovfLinked ? roundMoney(customerTotal) : "",
      "Vendor amt": roundMoney(vendorTotal),
      Margin: margin,
      "Margin perc": marginPct,
      Status: formatPoStatusForExport(order.status, {
        scm_approval_stage: order.scm_approval_stage,
        fulfillment_stage: order.fulfillment_stage,
        vendor_response_status: order.vendor_response_status,
        po_sent_to_vendor_at: order.po_sent_to_vendor_at,
      }),
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
